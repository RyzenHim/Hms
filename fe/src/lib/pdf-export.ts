export type PdfPageToRender = {
  element: HTMLDivElement;
  label: string;
};

export type PdfRenderOptions = {
  scale?: number;
  jpegQuality?: number;
  imageFormat?: "JPEG" | "PNG";
};

type Rectangle = Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width" | "height">;

export const PDF_QUALITY_PRESETS = [
  { id: "compact", label: "Compact", description: "Smallest file for quick sharing", scale: 1, jpegQuality: 0.72, imageFormat: "JPEG" },
  { id: "normal", label: "Normal", description: "Balanced clarity and file size", scale: 2, jpegQuality: 0.9, imageFormat: "JPEG" },
  { id: "high", label: "High", description: "Sharper text and images for printing", scale: 3, jpegQuality: 0.95, imageFormat: "JPEG" },
  { id: "ultra", label: "Ultra", description: "Maximum resolution for fine details", scale: 4, jpegQuality: 0.98, imageFormat: "JPEG" },
  { id: "lossless", label: "Lossless", description: "Maximum resolution without JPEG artifacts", scale: 4, jpegQuality: 1, imageFormat: "PNG" },
] as const;

export type PdfQuality = typeof PDF_QUALITY_PRESETS[number]["id"];
export const DEFAULT_PDF_QUALITY: PdfQuality = "normal";
const DEFAULT_PDF_RENDER_SCALE = 2;
const DEFAULT_PDF_JPEG_QUALITY = 0.9;

export type PdfExportFile = { blob: Blob; label: string };
export type PdfQualityResult = { files: PdfExportFile[]; size: number };
export type PdfQualityResults = Record<PdfQuality, PdfQualityResult>;
type PdfDocument = import("jspdf").jsPDF;

export function formatPdfSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function createPdf(jsPDF: typeof import("jspdf").jsPDF): PdfDocument {
  return new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true, putOnlyUsedFonts: true, precision: 4 });
}

