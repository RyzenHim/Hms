import type { jsPDF } from "jspdf";
import { drawSvgArtwork } from "./pdf-vector-artwork.ts";
import { splitPdfTextFontRuns } from "./pdf-fonts.ts";
import { drawPdfGradient } from "./pdf-native-gradient.ts";

type Matrix = Pick<DOMMatrix, "a" | "b" | "c" | "d" | "e" | "f">;
type PdfPath = { op: "m" | "l" | "c" | "h"; c: number[] };
type Box = { x: number; y: number; width: number; height: number };
type Pattern = { __pdfPattern: true; image: CanvasImageSource; repetition: string };
type Gradient = { __pdfGradient: true; kind: "linear" | "radial" | "conic"; args: number[]; stops: [number, string][] };
type Paint = string | Pattern | Gradient;
type FontRun = { text: string; fontFamily: string; fontStyle: string; supported: boolean };
type EncodedArtwork = { data: string; paddingX: number; paddingY: number; width: number; height: number };

export type NativePdfCanvasOptions = {
  /** Raster artwork resolution; text and paths always remain vectors. */
  scale?: number;
  captureScale?: number;
  imageFormat?: "JPEG" | "PNG";
  jpegQuality?: number;
  svgSources?: ReadonlyMap<string, string>;
  paintSvg?: (context: CanvasRenderingContext2D, svg: string, box: Box) => boolean;
  textRuns?: (cssFont: string, text: string) => FontRun[];
};

const PIXELS_PER_MM = 96 / 25.4;
const imageCaches = new WeakMap<jsPDF, WeakMap<object, Map<string, EncodedArtwork>>>();

function imageSize(image: CanvasImageSource): { width: number; height: number } {
  const source = image as HTMLImageElement & HTMLVideoElement & HTMLCanvasElement;
  return { width: source.naturalWidth || source.videoWidth || source.width, height: source.naturalHeight || source.videoHeight || source.height };
}

function sourceUrl(image: CanvasImageSource): string {
  const source = image as HTMLImageElement;
  return source.currentSrc || source.src || "";
}

function alpha(color: string): number {
  const match = /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)$/i.exec(color);
  return color === "transparent" ? 0 : match ? Number(match[1]) : 1;
}

/**
 * Canvas-compatible drawing surface which writes text, borders and shapes to PDF.
 * The real 1px canvas supplies browser font metrics and state; it never holds a page
 * screenshot. Only photographs and effects that need pixels get image XObjects.
 */
