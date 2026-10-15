import type { jsPDF } from "jspdf";

export interface PdfGradientDescriptor {
  kind: "linear" | "radial" | "conic";
  args: readonly number[];
  stops: readonly (readonly [number, string])[];
}
export interface PdfGradientTransform { a: number; b: number; c: number; d: number; e: number; f: number }
export interface PdfGradientPath { op: "m" | "l" | "c" | "h"; c: number[] }
type Rgba = readonly [number, number, number, number];
const patterns = new WeakMap<jsPDF, Map<string, string>>();
const namedColors: Record<string, Rgba> = {
  black: [0, 0, 0, 1], white: [255, 255, 255, 1], red: [255, 0, 0, 1],
  green: [0, 128, 0, 1], blue: [0, 0, 255, 1], yellow: [255, 255, 0, 1],
  gray: [128, 128, 128, 1], grey: [128, 128, 128, 1], transparent: [0, 0, 0, 0],
};

function color(value: string): Rgba | null {
  const source = value.trim().toLowerCase();
  if (namedColors[source]) return namedColors[source];
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(source)?.[1];
  if (hex) {
    const expanded = hex.length === 3 ? [...hex].map((part) => part + part).join("") : hex;
    return [parseInt(expanded.slice(0, 2), 16), parseInt(expanded.slice(2, 4), 16), parseInt(expanded.slice(4, 6), 16), 1];
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(source);
  if (!rgb) return null;
  const channels = rgb.slice(1, 4).map(Number);
  const opacity = rgb[4] === undefined ? 1 : Number(rgb[4]);
  if (channels.some((channel) => !Number.isFinite(channel) || channel < 0 || channel > 255) || !Number.isFinite(opacity) || opacity < 0 || opacity > 1) return null;
  return [channels[0], channels[1], channels[2], opacity];
}

/**
 * Paint a smooth CSS gradient as a reusable PDF shading, keeping the supplied
 * path and its existing clipping region. Return false without drawing when
 * pixel rendering is needed to preserve the gradient's appearance.
 */
export function drawPdfGradient(
  pdf: jsPDF,
  gradient: PdfGradientDescriptor,
  path: readonly PdfGradientPath[],
  transform: PdfGradientTransform,
  opacity = 1,
  rule: CanvasFillRule = "nonzero",
): boolean {
  if (gradient.kind !== "linear" && gradient.kind !== "radial") return false;
  const expectedArgs = gradient.kind === "linear" ? 4 : 6;
  if (gradient.args.length !== expectedArgs || !gradient.args.every(Number.isFinite) || !path.length || ![transform.a, transform.b, transform.c, transform.d, transform.e, transform.f].every(Number.isFinite)
    || !Number.isFinite(opacity) || opacity < 0 || opacity > 1 || Math.abs(transform.a * transform.d - transform.b * transform.c) < 1e-12) return false;
  if (gradient.kind === "linear" && gradient.args[0] === gradient.args[2] && gradient.args[1] === gradient.args[3]) return false;
  if (gradient.kind === "radial" && (gradient.args[2] !== 0 || gradient.args[5] <= 0 || gradient.args[0] !== gradient.args[3] || gradient.args[1] !== gradient.args[4])) return false;

  const stops: { offset: number; color: number[]; alpha: number }[] = [];
  for (const [offset, value] of gradient.stops) {
    const parsed = color(value);
    if (!parsed || !Number.isFinite(offset) || offset < 0 || offset > 1 || (stops.length && offset < stops.at(-1)!.offset)) return false;
    const previous = stops.at(-1);
    if (previous && offset === previous.offset) {
      if (previous.color.some((channel, index) => channel !== parsed[index]) || previous.alpha !== parsed[3]) return false;
      continue;
    }
    stops.push({ offset, color: parsed.slice(0, 3), alpha: parsed[3] });
  }
  if (!stops.length || stops.some((stop) => Math.abs(stop.alpha - stops[0].alpha) > 1e-8)) return false;
  if (stops[0].offset > 0) stops.unshift({ ...stops[0], offset: 0 });
  if (stops.at(-1)!.offset < 1) stops.push({ ...stops.at(-1)!, offset: 1 });
  // jsPDF encodes 21 equally-spaced color samples. Keep non-aligned breaks as
  // pixels rather than blur sharp or tightly-spaced transitions at any quality.
  if (stops.some((stop) => Math.abs(stop.offset * 20 - Math.round(stop.offset * 20)) > 1e-8)) return false;
  const alpha = opacity * stops[0].alpha;
  if (alpha === 0) return true;
  let cache = patterns.get(pdf);
  if (!cache) { cache = new Map(); patterns.set(pdf, cache); }
  const signature = JSON.stringify([gradient.kind, gradient.args, stops.map(({ offset, color: rgb }) => ({ offset, color: rgb }))]);
  let key = cache.get(signature);
  pdf.advancedAPI(() => {
    if (!key) {
      key = `hms-gradient-${cache!.size + 1}`;
      const pattern = pdf.ShadingPattern(gradient.kind === "linear" ? "axial" : "radial", [...gradient.args], stops.map(({ offset, color: rgb }) => ({ offset, color: rgb })));
      pdf.addShadingPattern(key, pattern);
      cache!.set(signature, key);
    }
    pdf.saveGraphicsState();
    try {
      pdf.setGState(pdf.GState({ opacity: alpha, "stroke-opacity": alpha }));
      pdf.path([...path]);
      const paint = { key: key!, matrix: pdf.Matrix(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f) };
      if (rule === "evenodd") pdf.fillEvenOdd(paint);
      else pdf.fill(paint);
    } finally { pdf.restoreGraphicsState(); }
  });
  return true;
}