export function isSupportedPdfLink(value: string): boolean {
  try {
    return ["https:", "http:", "upi:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** Map a DOM link over the rasterized page into the PDF page's millimetres. */
export function mapPdfLinkBounds(
  page: Rectangle,
  link: Rectangle,
  renderedPage: { x: number; y: number; width: number; height: number },
) {
  const left = Math.max(page.left, link.left);
  const top = Math.max(page.top, link.top);
  const right = Math.min(page.right, link.right);
  const bottom = Math.min(page.bottom, link.bottom);
  if (right <= left || bottom <= top || page.width <= 0 || page.height <= 0) return null;
  const scaleX = renderedPage.width / page.width;
  const scaleY = renderedPage.height / page.height;
  return {
    x: renderedPage.x + (left - page.left) * scaleX,
    y: renderedPage.y + (top - page.top) * scaleY,
    width: (right - left) * scaleX,
    height: (bottom - top) * scaleY,
  };
}

export function addPdfLinkAnnotations(
  pdf: { link: (x: number, y: number, width: number, height: number, options: { url: string }) => void },
  page: HTMLDivElement,
  renderedPage: { x: number; y: number; width: number; height: number },
) {
  const pageBounds = page.getBoundingClientRect();
  for (const link of page.querySelectorAll<HTMLElement>("[data-pdf-link]")) {
    const url = link.dataset.pdfLink || "";
    if (!isSupportedPdfLink(url)) continue;
    const bounds = mapPdfLinkBounds(pageBounds, link.getBoundingClientRect(), renderedPage);
    if (bounds) pdf.link(bounds.x, bounds.y, bounds.width, bounds.height, { url });
  }
}

export type PdfVariantOptions = {
  separate?: boolean;
  signal?: AbortSignal;
  serialize?: (pdf: PdfDocument) => Blob;
  onProgress?: (page: number, total: number) => void;
};

async function capturePage(page: PdfPageToRender, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const [{ default: html2canvas }, { createPdfDisplayList }] = await Promise.all([
    import("html2canvas-pro"), import("./pdf-display-list.ts"),
  ]);
  await page.element.ownerDocument.fonts?.ready;
  signal?.throwIfAborted();
  const bounds = page.element.getBoundingClientRect();
  const width = bounds.width;
  const height = bounds.height;
  if (width <= 0 || height <= 0) throw new Error(`The selected PDF page “${page.label}” is not visible.`);
  const captureScale = Math.max(...PDF_QUALITY_PRESETS.map((preset) => preset.scale));
  const recording = createPdfDisplayList(page.element.ownerDocument, width * captureScale, height * captureScale);
  try {
    await html2canvas(page.element, {
      canvas: recording.canvas,
      // No full-page bitmap is allocated. A high recording scale preserves
      // the pixels of temporary filter/effect surfaces for every quality.
      scale: captureScale, useCORS: true, logging: false, backgroundColor: "#ffffff", allowTaint: false,
    });
    signal?.throwIfAborted();
    return { ...recording, width, height, captureScale, svgSources: await prepareSvgSources(page.element, recording.imageSources, signal) };
  } catch (error) {
    recording.dispose();
    throw error;
  }
}

async function prepareSvgSources(element: HTMLDivElement, sources: Set<string>, signal?: AbortSignal): Promise<Map<string, string>> {
  const svgSources = new Map<string, string>();
  for (const source of sources) {
    signal?.throwIfAborted();
    if (source.startsWith("data:image/svg+xml")) {
      const comma = source.indexOf(",");
      try {
        const value = source.slice(0, comma).includes(";base64") ? atob(source.slice(comma + 1)) : decodeURIComponent(source.slice(comma + 1));
        svgSources.set(source, value);
      } catch { /* Invalid or unsupported artwork stays an image. */ }
    } else if (/\.svg(?:[?#]|$)/i.test(source)) {
      const response = await fetch(source, { signal });
      if (!response.ok) throw new Error("Unable to load the SVG artwork for the PDF.");
      svgSources.set(source, await response.text());
    }
  }
  // QR images already validated by the bill flow become native module paths.
  const qrImages = element.querySelectorAll<HTMLImageElement>("img[data-pdf-qr]");
  if (qrImages.length) {
    const { default: QRCode } = await import("qrcode");
    for (const image of qrImages) {
      const payload = image.dataset.pdfQr;
      if (!payload || !isSupportedPdfLink(payload)) continue;
      const { modules } = QRCode.create(payload, { errorCorrectionLevel: "M" });
      const margin = 4;
      const size = modules.size + margin * 2;
      let path = "";
      for (let row = 0; row < modules.size; row++) {
        for (let column = 0; column < modules.size;) {
          if (!modules.data[row * modules.size + column]) { column++; continue; }
          const start = column;
          while (column < modules.size && modules.data[row * modules.size + column]) column++;
          const length = column - start;
          path += `M${start + margin} ${row + margin}h${length}v1h-${length}z`;
        }
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#ffffff"/><path d="${path}" fill="#000000"/></svg>`;
      svgSources.set(image.currentSrc || image.src, svg);
      svgSources.set(image.src, svg);
    }
  }
  return svgSources;
}

async function drawRecordedPage(
  pdf: PdfDocument,
  page: PdfPageToRender,
  recording: Awaited<ReturnType<typeof capturePage>>,
  options: PdfRenderOptions,
  addPage: boolean,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const [{ createNativePdfCanvas }, { registerPdfFonts, splitPdfTextFontRuns }, { replayPdfDisplayList }, { drawSvgArtwork }] = await Promise.all([
    import("./pdf-native-canvas.ts"), import("./pdf-fonts.ts"), import("./pdf-display-list.ts"), import("./pdf-vector-artwork.ts"),
  ]);
  await registerPdfFonts(pdf, page.element.ownerDocument, recording.fonts);
  signal?.throwIfAborted();
  if (addPage) pdf.addPage();
  const ratio = Math.min(pdf.internal.pageSize.getWidth() / recording.width, pdf.internal.pageSize.getHeight() / recording.height);
  const width = recording.width * ratio;
  const height = recording.height * ratio;
  const x = (pdf.internal.pageSize.getWidth() - width) / 2;
  const canvas = createNativePdfCanvas(pdf, page.element.ownerDocument, {
    scale: options.scale ?? DEFAULT_PDF_RENDER_SCALE,
    captureScale: recording.captureScale,
    jpegQuality: options.jpegQuality ?? DEFAULT_PDF_JPEG_QUALITY,
    imageFormat: options.imageFormat ?? "JPEG",
    svgSources: recording.svgSources,
    paintSvg: (context, svg, box) => drawSvgArtwork(context, svg, box),
    textRuns: splitPdfTextFontRuns,
  });
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create the PDF drawing context.");
  context.save();
  try {
    context.translate(x, 0);
    context.scale(ratio / recording.captureScale, ratio / recording.captureScale);
    replayPdfDisplayList(context, recording.commands);
  } finally {
    context.restore();
  }
  addPdfLinkAnnotations(pdf, page.element, { x, y: 0, width, height });
}

/** Preserve the browser's layout as native PDF text/paths and selected-quality artwork. */
export const buildOptimizedPdf = async (pages: PdfPageToRender[], options: PdfRenderOptions = {}) => {
  if (!pages.length) throw new Error("Select at least one page to generate a PDF.");
  const { jsPDF } = await import("jspdf");
  const pdf = createPdf(jsPDF);
  for (const [index, page] of pages.entries()) {
    const recording = await capturePage(page);
    try { await drawRecordedPage(pdf, page, recording, options, index > 0); }
    finally { recording.dispose(); }
  }
  return pdf;
};

/** Record each page once; retain native content and encode only artwork per quality. */
export async function buildPdfQualityVariants(pages: PdfPageToRender[], options: PdfVariantOptions = {}): Promise<PdfQualityResults> {
  if (!pages.length) throw new Error("Select at least one page to generate a PDF.");
  const { signal } = options;
  signal?.throwIfAborted();
  const { jsPDF } = await import("jspdf");
  const serialize = options.serialize ?? ((pdf: PdfDocument) => pdf.output("blob"));
  const variants = PDF_QUALITY_PRESETS.map((preset) => ({ preset, pdf: createPdf(jsPDF), files: [] as PdfExportFile[] }));
  for (const [index, page] of pages.entries()) {
    signal?.throwIfAborted();
    options.onProgress?.(index + 1, pages.length);
    const recording = await capturePage(page, signal);
    try {
      for (const variant of variants) {
        signal?.throwIfAborted();
        await drawRecordedPage(variant.pdf, page, recording, variant.preset, !options.separate && index > 0, signal);
        if (options.separate) {
          variant.files.push({ blob: serialize(variant.pdf), label: page.label });
          variant.pdf = createPdf(jsPDF);
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    } finally { recording.dispose(); }
  }
  signal?.throwIfAborted();
  return Object.fromEntries(variants.map(({ preset, pdf, files }) => {
    if (!options.separate) files.push({ blob: serialize(pdf), label: "Combined PDF" });
    return [preset.id, { files, size: files.reduce((total, file) => total + file.blob.size, 0) }];
  })) as PdfQualityResults;
}
