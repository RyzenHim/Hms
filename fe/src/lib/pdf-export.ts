export type PdfPageToRender = {
  element: HTMLDivElement;
  label: string;
};

type Rectangle = Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width" | "height">;

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
export const buildOptimizedPdf = async (pages: PdfPageToRender[]) => {
  if (pages.length === 0) {
    throw new Error("Select at least one page to generate a PDF.");
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  // Capture only after web fonts have settled so the preview and PDF agree.
  await pages[0].element.ownerDocument.fonts?.ready;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
    precision: 2,
  });

  for (let index = 0; index < pages.length; index++) {
    const canvas = await html2canvas(pages[index].element, {
      // Preserve the high-resolution render while JPEG encoding and PDF
      // stream compression remove the large lossless-PNG overhead.
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      allowTaint: true,
    });

    try {
      const jpegBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error("PDF image encoding failed.")),
          "image/jpeg",
          0.94,
        );
      });
      const imageData = new Uint8Array(await jpegBlob.arrayBuffer());
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(
        pdfWidth / canvas.width,
        pdfHeight / canvas.height,
      );
      const width = canvas.width * ratio;
      const height = canvas.height * ratio;
      const x = (pdfWidth - width) / 2;

      if (index > 0) pdf.addPage();
      pdf.addImage(
        imageData,
        "JPEG",
        x,
        0,
        width,
        height,
        undefined,
        "FAST",
      );

      addPdfLinkAnnotations(pdf, pages[index].element, { x, y: 0, width, height });
    } finally {
      // Release each page's large canvas, including when encoding fails.
      canvas.width = 1;
      canvas.height = 1;
    }
  }

  return pdf;
};
