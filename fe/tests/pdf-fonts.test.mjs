import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { jsPDF } from "jspdf";
import { registerPdfFonts, resolvePdfTextFont, splitPdfTextFontRuns } from "../src/lib/pdf-fonts.ts";

test("PDF font matching keeps Arial, true Geist weights and serif styles distinct", () => {
  assert.deepEqual(resolvePdfTextFont('italic 700 11px "Times New Roman", serif', "Patient report"), {
    family: "HMSLiberationSerif", style: "bolditalic", supported: true,
  });
  assert.deepEqual(resolvePdfTextFont('600 11px "Geist", "Geist Fallback"', "Patient report"), {
    family: "HMSGeist", style: "600normal", supported: true,
  });
  assert.deepEqual(resolvePdfTextFont("400 10px Arial, Helvetica, sans-serif", "Account 123"), {
    family: "HMSLiberationSans", style: "normal", supported: true,
  });
});

test("currency uses native Unicode fallback while unknown scripts retain one browser-shaped run", () => {
  assert.deepEqual(splitPdfTextFontRuns("700 12px Arial", "Pay ₹125.00"), [
    { text: "Pay ", fontFamily: "HMSLiberationSans", fontStyle: "bold", supported: true },
    { text: "₹", fontFamily: "HMSGeist", fontStyle: "bold", supported: true },
    { text: "125.00", fontFamily: "HMSLiberationSans", fontStyle: "bold", supported: true },
  ]);
  const original = "नाम Patient";
  const runs = splitPdfTextFontRuns("400 12px Arial", original);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].text, original);
  assert.equal(runs[0].supported, false);
  assert.equal(resolvePdfTextFont("italic 12px Geist", "Signature").supported, false);
  assert.equal(resolvePdfTextFont("12px cursive", "Signature").supported, false);
});

test("embedded fonts load once per style, support real bold and currency, and retry failed requests", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  let failMono = true;
  globalThis.fetch = async (input) => {
    const path = String(input);
    requests.push(path);
    if (failMono && path.endsWith("LiberationMono-Italic.ttf")) return new Response("unavailable", { status: 503 });
    return new Response(await readFile(new URL(`../public${path}`, import.meta.url)));
  };
  try {
    const fonts = new Set(["400 11px Arial", "700 11px Arial", "600 11px Geist"]);
    const pdf = new jsPDF({ compress: true, putOnlyUsedFonts: true });
    const faces = await registerPdfFonts(pdf, undefined, fonts);
    assert.ok(faces.some((face) => face.family === "Arial" && face.weight === 700 && face.ref.style === "bold"));
    assert.ok(faces.some((face) => face.family === "Geist" && face.weight === 600 && face.ref.style === "600normal"));
    assert.deepEqual(pdf.getFontList().HMSLiberationSans.sort(), ["bold", "normal"]);
    assert.deepEqual(pdf.getFontList().HMSGeist.sort(), ["600normal", "bold", "normal"]);
    const loaded = requests.length;
    await registerPdfFonts(new jsPDF(), undefined, fonts);
    assert.equal(requests.length, loaded);
    pdf.setFont("HMSGeist", "bold").text("₹125.00", 10, 10);
    assert.ok(pdf.output("arraybuffer").byteLength > 1000);
    await assert.rejects(registerPdfFonts(pdf, undefined, new Set(["italic 12px monospace"])), /Unable to load the PDF font.*503/);
    failMono = false;
    await registerPdfFonts(pdf, undefined, new Set(["italic 12px monospace"]));
    assert.ok(pdf.getFontList().HMSLiberationMono.includes("italic"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