export function createNativePdfCanvas(pdf: jsPDF, document: Document, options: NativePdfCanvasOptions = {}): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const measure = canvas.getContext("2d");
  if (!measure) throw new Error("Unable to prepare native PDF drawing.");
  const native = pdf.context2d;
  let fillStyle: Paint = "#000000";
  let strokeStyle: Paint = "#000000";
  let path: PdfPath[] = [];
  let currentPoint: { x: number; y: number } | null = null;
  let subpathStart: { x: number; y: number } | null = null;
  const states: { fill: Paint; stroke: Paint }[] = [];
  const matrix = (): Matrix => measure.getTransform();
  const point = (x: number, y: number) => {
    const m = matrix();
    return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
  };
  const magnitude = () => {
    const m = matrix();
    return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
  };
  const opacity = (paint: Paint) => {
    const value = measure.globalAlpha * (typeof paint === "string" ? alpha(paint) : 1);
    pdf.setGState(pdf.GState({ opacity: value, "stroke-opacity": value }));
    return value;
  };
  const withTransform = (draw: () => void, transform: Matrix = matrix()) => {
    pdf.advancedAPI(() => {
      pdf.saveGraphicsState();
      pdf.setCurrentTransformationMatrix(pdf.Matrix(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f));
      try { draw(); } finally { pdf.restoreGraphicsState(); }
    });
  };
  const addImage = (data: string, box: Box, transform?: Matrix) => {
    withTransform(() => pdf.addImage(data, data.startsWith("data:image/png") ? "PNG" : "JPEG", box.x, box.y, box.width, box.height, undefined, "SLOW"), transform);
  };
  const pathBounds = (stroke = false): Box | null => {
    const coordinates = path.flatMap((segment) => segment.c.reduce<{ x: number; y: number }[]>((points, value, index, values) => {
      if (index % 2 === 0) points.push({ x: value, y: values[index + 1] });
      return points;
    }, []));
    if (!coordinates.length) return null;
    const padding = stroke ? measure.lineWidth * magnitude() / 2 : 0;
    const x = Math.min(...coordinates.map((p) => p.x)) - padding;
    const y = Math.min(...coordinates.map((p) => p.y)) - padding;
    return { x, y, width: Math.max(...coordinates.map((p) => p.x)) - x + padding, height: Math.max(...coordinates.map((p) => p.y)) - y + padding };
  };
  const prepareStyle = (context: CanvasRenderingContext2D, paint: Paint): string | CanvasPattern | CanvasGradient => {
    if (typeof paint === "string") return paint;
    if ("__pdfPattern" in paint) {
      const pattern = context.createPattern(paint.image, paint.repetition);
      if (!pattern) throw new Error("Unable to render a PDF background image.");
      return pattern;
    }
    const args = paint.args;
    const gradient = paint.kind === "linear"
      ? context.createLinearGradient(args[0], args[1], args[2], args[3])
      : paint.kind === "conic"
        ? context.createConicGradient(args[0], args[1], args[2])
        : context.createRadialGradient(args[0], args[1], args[2], args[3], args[4], args[5]);
    for (const [offset, color] of paint.stops) gradient.addColorStop(offset, color);
    return gradient;
  };
  const renderPathPixels = (paint: Paint, stroke = false, rule: CanvasFillRule = "nonzero") => {
    const bounds = pathBounds(stroke);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0 || !opacity(paint)) return;
    const raster = document.createElement("canvas");
    const pixelsPerUnit = PIXELS_PER_MM * (options.scale ?? 2);
    raster.width = Math.max(1, Math.ceil(bounds.width * pixelsPerUnit));
    raster.height = Math.max(1, Math.ceil(bounds.height * pixelsPerUnit));
    const context = raster.getContext("2d");
    if (!context) throw new Error("Unable to prepare a PDF background.");
    try {
      const m = matrix();
      const determinant = m.a * m.d - m.b * m.c;
      if (!determinant) return;
      const unmap = (x: number, y: number) => ({ x: (m.d * (x - m.e) - m.c * (y - m.f)) / determinant, y: (-m.b * (x - m.e) + m.a * (y - m.f)) / determinant });
      context.setTransform(pixelsPerUnit * m.a, pixelsPerUnit * m.b, pixelsPerUnit * m.c, pixelsPerUnit * m.d, pixelsPerUnit * (m.e - bounds.x), pixelsPerUnit * (m.f - bounds.y));
      context.beginPath();
      for (const segment of path) {
        const points = segment.c.reduce<{ x: number; y: number }[]>((points, value, index, values) => { if (index % 2 === 0) points.push(unmap(value, values[index + 1])); return points; }, []);
        if (segment.op === "m") context.moveTo(points[0].x, points[0].y);
        else if (segment.op === "l") context.lineTo(points[0].x, points[0].y);
        else if (segment.op === "c") context.bezierCurveTo(points[0].x, points[0].y, points[1].x, points[1].y, points[2].x, points[2].y);
        else context.closePath();
      }
      if (stroke) {
        context.strokeStyle = prepareStyle(context, paint);
        context.lineWidth = measure.lineWidth;
        context.lineCap = measure.lineCap;
        context.lineJoin = measure.lineJoin;
        context.setLineDash(measure.getLineDash());
        context.stroke();
      } else {
        context.fillStyle = prepareStyle(context, paint);
        context.fill(rule);
      }
      addImage(raster.toDataURL("image/png"), bounds, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    } finally { raster.width = raster.height = 1; }
  };
  const paintPath = (stroke = false, rule: CanvasFillRule = "nonzero") => {
    const paint = stroke ? strokeStyle : fillStyle;
    if (!path.length) return;
    if (typeof paint !== "string") {
      if (!stroke && "__pdfGradient" in paint && drawPdfGradient(pdf, paint, path, matrix(), measure.globalAlpha, rule)) return;
      renderPathPixels(paint, stroke, rule); return;
    }
    if (!opacity(paint)) return;
    if (stroke) {
      native.strokeStyle = paint;
      pdf.setLineWidth(measure.lineWidth * magnitude());
      pdf.setLineCap(measure.lineCap);
      pdf.setLineJoin(measure.lineJoin);
      pdf.setLineDashPattern(measure.getLineDash().map((value) => value * magnitude()), measure.lineDashOffset * magnitude());
    } else native.fillStyle = paint;
    pdf.path(path);
    if (stroke) pdf.stroke();
    else if (rule === "evenodd") pdf.fillEvenOdd();
    else pdf.fill();
  };
  const encodeImage = (image: CanvasImageSource, crop: Box, destination: Box): EncodedArtwork => {
    const m = matrix();
    const destinationWidth = Math.hypot(m.a, m.b) * Math.abs(destination.width);
    const destinationHeight = Math.hypot(m.c, m.d) * Math.abs(destination.height);
    const vectorSource = /^data:image\/svg\+xml/i.test(sourceUrl(image)) || /\.svg(?:[?#]|$)/i.test(sourceUrl(image));
    const targetWidth = Math.max(1, Math.ceil(destinationWidth * PIXELS_PER_MM * (options.scale ?? 2)));
    const targetHeight = Math.max(1, Math.ceil(destinationHeight * PIXELS_PER_MM * (options.scale ?? 2)));
    const width = vectorSource ? targetWidth : Math.min(Math.max(1, Math.ceil(crop.width)), targetWidth);
    const height = vectorSource ? targetHeight : Math.min(Math.max(1, Math.ceil(crop.height)), targetHeight);
    let cache = imageCaches.get(pdf);
    if (!cache) { cache = new WeakMap(); imageCaches.set(pdf, cache); }
    let entries = cache.get(image);
    if (!entries) { entries = new Map(); cache.set(image, entries); }
    const key = `${crop.x},${crop.y},${crop.width},${crop.height}:${width}x${height}:${options.imageFormat}:${options.jpegQuality}:${measure.filter}:${measure.shadowColor}:${measure.shadowBlur}:${measure.shadowOffsetX}:${measure.shadowOffsetY}`;
    const previous = entries.get(key);
    if (previous) return previous;
    const raster = document.createElement("canvas");
    const scaleX = width / Math.abs(destination.width), scaleY = height / Math.abs(destination.height);
    const captureScale = options.captureScale ?? 1;
    const blur = Number(/\bblur\(\s*([\d.]+)px\s*\)/i.exec(measure.filter || "")?.[1] || 0);
    const shadowBlur = (measure.shadowBlur || 0) / captureScale;
    const shadowX = (measure.shadowOffsetX || 0) / captureScale;
    const shadowY = (measure.shadowOffsetY || 0) / captureScale;
    const paddingX = Math.ceil(((blur + shadowBlur) * 3 + Math.abs(shadowX)) * scaleX);
    const paddingY = Math.ceil(((blur + shadowBlur) * 3 + Math.abs(shadowY)) * scaleY);
    raster.width = width + paddingX * 2;
    raster.height = height + paddingY * 2;
    const context = raster.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Unable to optimize PDF artwork.");
    try {
      context.imageSmoothingEnabled = measure.imageSmoothingEnabled;
      context.imageSmoothingQuality = "high";
      context.filter = (measure.filter || "none").replace(/\bblur\(\s*([\d.]+)px\s*\)/gi, (_, radius: string) => `blur(${Number(radius) * Math.max(scaleX, scaleY)}px)`);
      context.shadowColor = measure.shadowColor;
      context.shadowBlur = shadowBlur * Math.max(scaleX, scaleY);
      context.shadowOffsetX = shadowX * scaleX;
      context.shadowOffsetY = shadowY * scaleY;
      context.drawImage(image, crop.x, crop.y, crop.width, crop.height, paddingX, paddingY, width, height);
      let transparent = false;
      if (options.imageFormat !== "PNG") {
        const pixels = context.getImageData(0, 0, raster.width, raster.height).data;
        for (let index = 3; index < pixels.length; index += 4) if (pixels[index] !== 255) { transparent = true; break; }
      }
      const format = options.imageFormat === "PNG" || transparent ? "image/png" : "image/jpeg";
      const result: EncodedArtwork = { data: raster.toDataURL(format, options.jpegQuality ?? 0.9), paddingX: paddingX / scaleX, paddingY: paddingY / scaleY, width: raster.width / scaleX, height: raster.height / scaleY };
      entries.set(key, result);
      return result;
    } finally { raster.width = raster.height = 1; }
  };
  const drawImage = (image: CanvasImageSource, ...args: number[]) => {
    const size = imageSize(image);
    const crop = args.length === 8 ? { x: args[0], y: args[1], width: args[2], height: args[3] } : { x: 0, y: 0, ...size };
    const box = args.length === 8 ? { x: args[4], y: args[5], width: args[6], height: args[7] }
      : { x: args[0], y: args[1], width: args[2] ?? size.width, height: args[3] ?? size.height };
    if (!box.width || !box.height || !crop.width || !crop.height || !opacity("#000000")) return;
    const svg = options.svgSources?.get(sourceUrl(image));
    if (svg && (!measure.filter || measure.filter === "none") && !measure.shadowBlur && !measure.shadowOffsetX && !measure.shadowOffsetY) {
      const previousPath = path;
      const previousPoint = currentPoint;
      const previousStart = subpathStart;
      context.save();
      try {
        context.beginPath(); context.rect(box.x, box.y, box.width, box.height); context.clip();
        const fullBox = { x: box.x - crop.x * box.width / crop.width, y: box.y - crop.y * box.height / crop.height, width: size.width * box.width / crop.width, height: size.height * box.height / crop.height };
        if ((options.paintSvg ?? drawSvgArtwork)(context, svg, fullBox)) return;
      } finally { context.restore(); path = previousPath; currentPoint = previousPoint; subpathStart = previousStart; }
    }
    const encoded = encodeImage(image, crop, box);
    addImage(encoded.data, { x: box.x - encoded.paddingX, y: box.y - encoded.paddingY, width: encoded.width, height: encoded.height });
  };
  const drawTextPixels = (text: string, x: number, y: number, stroke: boolean, maxWidth?: number) => {
    const metrics = measure.measureText(text);
    const fontSize = parseFloat(/([\d.]+)px\b/.exec(measure.font)?.[1] || "10");
    const shadowScale = options.captureScale ?? 1;
    const shadowPadding = ((measure.shadowBlur || 0) * 2 + Math.max(Math.abs(measure.shadowOffsetX || 0), Math.abs(measure.shadowOffsetY || 0))) / shadowScale;
    const padding = Math.max(2, stroke ? measure.lineWidth * 2 : 2, Math.ceil(shadowPadding));
    const ascent = metrics.actualBoundingBoxAscent || fontSize;
    const descent = metrics.actualBoundingBoxDescent || fontSize * 0.3;
    const compression = maxWidth && metrics.width > maxWidth ? maxWidth / metrics.width : 1;
    const measuredWidth = metrics.width * compression;
    const anchorOffset = measure.textAlign === "center" ? measuredWidth / 2 : measure.textAlign === "right" || measure.textAlign === "end" ? measuredWidth : 0;
    const leftEdge = Number.isFinite(metrics.actualBoundingBoxLeft) ? -metrics.actualBoundingBoxLeft * compression : -anchorOffset;
    const rightEdge = Number.isFinite(metrics.actualBoundingBoxRight) ? metrics.actualBoundingBoxRight * compression : measuredWidth - anchorOffset;
    const width = Math.max(1, rightEdge - leftEdge + padding * 2);
    const height = ascent + descent + padding * 2;
    const raster = document.createElement("canvas");
    const m = matrix();
    const ratio = (options.scale ?? 2) * PIXELS_PER_MM * Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d));
    raster.width = Math.max(1, Math.ceil(width * ratio));
    raster.height = Math.max(1, Math.ceil(height * ratio));
    const temporary = raster.getContext("2d");
    if (!temporary) throw new Error("Unable to preserve PDF text artwork.");
    try {
      temporary.scale(ratio, ratio);
      temporary.font = measure.font;
      temporary.direction = measure.direction;
      temporary.textBaseline = measure.textBaseline;
      temporary.textAlign = measure.textAlign;
      temporary.fillStyle = typeof fillStyle === "string" ? fillStyle : "#000000";
      temporary.strokeStyle = typeof strokeStyle === "string" ? strokeStyle : "#000000";
      temporary.lineWidth = measure.lineWidth;
      temporary.filter = measure.filter || "none";
      temporary.shadowColor = measure.shadowColor;
      temporary.shadowBlur = (measure.shadowBlur || 0) * ratio / shadowScale;
      temporary.shadowOffsetX = (measure.shadowOffsetX || 0) * ratio / shadowScale;
      temporary.shadowOffsetY = (measure.shadowOffsetY || 0) * ratio / shadowScale;
      if (stroke) temporary.strokeText(text, padding - leftEdge, padding + ascent, maxWidth);
      else temporary.fillText(text, padding - leftEdge, padding + ascent, maxWidth);
      addImage(raster.toDataURL("image/png"), { x: x + leftEdge - padding, y: y - ascent - padding, width: raster.width / ratio, height: raster.height / ratio });
    } finally { raster.width = raster.height = 1; }
  };
  const drawText = (text: string, x: number, y: number, stroke = false, maxWidth?: number) => {
    const paint = stroke ? strokeStyle : fillStyle;
    if (!text || !opacity(paint)) return;
    const runs = (options.textRuns ?? splitPdfTextFontRuns)(measure.font, text);
    if (typeof paint !== "string" || runs.some((run) => !run.supported) || (measure.filter && measure.filter !== "none") || measure.shadowBlur || measure.shadowOffsetX || measure.shadowOffsetY) { drawTextPixels(text, x, y, stroke, maxWidth); return; }
    const metrics = measure.measureText(text);
    const fontSize = parseFloat(/([\d.]+)px\b/.exec(measure.font)?.[1] || "10");
    const compression = maxWidth && metrics.width > maxWidth ? maxWidth / metrics.width : 1;
    let startX = x;
    if (measure.textAlign === "center") startX -= metrics.width * compression / 2;
    else if (measure.textAlign === "right" || measure.textAlign === "end") startX -= metrics.width * compression;
    const previousBaseline = measure.textBaseline;
    measure.textBaseline = "alphabetic";
    const alphabeticMetrics = measure.measureText(text);
    measure.textBaseline = previousBaseline;
    const alphabeticY = y + (alphabeticMetrics.actualBoundingBoxAscent || 0) - (metrics.actualBoundingBoxAscent || 0);
    native.fillStyle = paint;
    if (stroke) native.strokeStyle = paint;
    let prefix = "";
    for (const run of runs) {
      pdf.setFont(run.fontFamily, run.fontStyle);
      pdf.setFontSize(fontSize * pdf.internal.scaleFactor);
      const offset = measure.measureText(prefix).width;
      const runX = startX + offset * compression;
      const pdfWidth = pdf.getTextWidth(run.text);
      const horizontalScale = (pdfWidth ? measure.measureText(run.text).width / pdfWidth : 1) * compression;
      withTransform(() => {
        if (Math.abs(horizontalScale - 1) > 0.00001) pdf.setCurrentTransformationMatrix(pdf.Matrix(horizontalScale, 0, 0, 1, runX * (1 - horizontalScale), 0));
        pdf.text(run.text, runX, alphabeticY, { baseline: "alphabetic", renderingMode: stroke ? "stroke" : "fill" });
      });
      prefix += run.text;
    }
  };
  const pathMethods = {
    beginPath() { path = []; currentPoint = subpathStart = null; },
    moveTo(x: number, y: number) { const p = point(x, y); path.push({ op: "m", c: [p.x, p.y] }); currentPoint = subpathStart = p; },
    lineTo(x: number, y: number) { const p = point(x, y); if (!currentPoint) pathMethods.moveTo(x, y); else { path.push({ op: "l", c: [p.x, p.y] }); currentPoint = p; } },
    bezierCurveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
      if (!currentPoint) pathMethods.moveTo(x1, y1);
      const a = point(x1, y1), b = point(x2, y2), end = point(x, y);
      path.push({ op: "c", c: [a.x, a.y, b.x, b.y, end.x, end.y] }); currentPoint = end;
    },
    quadraticCurveTo(x1: number, y1: number, x: number, y: number) {
      if (!currentPoint) pathMethods.moveTo(x1, y1);
      const control = point(x1, y1), end = point(x, y), start = currentPoint!;
      path.push({ op: "c", c: [start.x + (control.x - start.x) * 2 / 3, start.y + (control.y - start.y) * 2 / 3, end.x + (control.x - end.x) * 2 / 3, end.y + (control.y - end.y) * 2 / 3, end.x, end.y] }); currentPoint = end;
    },
    closePath() { if (currentPoint) { path.push({ op: "h", c: [] }); currentPoint = subpathStart; } },
    rect(x: number, y: number, width: number, height: number) { pathMethods.moveTo(x, y); pathMethods.lineTo(x + width, y); pathMethods.lineTo(x + width, y + height); pathMethods.lineTo(x, y + height); pathMethods.closePath(); },
    ellipse(x: number, y: number, rx: number, ry: number, rotation: number, start: number, end: number, anticlockwise = false) {
      const circle = Math.PI * 2;
      let sweep = end - start;
      if (!anticlockwise) sweep = sweep >= circle ? circle : ((sweep % circle) + circle) % circle;
      else sweep = -sweep >= circle ? -circle : -(((-sweep % circle) + circle) % circle);
      const steps = Math.ceil(Math.abs(sweep) / (Math.PI / 2));
      const mapped = (angle: number) => ({ x: x + rx * Math.cos(angle) * Math.cos(rotation) - ry * Math.sin(angle) * Math.sin(rotation), y: y + rx * Math.cos(angle) * Math.sin(rotation) + ry * Math.sin(angle) * Math.cos(rotation) });
      const tangent = (angle: number) => ({ x: -rx * Math.sin(angle) * Math.cos(rotation) - ry * Math.cos(angle) * Math.sin(rotation), y: -rx * Math.sin(angle) * Math.sin(rotation) + ry * Math.cos(angle) * Math.cos(rotation) });
      const first = mapped(start);
      if (currentPoint) pathMethods.lineTo(first.x, first.y); else pathMethods.moveTo(first.x, first.y);
      for (let step = 0; step < steps; step++) {
        const a = start + sweep * step / steps, b = start + sweep * (step + 1) / steps;
        const k = 4 / 3 * Math.tan((b - a) / 4), p = mapped(a), q = mapped(b), t = tangent(a), u = tangent(b);
        pathMethods.bezierCurveTo(p.x + t.x * k, p.y + t.y * k, q.x - u.x * k, q.y - u.y * k, q.x, q.y);
      }
    },
    arc(x: number, y: number, radius: number, start: number, end: number, anticlockwise = false) { pathMethods.ellipse(x, y, radius, radius, 0, start, end, anticlockwise); },
  };
  const rectangle = (x: number, y: number, width: number, height: number, stroke: boolean) => {
    const previous = path, previousPoint = currentPoint, previousStart = subpathStart;
    pathMethods.beginPath(); pathMethods.rect(x, y, width, height); paintPath(stroke);
    path = previous; currentPoint = previousPoint; subpathStart = previousStart;
  };
  const methods: Record<string, unknown> = {
    ...pathMethods,
    save() { states.push({ fill: fillStyle, stroke: strokeStyle }); measure.save(); pdf.saveGraphicsState(); },
    restore() { const state = states.pop(); if (!state) return; measure.restore(); pdf.restoreGraphicsState(); fillStyle = state.fill; strokeStyle = state.stroke; },
    setTransform(...args: unknown[]) { if (typeof args[0] === "object") measure.setTransform(args[0] as DOMMatrix2DInit); else measure.setTransform(...args as [number, number, number, number, number, number]); },
    fill(rule: CanvasFillRule = "nonzero") { paintPath(false, rule); },
    stroke() { paintPath(true); },
    clip(rule: CanvasFillRule = "nonzero") { if (!path.length) return; pdf.path(path); if (rule === "evenodd") pdf.clipEvenOdd(); else pdf.clip(); pdf.discardPath(); },
    fillRect(x: number, y: number, width: number, height: number) { rectangle(x, y, width, height, false); },
    strokeRect(x: number, y: number, width: number, height: number) { rectangle(x, y, width, height, true); },
    clearRect() { /* Pages start empty; html2canvas does not erase already drawn content. */ },
    fillText(text: string, x: number, y: number, maxWidth?: number) { drawText(text, x, y, false, maxWidth); },
    strokeText(text: string, x: number, y: number, maxWidth?: number) { drawText(text, x, y, true, maxWidth); },
    drawImage,
    createPattern(image: CanvasImageSource, repetition: string) { return { __pdfPattern: true, image, repetition }; },
    createLinearGradient(...args: number[]) { const gradient: Gradient & { addColorStop: (position: number, color: string) => void } = { __pdfGradient: true, kind: "linear", args, stops: [], addColorStop(position, color) { this.stops.push([position, color]); } }; return gradient; },
    createRadialGradient(...args: number[]) { const gradient: Gradient & { addColorStop: (position: number, color: string) => void } = { __pdfGradient: true, kind: "radial", args, stops: [], addColorStop(position, color) { this.stops.push([position, color]); } }; return gradient; },
    createConicGradient(...args: number[]) { const gradient: Gradient & { addColorStop: (position: number, color: string) => void } = { __pdfGradient: true, kind: "conic", args, stops: [], addColorStop(position, color) { this.stops.push([position, color]); } }; return gradient; },
  };
  const context = new Proxy(measure, {
    get(target, key) {
      if (key === "fillStyle") return fillStyle;
      if (key === "strokeStyle") return strokeStyle;
      if (typeof key === "string" && key in methods) return methods[key];
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
    set(target, key, value) {
      if (key === "fillStyle") { fillStyle = value; if (typeof value === "string") target.fillStyle = value; return true; }
      if (key === "strokeStyle") { strokeStyle = value; if (typeof value === "string") target.strokeStyle = value; return true; }
      return Reflect.set(target, key, value, target);
    },
  });
  Object.defineProperty(canvas, "getContext", { configurable: true, value: (type: string) => type === "2d" ? context : null });
  return canvas;
}
