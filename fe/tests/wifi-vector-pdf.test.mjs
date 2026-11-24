import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createReferenceWifiBill } from "../src/lib/wifi-bill.ts";
import { createWifiInvoice } from "../src/lib/wifi-invoice.ts";
import {
  buildVectorWifiBillPdf,
  removePdfProducerAndCreationDate,
  serializeVectorWifiBillPdf,
} from "../src/lib/wifi-vector-pdf.ts";

test("producer and creation date removal preserves byte length and unrelated metadata", () => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const original = encoder.encode("<< /Producer (jsPDF 4.2.1) /CreationDate (D:20261124120000+05'30') /Creator (Test) >>");
  const removed = removePdfProducerAndCreationDate(original);

  assert.equal(removed.length, original.length);
  assert.doesNotMatch(decoder.decode(removed), /\/Producer\b/);
  assert.doesNotMatch(decoder.decode(removed), /\/CreationDate\b/);
  assert.match(decoder.decode(removed), /\/Creator \(Test\)/);

  const unrelated = encoder.encode("<< /Creator (Test) >>");
  assert.equal(decoder.decode(removePdfProducerAndCreationDate(unrelated)), "<< /Creator (Test) >>");
});

test("vector bill contains four pages and excludes bill details from document properties", async () => {
  const font = await readFile(new URL("../public/wifi/Geist-Regular.ttf", import.meta.url));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    if (String(input) === "/wifi/Geist-Regular.ttf") {
      return new Response(font, { status: 200, headers: { "content-type": "font/ttf" } });
    }
    throw new Error(`Unexpected test fetch: ${String(input)}`);
  };

  try {
    const invoice = createWifiInvoice(createReferenceWifiBill());
    const pdf = await buildVectorWifiBillPdf(invoice, {});
    assert.equal(pdf.getNumberOfPages(), 4);

    const bytes = serializeVectorWifiBillPdf(pdf);
    const source = Buffer.from(bytes).toString("latin1");
    assert.doesNotMatch(source, /\/Producer\b/);
    assert.doesNotMatch(source, /\/CreationDate\b/);
    assert.doesNotMatch(source, /\/(?:Title|Subject|Author|Creator|Keywords)\b/);
    assert.match(source, /\/Type \/Font/);
    assert.ok(bytes.length > 10_000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
