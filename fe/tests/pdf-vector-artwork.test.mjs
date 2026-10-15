import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { jsPDF } from "jspdf";
import { drawQrModules, drawSvgArtwork, parseSvgArtwork } from "../src/lib/pdf-vector-artwork.ts";

function recordingContext(extra = {}) {
  const operations = [];
  const context = { fillStyle: "black", strokeStyle: "black", lineWidth: 1, globalAlpha: 1, ...extra };
  for (const method of ["save", "restore", "beginPath", "moveTo", "lineTo", "bezierCurveTo", "quadraticCurveTo", "closePath", "fill", "stroke"]) {
    context[method] = (...values) => operations.push([method, ...values]);
  }
  return { context, operations };
}

test("supplied Airtel wordmark keeps its complete path, red fill and original proportions", async () => {
  const svg = await readFile(new URL("../public/wifi/airtel-logo.svg", import.meta.url), "utf8");
  const artwork = parseSvgArtwork(svg);
  assert.ok(artwork);
  assert.deepEqual(artwork.viewBox, [0, 0, 264, 66]);
  assert.equal(artwork.shapes.length, 1);
  assert.equal(artwork.shapes[0].paint.fill, "#E90000");
  assert.equal(artwork.shapes[0].paint.fillRule, "nonzero");
  assert.equal(artwork.shapes[0].path.filter(({ op }) => op === "M").length, 10);
  assert.ok(artwork.shapes[0].path.some(({ op, values }) => op === "M" && values[0] === 100.2 && values[1] === 56.3));
  const { context, operations } = recordingContext();
  assert.equal(drawSvgArtwork(context, artwork, { x: 10, y: 10, width: 264, height: 100 }), true);
  assert.deepEqual(operations.find(([method]) => method === "moveTo"), ["moveTo", 33.6, 90.8]);
  assert.equal(operations.filter(([method]) => method === "fill").length, 1);
  assert.equal(context.fillStyle, "#E90000");
});

test("inline barcode SVG preserves every white quiet zone and black bar with stretch sizing", () => {
  const svg = '<svg viewBox="0 0 100 32" preserveAspectRatio="none" role="img" aria-label="barcode"><rect width="100" height="32" fill="white"/><rect x="10" y="0" width="2" height="32" fill="black"/><rect x="13" y="0" width="1" height="32" fill="black"/></svg>';
  const { context, operations } = recordingContext();
  assert.equal(drawSvgArtwork(context, svg, { x: 4, y: 8, width: 200, height: 16 }), true);
  assert.deepEqual(operations.filter(([method]) => method === "moveTo"), [["moveTo", 4, 8], ["moveTo", 24, 8], ["moveTo", 30, 8]]);
  assert.ok(operations.some((operation) => JSON.stringify(operation) === JSON.stringify(["lineTo", 28, 24])));
  assert.equal(operations.filter(([method]) => method === "fill").length, 3);
});

test("relative commands, implicit lines and smooth reflected control points keep path geometry", () => {
  const artwork = parseSvgArtwork('<svg viewBox="0 0 20 20"><path d="M1 2 3 4 h2 v3 c1 0 2 1 3 2 s2 3 4 5 q1 2 3 4 t2 2z"/></svg>');
  assert.ok(artwork);
  assert.deepEqual(artwork.shapes[0].path, [
    { op: "M", values: [1, 2] }, { op: "L", values: [3, 4] }, { op: "L", values: [5, 4] }, { op: "L", values: [5, 7] },
    { op: "C", values: [6, 7, 7, 8, 8, 9] }, { op: "C", values: [9, 10, 10, 12, 12, 14] },
    { op: "Q", values: [13, 16, 15, 18] }, { op: "Q", values: [17, 20, 17, 20] }, { op: "Z", values: [] },
  ]);
});

test("HMS watermark fill opacity and stroke opacity are inherited and painted independently", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" style="width:400px;height:400px"><path fill="#22c55e" fill-opacity="0.12" stroke="black" stroke-opacity="0.5" d="M200,40 C130,40 100,100 100,160 C100,240 200,360 200,360 C200,360 300,240 300,160 C300,100 270,40 200,40 Z M200,220 C167,220 140,193 140,160 C140,127 167,100 200,100 C233,100 260,127 260,160 C260,193 233,220 200,220 Z"/></svg>';
  const { context } = recordingContext({ globalAlpha: 0.15 });
  const painted = [];
  context.fill = () => painted.push(["fill", context.globalAlpha]);
  context.stroke = () => painted.push(["stroke", context.globalAlpha]);
  assert.equal(drawSvgArtwork(context, svg, { x: 0, y: 0, width: 400, height: 400 }), true);
  assert.deepEqual(painted, [["fill", 0.018], ["stroke", 0.075]]);
  const pdf = new jsPDF({ unit: "px", format: [400, 400], precision: 4 });
  pdf.context2d.globalAlpha = 0.15;
  assert.equal(drawSvgArtwork(pdf.context2d, svg, { x: 0, y: 0, width: 400, height: 400 }), true);
  assert.match(pdf.output(), /\/ca 0\.018/);
  assert.match(pdf.output(), /\/CA 0\.075/);
  assert.doesNotMatch(pdf.output(), /\/Subtype \/Image/);
});

