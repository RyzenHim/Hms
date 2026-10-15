import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createReferenceWifiBill } from "../src/lib/wifi-bill.ts";
import { createWifiInvoice } from "../src/lib/wifi-invoice.ts";
import {
  buildVectorWifiBillPdf,
  replaceJsPdfProducer,
  serializeVectorWifiBillPdf,
} from "../src/lib/wifi-vector-pdf.ts";

test("producer replacement preserves byte length and ignores unrelated metadata", () => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const original = encoder.encode("<< /Producer (jsPDF 4.2.1) /Creator (Test) >>");
  const replaced = replaceJsPdfProducer(original);

  assert.equal(replaced.length, original.length);
  assert.match(decoder.decode(replaced), /\/Producer \(HMS Billing\)/);
  assert.match(decoder.decode(replaced), /\/Creator \(Test\)/);

  const unsupported = encoder.encode("<< /Producer (some other producer) >>");
  assert.throws(
    () => replaceJsPdfProducer(unsupported),
    /cannot be replaced without changing PDF byte offsets/,
  );
});

test("vector bill contains four pages, embedded fonts and billing metadata", async () => {
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
    const pdf = await buildVectorWifiBillPdf(invoice, {}, new Date("2026-08-06T06:30:00.000Z"));
    assert.equal(pdf.getNumberOfPages(), 4);

    const bytes = serializeVectorWifiBillPdf(pdf);
    const source = Buffer.from(bytes).toString("latin1");
    assert.match(source, /\/Producer \(HMS Billing\)/);
    assert.match(source, /\/Creator \(HMS WiFi Billing\)/);
    assert.match(source, /\/CreationDate \(D:20260806\d{6}[+-]\d{2}'\d{2}'\)/);
    assert.match(source, /\/Type \/Font/);
    assert.ok(bytes.length > 10_000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
