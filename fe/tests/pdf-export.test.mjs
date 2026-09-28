import assert from "node:assert/strict";
import test from "node:test";
import { addPdfLinkAnnotations, isSupportedPdfLink, mapPdfLinkBounds } from "../src/lib/pdf-export.ts";

test("payment links use a supported PDF URI action and reject executable schemes", () => {
  assert.equal(isSupportedPdfLink("upi://pay?pa=merchant%40bank&am=1178.82"), true);
  assert.equal(isSupportedPdfLink("https://example.com/pay"), true);
  assert.equal(isSupportedPdfLink("javascript:alert(1)"), false);
  assert.equal(isSupportedPdfLink("data:text/html,unsafe"), false);
  assert.equal(isSupportedPdfLink("not a link"), false);
});

test("DOM payment controls map to the same location on an A4 PDF page", () => {
  const page = { left: 100, top: 40, right: 894, bottom: 1163, width: 794, height: 1123 };
  const link = { left: 735, top: 940, right: 855, bottom: 1068, width: 120, height: 128 };
  const mapped = mapPdfLinkBounds(page, link, { x: 0, y: 0, width: 210, height: 297 });
  assert.ok(mapped);
  assert.ok(Math.abs(mapped.x - 167.95) < 0.02);
  assert.ok(Math.abs(mapped.y - 238.02) < 0.02);
  assert.ok(Math.abs(mapped.width - 31.74) < 0.02);
  assert.ok(Math.abs(mapped.height - 33.85) < 0.02);
});

test("link bounds are clipped to the page and off-page links are ignored", () => {
  const page = { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 };
  assert.deepEqual(
    mapPdfLinkBounds(page, { left: -10, top: 90, right: 20, bottom: 110, width: 30, height: 20 }, { x: 5, y: 7, width: 200, height: 300 }),
    { x: 5, y: 277, width: 40, height: 30 },
  );
  assert.equal(
    mapPdfLinkBounds(page, { left: 110, top: 0, right: 120, bottom: 20, width: 10, height: 20 }, { x: 0, y: 0, width: 200, height: 300 }),
    null,
  );
});

test("export adds the UPI intent over the QR and skips unsafe annotated links", () => {
  const calls = [];
  const pageBounds = { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 };
  const qrBounds = { left: 50, top: 60, right: 90, bottom: 95, width: 40, height: 35 };
  const paymentLink = "upi://pay?pa=merchant%40bank&pn=Merchant&am=1178.82";
  const page = {
    getBoundingClientRect: () => pageBounds,
    querySelectorAll: () => [
      { dataset: { pdfLink: paymentLink }, getBoundingClientRect: () => qrBounds },
      { dataset: { pdfLink: "javascript:alert(1)" }, getBoundingClientRect: () => qrBounds },
    ],
  };
  addPdfLinkAnnotations({ link: (...args) => calls.push(args) }, page, { x: 0, y: 0, width: 210, height: 297 });
  assert.equal(calls.length, 1);
  assert.ok(Math.abs(calls[0][0] - 105) < 0.001);
  assert.ok(Math.abs(calls[0][1] - 178.2) < 0.001);
  assert.ok(Math.abs(calls[0][2] - 84) < 0.001);
  assert.ok(Math.abs(calls[0][3] - 103.95) < 0.001);
  assert.deepEqual(calls[0][4], { url: paymentLink });
});
