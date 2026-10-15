import assert from "node:assert/strict";
import test from "node:test";
import { jsPDF } from "jspdf";
import { createNativePdfCanvas } from "../src/lib/pdf-native-canvas.ts";
import { createCanvasDocument } from "./helpers/pdf-canvas-fixture.mjs";

function fixture(options = {}) {
  const browser = createCanvasDocument();
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: false });
  const canvas = createNativePdfCanvas(pdf, browser.document, {
    textRuns: (_font, text) => [{ text, fontFamily: "helvetica", fontStyle: "normal", supported: true }],
    ...options,
  });
  return { ...browser, pdf, canvas, context: canvas.getContext("2d"), source: () => pdf.output() };
}

test("ordinary page content is selectable text and native paths, with no page image", () => {
  const f = fixture();
  f.context.scale(210 / 794, 210 / 794);
  f.context.fillStyle = "#cc0000";
  f.context.fillRect(36, 38, 300, 25);
  f.context.font = "700 13.5px Arial";
  f.context.fillStyle = "#111111";
  f.context.fillText("Invoice 123", 45, 55);
  f.context.lineWidth = 0.5;
  f.context.beginPath(); f.context.moveTo(36, 70); f.context.lineTo(750, 70); f.context.stroke();
  assert.match(f.source(), /\(Invoice 123\) Tj/);
  assert.match(f.source(), /13\.5 Tf/);
  assert.doesNotMatch(f.source(), /\/Subtype \/Image/);
  assert.equal(f.encodes.length, 0);
  assert.equal(f.canvas.width, 1);
});

test("full affine text transforms and drawing opacity survive PDF export", () => {
  const f = fixture();
  f.context.transform(0.2, 0.05, 0.08, 0.25, 10, 20);
  f.context.globalAlpha = 0.15;
  f.context.fillStyle = "rgba(10,20,30,0.5)";
  f.context.fillText("Watermark", 100, 200);
  assert.match(f.source(), /0\.2[\d]* 0\.05[\d]* 0\.08[\d]* 0\.25 10\. 20\. cm/);
  // jsPDF serializes ExtGState opacity to two decimal places.
  assert.match(f.source(), /\/ca 0\.07/);
  assert.match(f.source(), /\(Watermark\) Tj/);
});

test("ellipses and even-odd clipping stay native and accept saved matrix objects", () => {
  const f = fixture();
  f.context.scale(0.25, 0.25);
  const transform = f.context.getTransform();
  f.context.setTransform(transform);
  f.context.beginPath(); f.context.ellipse(100, 100, 50, 20, 0.3, 0, Math.PI * 2); f.context.fill("evenodd");
  f.context.beginPath(); f.context.rect(1, 2, 10, 20); f.context.clip("evenodd");
  assert.match(f.source(), /f\*/);
  assert.match(f.source(), /W\*/);
  assert.match(f.source(), / c\n/);
  assert.doesNotMatch(f.source(), /\/Subtype \/Image/);
});

test("selected quality applies to artwork pixels and repeated artwork embeds once", () => {
  const f = fixture({ scale: 3, imageFormat: "JPEG", jpegQuality: 0.95 });
  const image = { src: "/photo.jpg", naturalWidth: 1000, naturalHeight: 500 };
  f.context.scale(25.4 / 96, 25.4 / 96);
  f.context.drawImage(image, 0, 0, 100, 50);
  f.context.drawImage(image, 200, 0, 100, 50);
  assert.equal(f.encodes.length, 1);
  assert.deepEqual(f.encodes[0], { width: 300, height: 150, mimeType: "image/jpeg", quality: 0.95 });
  assert.equal(f.source().match(/\/Subtype \/Image/g).length, 1);
  assert.match(f.source(), /\/Width 300\b/);
  assert.match(f.source(), /\/Height 150\b/);
});

