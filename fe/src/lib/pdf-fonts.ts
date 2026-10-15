import type { HTMLFontFace, jsPDF } from "jspdf";
import coverage from "../../public/pdf/fonts/coverage.json" with { type: "json" };

type FontFamily = "sans" | "serif" | "mono" | "geist";
type PdfFontFace = HTMLFontFace & { ref: { name: string; style: string } };
type FontSelection = { family: FontFamily; weight: number; italic: boolean; known: boolean };
export type PdfTextFont = { family: string; style: string; supported: boolean };
export type PdfTextFontRun = { text: string; fontFamily: string; fontStyle: string; supported: boolean };

const FONT_ROOT = "/pdf/fonts/";
const pdfNames: Record<FontFamily, string> = {
  sans: "HMSLiberationSans", serif: "HMSLiberationSerif", mono: "HMSLiberationMono", geist: "HMSGeist",
};
const aliases: Record<FontFamily, string[]> = {
  sans: ["Arial", "Helvetica", "Helvetica Neue", "sans-serif", "HMSLiberationSans"],
  serif: ["Times", "Times New Roman", "serif", "HMSLiberationSerif"],
  mono: ["Courier", "Courier New", "monospace", "HMSLiberationMono"],
  geist: ["Geist", "Geist Fallback", "HMS Geist", "HMSGeist"],
};
const fontData = new Map<string, Promise<string>>();

function selectFont(css: string): FontSelection {
  const size = /(?:\d*\.)?\d+(?:px|pt|em|rem|%)\s*(?:\/\s*[^\s]+\s+)?/i.exec(css);
  const prefix = size ? css.slice(0, size.index) : "";
  const familyList = (size ? css.slice(size.index + size[0].length) : css)
    .split(",").map((value) => value.trim().replace(/^["']|["']$/g, ""));
  const italic = /\b(?:italic|oblique)\b/i.test(prefix);
  const explicitWeight = /\b([1-9]00)\b/.exec(prefix)?.[1];
  const weight = explicitWeight ? Number(explicitWeight) : /\bbold(?:er)?\b/i.test(prefix) ? 700 : 400;
  for (const value of familyList) {
    if (/geist/i.test(value) && !/mono/i.test(value)) return { family: "geist", weight, italic, known: true };
    for (const family of ["sans", "serif", "mono"] as const) {
      if (aliases[family].some((alias) => alias.toLowerCase() === value.toLowerCase())) {
        return { family, weight, italic, known: true };
      }
    }
  }
  return { family: "sans", weight, italic, known: false };
}

function fontStyle(selection: FontSelection): string {
  if (selection.family !== "geist") return `${selection.weight >= 600 ? "bold" : ""}${selection.italic ? "italic" : ""}` || "normal";
  if (selection.weight <= 400) return "normal";
  if (selection.weight === 700) return "bold";
  return `${Math.min(900, Math.max(500, Math.round(selection.weight / 100) * 100))}normal`;
}

function fontPath(selection: FontSelection): string {
  if (selection.family === "geist") return selection.weight <= 400 ? "/wifi/Geist-Regular.ttf" : `${FONT_ROOT}HMSGeist-${Math.min(900, Math.max(500, Math.round(selection.weight / 100) * 100))}.ttf`;
  const family = { sans: "Sans", serif: "Serif", mono: "Mono" }[selection.family];
  const style = `${selection.weight >= 600 ? "Bold" : ""}${selection.italic ? "Italic" : ""}` || "Regular";
  return `${FONT_ROOT}Liberation${family}-${style}.ttf`;
}

function containsGlyph(selection: FontSelection, character: string): boolean {
  const code = character.codePointAt(0)!;
  if (code === 9 || code === 10 || code === 13) return true;
  const key = selection.family === "geist" && selection.weight > 400 ? "geistWeighted" : selection.family;
  return coverage[key].some(([first, last]) => code >= first && code <= last);
}

/** Resolve the embedded font; unsupported scripts must retain browser rendering. */
export function resolvePdfTextFont(css: string, text: string): PdfTextFont {
  const selected = selectFont(css);
  return {
    family: pdfNames[selected.family], style: fontStyle(selected),
    supported: selected.known && !(selected.family === "geist" && selected.italic) && Array.from(text).every((character) => containsGlyph(selected, character)),
  };
}

/** Split only the currency fallback; keep complex script runs intact for raster fallback. */
export function splitPdfTextFontRuns(css: string, text: string): PdfTextFontRun[] {
  const selected = selectFont(css);
  const normal = resolvePdfTextFont(css, text);
  const fallback = { ...selected, family: "geist" as const, italic: false };
  if (!selected.known || (selected.family === "geist" && selected.italic) || Array.from(text).some((character) => !containsGlyph(selected, character) && (character !== "₹" || !containsGlyph(fallback, character)))) {
    return [{ text, fontFamily: normal.family, fontStyle: normal.style, supported: false }];
  }
  const runs: PdfTextFontRun[] = [];
  for (const character of text) {
    const selection = containsGlyph(selected, character) ? selected : fallback;
    const family = pdfNames[selection.family];
    const style = fontStyle(selection);
    const last = runs[runs.length - 1];
    if (last?.fontFamily === family && last.fontStyle === style) last.text += character;
    else runs.push({ text: character, fontFamily: family, fontStyle: style, supported: true });
  }
  return runs;
}

async function loadFont(path: string): Promise<string> {
  let pending = fontData.get(path);
  if (!pending) {
    pending = fetch(path).then(async (response) => {
      if (!response.ok) throw new Error(`Unable to load the PDF font ${path} (${response.status}).`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      return btoa(binary);
    }).catch((reason: unknown) => { fontData.delete(path); throw reason; });
    fontData.set(path, pending);
  }
  return pending;
}

/** Load only recorded font styles; jsPDF subsets the glyphs actually written. */
export async function registerPdfFonts(
  pdf: jsPDF,
  document?: Document,
  fonts: Set<string> = new Set(["400 12px Arial", "700 12px Arial"]),
): Promise<PdfFontFace[]> {
  await document?.fonts?.ready;
  const selections = new Map<string, FontSelection>();
  for (const css of fonts) {
    const selected = selectFont(css);
    selections.set(`${selected.family}:${fontStyle(selected)}`, selected);
    // Currency can use Geist even when all surrounding text uses Arial/Times.
    const fallback = { ...selected, family: "geist" as const, italic: false };
    selections.set(`geist:${fontStyle(fallback)}`, fallback);
  }
  const faces: PdfFontFace[] = [];
  await Promise.all(Array.from(selections.values(), async (selected) => {
    const path = fontPath(selected);
    const fileName = path.split("/").pop()!;
    const data = await loadFont(path);
    if (!pdf.existsFileInVFS(fileName)) pdf.addFileToVFS(fileName, data);
    const name = pdfNames[selected.family];
    const style = fontStyle(selected);
    if (!pdf.getFontList()[name]?.includes(style)) pdf.addFont(fileName, name, style);
    for (const alias of aliases[selected.family]) {
      faces.push({ family: alias, style: selected.italic ? "italic" : "normal", weight: (selected.family === "geist" ? Math.max(400, selected.weight) : selected.weight >= 600 ? 700 : 400) as HTMLFontFace["weight"], src: [{ url: path, format: "truetype" }], ref: { name, style } });
    }
  }));
  return faces;
}
