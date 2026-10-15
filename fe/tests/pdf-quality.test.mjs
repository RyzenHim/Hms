import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import test from "node:test";
import { createCanvasDocument } from "./helpers/pdf-canvas-fixture.mjs";
import {
  buildOptimizedPdf,
  buildPdfQualityVariants,
  DEFAULT_PDF_QUALITY,
  formatPdfSize,
} from "../src/lib/pdf-export.ts";

// Browser layout is stubbed; display recording, vector drawing, fonts, and PDF
// serialization all run through the production implementation and real jsPDF.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "html2canvas-pro") return { url: "test:pdf-capture", shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "test:pdf-capture") return { format: "module", source: "export default (...args) => globalThis.__pdfCaptureForTest(...args);", shortCircuit: true };
    return nextLoad(url, context);
  },
});

globalThis.fetch = async (input) => new Response(await readFile(new URL(`../public${String(input)}`, import.meta.url)));

function fixture({ cancel, artwork = true } = {}) {
  const f = createCanvasDocument();
  const captures = [];
  const image = { src: "data:image/png;base64,artwork", naturalWidth: 1600, naturalHeight: 800, width: 1600, height: 800 };
  const pages = [1, 2].map((number) => ({
    label: `Page ${number}`,
    element: {
      ownerDocument: f.document,
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 794, bottom: 1123, width: 794, height: 1123 }),
      querySelectorAll: () => [],
    },
  }));
  globalThis.__pdfCaptureForTest = async (element, options) => {
    captures.push({ element, options });
    const ctx = options.canvas.getContext("2d");
    ctx.save();
    ctx.scale(options.scale, options.scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 794, 1123);
    ctx.fillStyle = "#000000";
    ctx.font = "400 12px Arial";
    ctx.fillText("Patient report: ₹125.00", 20, 30);
    ctx.strokeStyle = "#999999";
    ctx.strokeRect(20, 40, 200, 80);
    if (artwork) {
      ctx.drawImage(image, 20, 150, 100, 50);
      ctx.drawImage(image, 200, 150, 100, 50);
    }
    ctx.restore();
    cancel?.();
    return options.canvas;
  };
  return { ...f, pages, captures };
}

async function pdfSource(file) {
  return Buffer.from(await file.blob.arrayBuffer()).toString("latin1");
}

test("each page is laid out once; every quality retains native text and encodes only artwork", async () => {
  const f = fixture();
  const result = await buildPdfQualityVariants(f.pages);
  assert.equal(DEFAULT_PDF_QUALITY, "normal");
  assert.deepEqual(Object.keys(result), ["compact", "normal", "high", "ultra", "lossless"]);
  assert.equal(f.captures.length, 2);
  assert.ok(f.captures.every(({ options }) => options.scale === 4 && options.canvas));
  assert.deepEqual(f.encodes.slice(0, 5).map(({ width }) => width), [100, 200, 300, 400, 400]);
  assert.deepEqual(f.encodes.slice(0, 5).map(({ mimeType }) => mimeType), ["image/jpeg", "image/jpeg", "image/jpeg", "image/jpeg", "image/png"]);
  assert.deepEqual(f.encodes.slice(0, 5).map(({ quality }) => quality), [0.72, 0.9, 0.95, 0.98, 1]);
  for (const variant of Object.values(result)) {
    assert.equal(variant.files.length, 1);
    assert.equal(variant.size, variant.files[0].blob.size);
    const source = await pdfSource(variant.files[0]);
    assert.equal(source.match(/\/Type \/Page\b/g).length, 2);
    assert.match(source, /\/Subtype \/Type0/);
    assert.match(source, /\/FontFile2/);
    // Repeated art on both pages is embedded once, without a full-page bitmap.
    assert.equal(source.match(/\/Subtype \/Image\b/g).length, 1);
    assert.doesNotMatch(source, /\/Width (?:794|1588|2382|3176)\b/);
  }
  assert.match(await pdfSource(result.normal.files[0]), /\/Width 200\b/);
  assert.match(await pdfSource(result.ultra.files[0]), /\/Width 400\b/);
  assert.ok(f.canvases.every((canvas) => canvas.width === 1 && canvas.height === 1));
});

test("text and tables need no raster images, including currency at every quality", async () => {
  const f = fixture({ artwork: false });
  const result = await buildPdfQualityVariants([f.pages[0]]);
  assert.equal(f.encodes.length, 0);
  for (const variant of Object.values(result)) {
    const source = await pdfSource(variant.files[0]);
    assert.doesNotMatch(source, /\/Subtype \/Image/);
    assert.match(source, /\/FontFile2/);
  }
});

test("separate exports contain one page per file and count sizes after custom serialization", async () => {
  const f = fixture();
  const result = await buildPdfQualityVariants(f.pages, {
    separate: true,
    serialize: (pdf) => new Blob([pdf.output("arraybuffer"), "custom-metadata"], { type: "application/pdf" }),
  });
  for (const variant of Object.values(result)) {
    assert.equal(variant.files.length, 2);
    assert.equal(variant.size, variant.files.reduce((total, file) => total + file.blob.size, 0));
    for (const file of variant.files) {
      const source = await pdfSource(file);
      assert.equal(source.match(/\/Type \/Page\b/g).length, 1);
      assert.ok(source.endsWith("custom-metadata"));
    }
  }
});

test("canceling layout prevents encoding and releases measurement canvases", async () => {
  const controller = new AbortController();
  const f = fixture({ cancel: () => controller.abort() });
  await assert.rejects(buildPdfQualityVariants(f.pages, { signal: controller.signal }), { name: "AbortError" });
  assert.equal(f.captures.length, 1);
  assert.equal(f.encodes.length, 0);
  assert.ok(f.canvases.every((canvas) => canvas.width === 1 && canvas.height === 1));
});

test("empty selections and previously canceled exports cannot generate a PDF", async () => {
  const f = fixture();
  await assert.rejects(buildPdfQualityVariants([]), /Select at least one page/);
  await assert.rejects(buildPdfQualityVariants(f.pages, { signal: AbortSignal.abort() }), { name: "AbortError" });
  assert.equal(f.captures.length, 0);
});

test("direct exports default to Normal artwork quality and readable file sizes", async () => {
  const f = fixture();
  const pdf = await buildOptimizedPdf([f.pages[0]]);
  assert.equal(pdf.getNumberOfPages(), 1);
  assert.equal(f.captures[0].options.scale, 4);
  assert.equal(f.encodes[0].width, 200);
  assert.equal(f.encodes[0].quality, 0.9);
  assert.equal(formatPdfSize(512), "512 B");
  assert.equal(formatPdfSize(1536), "1.5 KB");
  assert.equal(formatPdfSize(1572864), "1.50 MB");
});