test("SVG artwork uses paths and unsupported effects keep transparent image pixels", () => {
  const svg = '<svg viewBox="0 0 100 50"><path d="M0 0h100v50H0z" fill="#e90000"/></svg>';
  const f = fixture({ svgSources: new Map([["/logo.svg", svg]]), imageFormat: "JPEG" });
  const logo = { src: "/logo.svg", naturalWidth: 100, naturalHeight: 50 };
  f.context.scale(25.4 / 96, 25.4 / 96);
  f.context.drawImage(logo, 10, 10, 100, 50);
  assert.equal(f.encodes.length, 0);
  assert.doesNotMatch(f.source(), /\/Subtype \/Image/);
  const stamp = { src: "/stamp.png", naturalWidth: 100, naturalHeight: 100, transparent: true };
  f.context.drawImage(stamp, 10, 100, 100, 100);
  assert.equal(f.encodes[0].mimeType, "image/png");
  assert.match(f.source(), /\/SMask/);
});

test("supported gradient backgrounds stay native PDF shadings", () => {
  const f = fixture({ scale: 2 });
  f.context.scale(25.4 / 96, 25.4 / 96);
  const gradient = f.context.createLinearGradient(0, 0, 100, 0);
  gradient.addColorStop(0, "red"); gradient.addColorStop(1, "white");
  f.context.fillStyle = gradient;
  f.context.fillRect(20, 30, 100, 20);
  assert.equal(f.encodes.length, 0);
  assert.match(f.source(), /\/ShadingType 2/);
  assert.doesNotMatch(f.source(), /\/Subtype \/Image/);
});

test("unsupported font shaping rasterizes just the affected text run", () => {
  const f = fixture({ textRuns: (_font, text) => [{ text, fontFamily: "helvetica", fontStyle: "normal", supported: !text.includes("ह") }] });
  f.context.scale(25.4 / 96, 25.4 / 96);
  f.context.font = "14px Arial";
  f.context.fillText("Invoice", 30, 50);
  f.context.fillText("हिन्दी", 30, 100);
  assert.match(f.source(), /\(Invoice\) Tj/);
  assert.equal(f.encodes.length, 1);
  assert.ok(f.encodes[0].width < 150);
  assert.ok(f.encodes[0].height < 100);
});

test("rotated filtered SVG artwork uses pixels and separates cached filter variants", () => {
  const svg = '<svg viewBox="0 0 100 50"><rect width="100" height="50" fill="red"/></svg>';
  const f = fixture({ svgSources: new Map([["/logo.svg", svg]]), scale: 2 });
  const image = { src: "/logo.svg", naturalWidth: 100, naturalHeight: 50 };
  f.context.scale(0.25, 0.25);
  f.context.drawImage(image, 0, 0, 100, 50);
  assert.equal(f.encodes.length, 0);
  f.context.rotate(Math.PI / 2);
  f.context.filter = "grayscale(100%)";
  f.context.drawImage(image, 0, 0, 100, 50);
  f.context.drawImage(image, 0, 0, 100, 50);
  assert.equal(f.encodes.length, 1);
  assert.equal(f.images[0].canvas.getContext("2d").filter, "grayscale(100%)");
  f.context.filter = "sepia(100%)";
  f.context.drawImage(image, 0, 0, 100, 50);
  assert.equal(f.encodes.length, 2);
  assert.equal(f.images[1].canvas.getContext("2d").filter, "sepia(100%)");
});

test("text shadow patches honor capture scale and transformed artwork resolution", () => {
  const f = fixture({ scale: 2, captureScale: 4 });
  f.context.scale(25.4 / 96, 25.4 / 96);
  f.context.font = "14px Arial";
  f.context.shadowColor = "rgba(0,0,0,0.5)";
  f.context.shadowBlur = 8;
  f.context.shadowOffsetX = 12;
  f.context.shadowOffsetY = 0;
  f.context.fillText("Shadow", 50, 50);
  assert.equal(f.encodes.length, 1);
  const temporary = f.canvases[1].getContext("2d");
  assert.ok(Math.abs(temporary.shadowBlur - 4) < 1e-8);
  assert.ok(Math.abs(temporary.shadowOffsetX - 6) < 1e-8);
  assert.equal(temporary.textBaseline, "alphabetic");
  const width = f.encodes[0].width;
  f.context.scale(2, 2);
  f.context.fillText("Shadow", 50, 50);
  assert.ok(f.encodes[1].width >= width * 2 - 1);
  assert.ok(Math.abs(f.canvases[2].getContext("2d").shadowBlur - 8) < 1e-8);
});
