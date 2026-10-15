import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { encode } from "fast-png";
import {
  buildOptimizedPdf,
  buildPdfQualityVariants,
  DEFAULT_PDF_QUALITY,
  formatPdfSize,
} from "../src/lib/pdf-export.ts";

// Replace only browser capture; use real image encoding and jsPDF serialization.
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

function fixture({ onEncode } = {}) {
  const canvases = [];
  const captures = [];
  const encodes = [];
  const makeCanvas = () => {
    const canvas = {
      width: 0, height: 0,
      getContext: () => ({ drawImage() {} }),
      toBlob(callback, mimeType, quality) {
        encodes.push({ width: canvas.width, height: canvas.height, mimeType, quality });
        // A real PNG stands in for the browser's encoded pixels in this DOM-free test.
        const data = new Uint8Array(canvas.width * canvas.height * 3).fill(255);
        const bytes = encode({ width: canvas.width, height: canvas.height, data, channels: 3 });
        onEncode?.();
        callback(new Blob([bytes], { type: mimeType }));
      },
    };
    canvases.push(canvas);
    return canvas;
  };
  const ownerDocument = { fonts: { ready: Promise.resolve() }, createElement: makeCanvas };
  const pages = [1, 2].map((number) => ({
    label: `Page ${number}`,
    element: {
      ownerDocument,
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 30, bottom: 40, width: 30, height: 40 }),
      querySelectorAll: () => [],
    },
  }));
  globalThis.__pdfCaptureForTest = async (element, options) => {
    captures.push({ element, options });
    const canvas = makeCanvas();
    canvas.width = 30 * options.scale;
    canvas.height = 40 * options.scale;
    return canvas;
  };
  return { pages, canvases, captures, encodes };
}

async function pdfSource(file) {
  return Buffer.from(await file.blob.arrayBuffer()).toString("latin1");
}

test("quality options use one high-resolution capture per page and report actual serialized PDF sizes", async () => {
  const f = fixture();
  const result = await buildPdfQualityVariants(f.pages);
  assert.equal(DEFAULT_PDF_QUALITY, "normal");
  assert.deepEqual(Object.keys(result), ["compact", "normal", "high", "ultra", "lossless"]);
  assert.equal(f.captures.length, 2);
  assert.ok(f.captures.every(({ options }) => options.scale === 4));
  assert.deepEqual(f.encodes.slice(0, 5).map(({ width }) => width), [30, 60, 90, 120, 120]);
  assert.deepEqual(f.encodes.slice(0, 5).map(({ mimeType }) => mimeType), ["image/jpeg", "image/jpeg", "image/jpeg", "image/jpeg", "image/png"]);
  assert.deepEqual(f.encodes.slice(0, 5).map(({ quality }) => quality), [0.72, 0.9, 0.95, 0.98, 1]);
  for (const variant of Object.values(result)) {
    assert.equal(variant.files.length, 1);
    assert.equal(variant.size, variant.files[0].blob.size);
    assert.ok(variant.size > 0);
    assert.equal((await pdfSource(variant.files[0])).match(/\/Type \/Page\b/g).length, 2);
  }
  assert.match(await pdfSource(result.normal.files[0]), /\/Width 60\b/);
  assert.match(await pdfSource(result.ultra.files[0]), /\/Width 120\b/);
  assert.ok(f.canvases.every((canvas) => canvas.width === 1 && canvas.height === 1));
});

test("separate exports contain one page per file and sum sizes after custom serialization", async () => {
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

test("canceling an export stops further encodes and releases every canvas", async () => {
  const controller = new AbortController();
  const f = fixture({ onEncode: () => controller.abort() });
  await assert.rejects(buildPdfQualityVariants(f.pages, { signal: controller.signal }), { name: "AbortError" });
  assert.equal(f.captures.length, 1);
  assert.equal(f.encodes.length, 1);
  assert.ok(f.canvases.every((canvas) => canvas.width === 1 && canvas.height === 1));
});

test("empty selections and previously canceled exports cannot generate a PDF", async () => {
  const f = fixture();
  await assert.rejects(buildPdfQualityVariants([]), /Select at least one page/);
  await assert.rejects(buildPdfQualityVariants(f.pages, { signal: AbortSignal.abort() }), { name: "AbortError" });
  assert.equal(f.captures.length, 0);
});

test("direct exports default to sharper Normal quality and sizes display in readable units", async () => {
  const f = fixture();
  const pdf = await buildOptimizedPdf([f.pages[0]]);
  assert.equal(pdf.getNumberOfPages(), 1);
  assert.equal(f.captures[0].options.scale, 2);
  assert.equal(f.encodes[0].quality, 0.9);
  assert.equal(formatPdfSize(512), "512 B");
  assert.equal(formatPdfSize(1536), "1.5 KB");
  assert.equal(formatPdfSize(1572864), "1.50 MB");
});