test("circles and ellipses become closed cubic paths", () => {
  const svg = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="10"/><ellipse cx="25" cy="25" rx="20" ry="5"/></svg>';
  const artwork = parseSvgArtwork(svg);
  assert.ok(artwork);
  assert.equal(artwork.shapes.length, 2);
  assert.deepEqual(artwork.shapes[0].path[0], { op: "M", values: [60, 50] });
  assert.deepEqual(artwork.shapes[1].path[0], { op: "M", values: [45, 25] });
  assert.ok(artwork.shapes.every(({ path }) => path.filter(({ op }) => op === "C").length === 4 && path.at(-1).op === "Z"));
});

test("evenodd holes use canvas rule, and unsupported jsPDF rule safely falls back before drawing", () => {
  const svg = '<svg viewBox="0 0 10 10"><path fill-rule="evenodd" d="M0 0H10V10H0Z M2 2H8V8H2Z"/></svg>';
  const { context, operations } = recordingContext();
  assert.equal(drawSvgArtwork(context, svg, { x: 0, y: 0, width: 10, height: 10 }), true);
  assert.ok(operations.some(([method, rule]) => method === "fill" && rule === "evenodd"));
  const unsupported = recordingContext({ pdf: {} });
  assert.equal(drawSvgArtwork(unsupported.context, svg, { x: 0, y: 0, width: 10, height: 10 }), false);
  assert.equal(unsupported.operations.length, 0);
});

test("unsupported SVG effects and malformed paths always leave the raster fallback untouched", () => {
  const samples = [
    '<svg viewBox="0 0 10 10"><path d="M0 0 A5 5 0 0 0 10 10"/></svg>',
    '<svg viewBox="0 0 10 10"><rect width="10" height="10" filter="url(#blur)"/></svg>',
    '<svg viewBox="0 0 10 10"><text>Bill</text></svg>',
    '<svg viewBox="0 0 10 10"><path d="M0 0L"/></svg>',
    '<svg viewBox="0 0 10 10"><path style="display:none" d="M0 0L10 10"/></svg>',
    '<svg viewBox="0 0 10 10"><path fill="currentColor" d="M0 0L10 10"/></svg>',
    '<svg viewBox="0 0 10 10"><path fill="#ffaa0033" d="M0 0L10 10"/></svg>',
    '<svg viewBox="0 0 10 10"><g transform="rotate(30)"><rect width="10" height="10"/></g></svg>',
  ];
  for (const svg of samples) {
    const { context, operations } = recordingContext();
    assert.equal(drawSvgArtwork(context, svg, { x: 0, y: 0, width: 10, height: 10 }), false);
    assert.equal(operations.length, 0);
  }
});

test("QR vectors merge horizontal modules and preserve the four-module quiet zone", () => {
  const { context, operations } = recordingContext();
  const modules = { size: 3, data: [1, 1, 0, 0, 1, 1, 1, 0, 1] };
  assert.equal(drawQrModules(context, modules, { x: 5, y: 9, width: 110, height: 110 }), true);
  assert.deepEqual(operations.filter(([method]) => method === "moveTo"), [
    ["moveTo", 5, 9], ["moveTo", 45, 49], ["moveTo", 55, 59], ["moveTo", 45, 69], ["moveTo", 65, 69],
  ]);
  assert.ok(operations.some((operation) => JSON.stringify(operation) === JSON.stringify(["lineTo", 65, 49])));
  assert.equal(operations.filter(([method]) => method === "fill").length, 2);
});

test("vector artwork renders through jsPDF context2d without embedding image objects", async () => {
  const svg = await readFile(new URL("../public/wifi/airtel-logo.svg", import.meta.url), "utf8");
  const pdf = new jsPDF({ unit: "px", format: [400, 200], compress: true });
  assert.equal(drawSvgArtwork(pdf.context2d, svg, { x: 20, y: 20, width: 264, height: 66 }), true);
  assert.equal(drawQrModules(pdf.context2d, { size: 2, data: [1, 0, 0, 1] }, { x: 300, y: 20, width: 80, height: 80 }), true);
  const source = pdf.output();
  assert.doesNotMatch(source, /\/Subtype \/Image/);
  assert.match(source, /\/Type \/Page\b/);
});
