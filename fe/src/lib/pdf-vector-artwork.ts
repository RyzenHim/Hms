/** Small, validated SVG subset for PDF artwork. Unsupported artwork stays an image. */
export interface PdfPathContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  globalAlpha: number;
  save(): void;
  restore(): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(a: number, b: number, c: number, d: number, x: number, y: number): void;
  quadraticCurveTo(a: number, b: number, x: number, y: number): void;
  closePath(): void;
  fill(rule?: CanvasFillRule): void;
  stroke(): void;
  // jsPDF's canvas adapter ignores the evenodd argument to fill().
  pdf?: unknown;
}

export interface PdfArtworkBox { x: number; y: number; width: number; height: number }
type PathCommand = { op: "M" | "L" | "C" | "Q" | "Z"; values: number[] };
type Paint = { fill: string; stroke: string; strokeWidth: number; opacity: number; fillOpacity: number; strokeOpacity: number; fillRule: CanvasFillRule };
type Shape = { path: PathCommand[]; paint: Paint };
export interface PdfSvgArtwork {
  viewBox: readonly [number, number, number, number];
  preserveAspectRatio: string;
  shapes: readonly Shape[];
}
const numberPattern = /[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi;
const basePaint: Paint = { fill: "black", stroke: "none", strokeWidth: 1, opacity: 1, fillOpacity: 1, strokeOpacity: 1, fillRule: "nonzero" };
const supportedPaintProperties = ["fill", "stroke", "stroke-width", "fill-rule", "opacity", "fill-opacity", "stroke-opacity"];

function xmlValue(value: string): string {
  return value.replace(/&#(x[\da-f]+|\d+);|&(amp|quot|apos|lt|gt);/gi, (_, numeric: string, named: string) => {
    if (numeric) return String.fromCodePoint(numeric[0].toLowerCase() === "x" ? parseInt(numeric.slice(1), 16) : Number(numeric));
    return ({ amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" } as Record<string, string>)[named.toLowerCase()];
  });
}

function attributes(source: string): Record<string, string> {
  const result: Record<string, string> = {};
  const remaining = source.replace(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g, (_, key: string, quoted: string, single: string) => {
    result[key] = xmlValue(quoted ?? single);
    return "";
  });
  if (remaining.trim()) throw new Error("Unsupported SVG attributes");
  return result;
}

function declarations(source: string): Record<string, string> {
  return Object.fromEntries(source.split(";").filter((part) => part.trim()).map((part) => {
    const split = part.indexOf(":");
    if (split < 0) throw new Error("Unsupported SVG style");
    return [part.slice(0, split).trim(), part.slice(split + 1).trim()];
  }));
}

function numbers(source: string): number[] {
  const result = [...source.matchAll(numberPattern)].map((match) => Number(match[0]));
  if (source.replace(numberPattern, "").replace(/[\s,]/g, "") || result.some((value) => !Number.isFinite(value))) throw new Error("Invalid SVG numbers");
  return result;
}

function paintFor(attrs: Record<string, string>, inherited: Paint, classes: Map<string, Record<string, string>>, root = false): Paint {
  const inlineStyle = declarations(attrs.style || "");
  if (Object.keys(inlineStyle).some((key) => ![...supportedPaintProperties, "enable-background", ...(root ? ["width", "height"] : [])].includes(key))) throw new Error("Unsupported SVG style");
  const css = Object.assign({}, ...((attrs.class || "").split(/\s+/).map((name) => classes.get(name) || {})), attrs, inlineStyle);
  for (const key of ["transform", "filter", "mask", "clip-path", "marker-start", "marker-end", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "vector-effect"]) {
    if (css[key] && css[key] !== "none") throw new Error("Unsupported SVG effect");
  }
  const fill = css.fill ?? inherited.fill;
  const stroke = css.stroke ?? inherited.stroke;
  if ([fill, stroke].some((color) => !/^(?:none|#(?:[\da-f]{3}|[\da-f]{6})|[a-z]+|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\))$/i.test(color)
    || /^(?:currentcolor|inherit|initial|unset|revert|transparent)$/i.test(color))) throw new Error("Unsupported SVG paint");
  const fillRule = css["fill-rule"] ?? inherited.fillRule;
  if (fillRule !== "nonzero" && fillRule !== "evenodd") throw new Error("Unsupported SVG fill rule");
  const strokeWidth = css["stroke-width"] === undefined ? inherited.strokeWidth : Number(css["stroke-width"]);
  const opacity = inherited.opacity * (css.opacity === undefined ? 1 : Number(css.opacity));
  const fillOpacity = css["fill-opacity"] === undefined ? inherited.fillOpacity : Number(css["fill-opacity"]);
  const strokeOpacity = css["stroke-opacity"] === undefined ? inherited.strokeOpacity : Number(css["stroke-opacity"]);
  if (!Number.isFinite(strokeWidth) || strokeWidth < 0 || [opacity, fillOpacity, strokeOpacity].some((value) => !Number.isFinite(value) || value < 0 || value > 1)) throw new Error("Unsupported SVG paint dimensions");
  return { fill, stroke, strokeWidth, opacity, fillOpacity, strokeOpacity, fillRule };
}

/** Preserve subpath directions, including the supplied Airtel wordmark's holes. */
function parsePath(source: string): PathCommand[] {
  const tokens = source.match(/[a-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) || [];
  if (source.replace(/[a-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi, "").replace(/[\s,]/g, "")) throw new Error("Invalid SVG path");
  const result: PathCommand[] = [];
  let index = 0, command = "", x = 0, y = 0, startX = 0, startY = 0;
  let cubic: number[] | null = null, quadratic: number[] | null = null;
  while (index < tokens.length) {
    if (/^[a-z]$/i.test(tokens[index])) command = tokens[index++];
    const upper = command.toUpperCase();
    const relative = command !== upper;
    if (upper === "Z") {
      result.push({ op: "Z", values: [] }); x = startX; y = startY; cubic = quadratic = null; command = "";
      continue;
    }
    const count = ({ M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2 } as Record<string, number>)[upper];
    if (!count || index + count > tokens.length) throw new Error("Unsupported SVG path command");
    const values = tokens.slice(index, index + count).map(Number);
    if (values.some((value) => !Number.isFinite(value))) throw new Error("Invalid SVG path command");
    index += count;
    const point = (a: number, b: number): [number, number] => [a + (relative ? x : 0), b + (relative ? y : 0)];
    let next: PathCommand;
    if (upper === "M" || upper === "L") {
      const end = point(values[0], values[1]); next = { op: upper, values: end };
      if (upper === "M") { [startX, startY] = end; command = relative ? "l" : "L"; }
    } else if (upper === "H") next = { op: "L", values: [values[0] + (relative ? x : 0), y] };
    else if (upper === "V") next = { op: "L", values: [x, values[0] + (relative ? y : 0)] };
    else if (upper === "C") next = { op: "C", values: [...point(values[0], values[1]), ...point(values[2], values[3]), ...point(values[4], values[5])] };
    else if (upper === "S") next = { op: "C", values: [...(cubic ? [2 * x - cubic[0], 2 * y - cubic[1]] : [x, y]), ...point(values[0], values[1]), ...point(values[2], values[3])] };
    else if (upper === "Q") next = { op: "Q", values: [...point(values[0], values[1]), ...point(values[2], values[3])] };
    else next = { op: "Q", values: [...(quadratic ? [2 * x - quadratic[0], 2 * y - quadratic[1]] : [x, y]), ...point(values[0], values[1])] };
    result.push(next);
    [x, y] = next.values.slice(-2);
    cubic = next.op === "C" ? next.values.slice(2, 4) : null;
    quadratic = next.op === "Q" ? next.values.slice(0, 2) : null;
  }
  if (!result.length || result[0].op !== "M") throw new Error("SVG path must start with a move");
  return result;
}

function shapePath(tag: string, attrs: Record<string, string>): PathCommand[] {
  if (tag === "path") return parsePath(attrs.d || "");
  if (tag === "circle" || tag === "ellipse") {
    const [cx, cy, rx, ry] = [attrs.cx || "0", attrs.cy || "0", tag === "circle" ? attrs.r : attrs.rx, tag === "circle" ? attrs.r : attrs.ry].map(Number);
    if (![cx, cy, rx, ry].every(Number.isFinite) || rx < 0 || ry < 0) throw new Error("Invalid SVG ellipse");
    const k = 0.5522847498307936;
    return [
      { op: "M", values: [cx + rx, cy] },
      { op: "C", values: [cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry] },
      { op: "C", values: [cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy] },
      { op: "C", values: [cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry] },
      { op: "C", values: [cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy] },
      { op: "Z", values: [] },
    ];
  }
  if (tag === "rect") {
    if (Number(attrs.rx || 0) || Number(attrs.ry || 0)) throw new Error("Rounded SVG rectangle");
    const [x, y, width, height] = [attrs.x || "0", attrs.y || "0", attrs.width, attrs.height].map(Number);
    if (![x, y, width, height].every(Number.isFinite) || width < 0 || height < 0) throw new Error("Invalid SVG rectangle");
    return [{ op: "M", values: [x, y] }, { op: "L", values: [x + width, y] }, { op: "L", values: [x + width, y + height] }, { op: "L", values: [x, y + height] }, { op: "Z", values: [] }];
  }
  if (tag === "polygon" || tag === "polyline") {
    const points = numbers(attrs.points || "");
    if (points.length < 4 || points.length % 2) throw new Error("Invalid SVG polygon");
    const path: PathCommand[] = [];
    for (let index = 0; index < points.length; index += 2) path.push({ op: index ? "L" : "M", values: points.slice(index, index + 2) });
    if (tag === "polygon") path.push({ op: "Z", values: [] });
    return path;
  }
  throw new Error("Unsupported SVG shape");
}

/** Return null before drawing if an SVG needs features this PDF path cannot preserve. */
export function parseSvgArtwork(source: string): PdfSvgArtwork | null {
  try {
    const classes = new Map<string, Record<string, string>>();
    let svg = source.replace(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>/g, "").replace(/<(metadata|title|desc)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
    svg = svg.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, (_, body: string) => {
      const leftover = body.replace(/\.([\w-]+)\s*\{([^}]+)\}/g, (_match, name: string, content: string) => {
        const properties = declarations(content);
        if (Object.keys(properties).some((property) => !supportedPaintProperties.includes(property))) throw new Error("Unsupported SVG CSS");
        classes.set(name, properties); return "";
      });
      if (leftover.trim()) throw new Error("Unsupported SVG CSS selector");
      return "";
    });
    const stack: { tag: string; paint: Paint }[] = [];
    let viewBox: [number, number, number, number] | null = null;
    let preserveAspectRatio = "xMidYMid meet";
    const shapes: Shape[] = [];
    const leftover = svg.replace(/<\s*(\/?)\s*([\w:-]+)\b([^>]*?)(\/?)\s*>/g, (_match, closing: string, tag: string, raw: string, selfClosing: string) => {
      if (closing) {
        if (stack.pop()?.tag !== tag) throw new Error("Invalid SVG nesting");
        return "";
      }
      if (!["svg", "g", "path", "rect", "polygon", "polyline", "circle", "ellipse"].includes(tag)) throw new Error("Unsupported SVG element");
      const attrs = attributes(raw);
      const supportedAttributes = ["id", "version", "xmlns", "xmlns:xlink", "xml:space", "x", "y", "width", "height", "viewBox", "preserveAspectRatio", "class", "style", ...supportedPaintProperties, "d", "rx", "ry", "cx", "cy", "r", "points", "role", "focusable", "shape-rendering"];
      if (Object.keys(attrs).some((key) => !supportedAttributes.includes(key) && !/^(?:aria-|data-)/.test(key))) throw new Error("Unsupported SVG attribute");
      const inherited = stack.at(-1)?.paint || basePaint;
      const paint = paintFor(attrs, inherited, classes, tag === "svg");
      if ((tag === "g" || tag === "svg") && paint.opacity !== inherited.opacity) throw new Error("Unsupported SVG group opacity");
      if (tag === "svg") {
        if (viewBox || stack.length) throw new Error("Nested SVG");
        const bounds = attrs.viewBox ? numbers(attrs.viewBox) : [0, 0, Number(attrs.width), Number(attrs.height)];
        if (bounds.length !== 4 || !bounds.every(Number.isFinite) || bounds[2] <= 0 || bounds[3] <= 0) throw new Error("Invalid SVG viewBox");
        viewBox = bounds as [number, number, number, number];
        preserveAspectRatio = attrs.preserveAspectRatio || preserveAspectRatio;
        if (!/^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?: meet)?)$/.test(preserveAspectRatio)) throw new Error("Unsupported SVG aspect ratio");
      } else if (tag !== "g") shapes.push({ path: shapePath(tag, attrs), paint });
      if (!selfClosing) stack.push({ tag, paint });
      return "";
    });
    if (leftover.trim() || stack.length || !viewBox || !shapes.length) return null;
    return { viewBox, preserveAspectRatio, shapes };
  } catch { return null; }
}

type PdfGraphicsState = {
  GState?: new (values: { opacity: number; "stroke-opacity": number }) => unknown;
  setGState?: (state: unknown) => void;
  saveGraphicsState?: () => void;
  restoreGraphicsState?: () => void;
};

function paintAlpha(context: PdfPathContext, opacity: number): void {
  context.globalAlpha = opacity;
  // jsPDF keeps globalAlpha as canvas state but does not emit PDF opacity.
  // Set it explicitly when painting directly to that adapter.
  const pdf = context.pdf as PdfGraphicsState | undefined;
  if (pdf?.GState && pdf.setGState) pdf.setGState(new pdf.GState({ opacity, "stroke-opacity": opacity }));
}

/** Paint vectors using the current canvas transform and clipping region. */
export function drawSvgArtwork(context: PdfPathContext, source: string | PdfSvgArtwork, box: PdfArtworkBox): boolean {
  const artwork = typeof source === "string" ? parseSvgArtwork(source) : source;
  if (!artwork || ![box.x, box.y, box.width, box.height].every(Number.isFinite) || box.width <= 0 || box.height <= 0) return false;
  if (context.pdf && artwork.shapes.some((shape) => shape.paint.fillRule === "evenodd")) return false;
  const [minX, minY, width, height] = artwork.viewBox;
  let sx = box.width / width, sy = box.height / height;
  let x = box.x, y = box.y;
  if (artwork.preserveAspectRatio !== "none") {
    sx = sy = Math.min(sx, sy);
    x += (box.width - width * sx) * (artwork.preserveAspectRatio.includes("xMax") ? 1 : artwork.preserveAspectRatio.includes("xMin") ? 0 : 0.5);
    y += (box.height - height * sy) * (artwork.preserveAspectRatio.includes("YMax") ? 1 : artwork.preserveAspectRatio.includes("YMin") ? 0 : 0.5);
  }
  if (sx !== sy && artwork.shapes.some(({ paint }) => paint.stroke !== "none" && paint.strokeWidth > 0)) return false;
  const mapped = (values: number[]) => values.map((value, index) => index % 2 ? y + (value - minY) * sy : x + (value - minX) * sx);
  const alpha = context.globalAlpha;
  const pdf = context.pdf as PdfGraphicsState | undefined;
  context.save();
  // This pair also invalidates jsPDF's opacity cache when restoring; its
  // context2d.restore() emits raw Q and does not invalidate that cache itself.
  pdf?.saveGraphicsState?.();
  try {
    for (const { path, paint } of artwork.shapes) {
      if (paint.fill !== "none") context.fillStyle = paint.fill;
      if (paint.stroke !== "none") context.strokeStyle = paint.stroke;
      context.lineWidth = paint.strokeWidth * Math.min(sx, sy);
      context.beginPath();
      for (const command of path) {
        const v = mapped(command.values);
        if (command.op === "M") context.moveTo(v[0], v[1]);
        else if (command.op === "L") context.lineTo(v[0], v[1]);
        else if (command.op === "C") context.bezierCurveTo(v[0], v[1], v[2], v[3], v[4], v[5]);
        else if (command.op === "Q") context.quadraticCurveTo(v[0], v[1], v[2], v[3]);
        else context.closePath();
      }
      if (paint.fill !== "none") { paintAlpha(context, alpha * paint.opacity * paint.fillOpacity); context.fill(paint.fillRule); }
      if (paint.stroke !== "none" && paint.strokeWidth > 0) { paintAlpha(context, alpha * paint.opacity * paint.strokeOpacity); context.stroke(); }
    }
  } finally { pdf?.restoreGraphicsState?.(); context.restore(); }
  return true;
}

export interface PdfQrModules { size: number; data: ArrayLike<number | boolean> }

/** Merge adjacent dark modules into vector bars; keep the QR quiet zone intact. */
export function drawQrModules(context: PdfPathContext, modules: PdfQrModules, box: PdfArtworkBox, quietZone = 4): boolean {
  if (!Number.isInteger(modules.size) || modules.size <= 0 || modules.data.length !== modules.size ** 2 || !Number.isInteger(quietZone) || quietZone < 0 || ![box.x, box.y, box.width, box.height].every(Number.isFinite) || box.width <= 0 || box.height <= 0) return false;
  const size = Math.min(box.width, box.height);
  const unit = size / (modules.size + 2 * quietZone);
  const x = box.x + (box.width - size) / 2, y = box.y + (box.height - size) / 2;
  const rectangle = (left: number, top: number, width: number, height: number) => {
    context.moveTo(left, top); context.lineTo(left + width, top); context.lineTo(left + width, top + height); context.lineTo(left, top + height); context.closePath();
  };
  context.save();
  try {
    context.fillStyle = "white";
    context.beginPath(); rectangle(x, y, size, size); context.fill();
    context.fillStyle = "black";
    context.beginPath();
    for (let row = 0; row < modules.size; row++) {
      for (let column = 0; column < modules.size;) {
        if (!modules.data[row * modules.size + column]) { column++; continue; }
        const start = column;
        while (column < modules.size && modules.data[row * modules.size + column]) column++;
        rectangle(x + (start + quietZone) * unit, y + (row + quietZone) * unit, (column - start) * unit, unit);
      }
    }
    context.fill();
  } finally { context.restore(); }
  return true;
}
