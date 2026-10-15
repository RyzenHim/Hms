import assert from "node:assert/strict";
import test from "node:test";
import { jsPDF } from "jspdf";
import { drawPdfGradient } from "../src/lib/pdf-native-gradient.ts";

const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const rectangle = [{ op: "m", c: [10, 20] }, { op: "l", c: [110, 20] }, { op: "l", c: [110, 60] }, { op: "l", c: [10, 60] }, { op: "h", c: [] }];

test("Wi-Fi panel gradient is native PDF shading and is reused across pages", () => {
  const pdf = new jsPDF({ compress: false, precision: 4 });
  const gradient = { kind: "linear", args: [0, 0, 100, 50], stops: [[0, "#fff4f4"], [1, "#f5f5f5"]] };
  assert.equal(drawPdfGradient(pdf, gradient, rectangle, identity), true);
  pdf.addPage();
  assert.equal(drawPdfGradient(pdf, gradient, rectangle, { ...identity, e: 20, f: 30 }), true);
  const source = pdf.output();
  assert.equal(source.match(/\/ShadingType 2\b/g).length, 1);
  assert.equal(source.match(/\/Sh1 sh/g).length, 2);
  assert.doesNotMatch(source, /\/Subtype \/Image/);
  assert.match(source, /1\. 0\. 0\. 1\. 20\. 30\. cm/);
});

test("uniform-alpha radial gradient keeps native shading, clipping rule and combined opacity", () => {
  const pdf = new jsPDF({ compress: false, precision: 4 });
  const gradient = { kind: "radial", args: [50, 50, 0, 50, 50, 30], stops: [[0, "rgba(255, 255, 255, 0.5)"], [0.5, "rgba(128, 128, 128, 0.5)"], [1, "rgba(0, 0, 0, 0.5)"]] };
  assert.equal(drawPdfGradient(pdf, gradient, rectangle, { a: 2, b: 0.5, c: 0, d: 1, e: 5, f: 8 }, 0.4, "evenodd"), true);
  const source = pdf.output();
  assert.match(source, /\/ShadingType 3\b/);
  assert.match(source, /\/ca 0\.2/);
  assert.match(source, /W\* n/);
  assert.match(source, /2\. 0\.5 0\. 1\. 5\. 8\. cm/);
  assert.doesNotMatch(source, /\/Subtype \/Image/);
});

test("unsupported gradients leave the PDF unchanged for pixel fallback", () => {
  const pdf = new jsPDF({ compress: false });
  const before = pdf.output();
  const samples = [
    { kind: "conic", args: [0, 50, 50], stops: [[0, "black"], [1, "white"]] },
    { kind: "linear", args: [0, 0, 100, 0], stops: [[0, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,1)"]] },
    { kind: "linear", args: [0, 0, 100, 0], stops: [[0, "black"], [0.51, "red"], [1, "white"]] },
    { kind: "linear", args: [0, 0, 100, 0], stops: [[0, "black"], [0.5, "black"], [0.5, "white"], [1, "white"]] },
    { kind: "radial", args: [0, 0, 10, 10, 10, 20], stops: [[0, "black"], [1, "white"]] },
  ];
  for (const gradient of samples) assert.equal(drawPdfGradient(pdf, gradient, rectangle, identity), false);
  assert.equal(pdf.output(), before);
});
