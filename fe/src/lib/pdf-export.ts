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
  return new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true, putOnlyUsedFonts: true, precision: 2 });
}

async function appendCanvasToPdf(pdf: PdfDocument, canvas: HTMLCanvasElement, page: PdfPageToRender, options: PdfRenderOptions, addPage: boolean) {
  const format = options.imageFormat ?? "JPEG";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PDF image encoding failed.")),
      format === "PNG" ? "image/png" : "image/jpeg", options.jpegQuality ?? DEFAULT_PDF_JPEG_QUALITY);
  });
  const imageData = new Uint8Array(await blob.arrayBuffer());
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const ratio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
  const width = canvas.width * ratio;
  const height = canvas.height * ratio;
  const x = (pdfWidth - width) / 2;
  if (addPage) pdf.addPage();
  pdf.addImage(imageData, format, x, 0, width, height, undefined, "FAST");
  addPdfLinkAnnotations(pdf, page.element, { x, y: 0, width, height });
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

/** Render document pages with the same A4 sizing and compression across tools. */
export const buildOptimizedPdf = async (
  pages: PdfPageToRender[],
  options: PdfRenderOptions = {},
) => {
  if (pages.length === 0) {
    throw new Error("Select at least one page to generate a PDF.");
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  // Capture only after web fonts have settled so the preview and PDF agree.
  await pages[0].element.ownerDocument.fonts?.ready;

  const pdf = createPdf(jsPDF);

  for (let index = 0; index < pages.length; index++) {
    const canvas = await html2canvas(pages[index].element, {
      scale: options.scale ?? DEFAULT_PDF_RENDER_SCALE,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      allowTaint: true,
    });

    try {
      await appendCanvasToPdf(pdf, canvas, pages[index], options, index > 0);
    } finally {
      // Release each page's large canvas, including when encoding fails.
      canvas.width = 1;
      canvas.height = 1;
    }
  }

  return pdf;
};

/** Capture each page once, then encode every preset so displayed sizes are exact. */
export async function buildPdfQualityVariants(
  pages: PdfPageToRender[],
  options: {
    separate?: boolean;
    signal?: AbortSignal;
    serialize?: (pdf: PdfDocument) => Blob;
    onProgress?: (page: number, total: number) => void;
  } = {},
): Promise<PdfQualityResults> {
  if (!pages.length) throw new Error("Select at least one page to generate a PDF.");
  const { signal } = options;
  signal?.throwIfAborted();
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  await pages[0].element.ownerDocument.fonts?.ready;
  signal?.throwIfAborted();
  const serialize = options.serialize ?? ((pdf: PdfDocument) => pdf.output("blob"));
  const variants = PDF_QUALITY_PRESETS.map((preset) => ({ preset, pdf: createPdf(jsPDF), files: [] as PdfExportFile[] }));
  const captureScale = Math.max(...PDF_QUALITY_PRESETS.map((preset) => preset.scale));
  for (let index = 0; index < pages.length; index++) {
    signal?.throwIfAborted();
    options.onProgress?.(index + 1, pages.length);
    const page = pages[index];
    const canvas = await html2canvas(page.element, {
      scale: captureScale, useCORS: true, logging: false, backgroundColor: "#ffffff", allowTaint: false,
    });
    try {
      for (const variant of variants) {
        signal?.throwIfAborted();
        const { preset } = variant;
        const resized = page.element.ownerDocument.createElement("canvas");
        try {
          resized.width = Math.max(1, Math.round(canvas.width * preset.scale / captureScale));
          resized.height = Math.max(1, Math.round(canvas.height * preset.scale / captureScale));
          const context = resized.getContext("2d");
          if (!context) throw new Error("Unable to prepare the PDF image.");
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";
          context.drawImage(canvas, 0, 0, resized.width, resized.height);
          await appendCanvasToPdf(variant.pdf, resized, page, preset, !options.separate && index > 0);
          signal?.throwIfAborted();
          if (options.separate) {
            variant.files.push({ blob: serialize(variant.pdf), label: page.label });
            variant.pdf = createPdf(jsPDF);
          }
        } finally {
          resized.width = 1;
          resized.height = 1;
        }
        // Allow paint and cancellation between encodes, especially for large bills.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    } finally {
      canvas.width = 1;
      canvas.height = 1;
    }
  }
  signal?.throwIfAborted();
  return Object.fromEntries(variants.map(({ preset, pdf, files }) => {
    if (!options.separate) files.push({ blob: serialize(pdf), label: "Combined PDF" });
    return [preset.id, { files, size: files.reduce((total, file) => total + file.blob.size, 0) }];
  })) as PdfQualityResults;
}
