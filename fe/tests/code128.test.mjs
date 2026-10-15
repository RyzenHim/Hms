import assert from "node:assert/strict";
import test from "node:test";
import {
  CODE128_B_MAX_LENGTH,
  CODE128_QUIET_ZONE_MODULES,
  decodeCode128BModules,
  encodeCode128B,
} from "../src/lib/code128.ts";
import { createReferenceWifiBill } from "../src/lib/wifi-bill.ts";
import { createWifiInvoice } from "../src/lib/wifi-invoice.ts";

test("Code 128B emits the standard start, checksum and stop sequence", () => {
  const encoded = encodeCode128B("ABCD");

  assert.deepEqual(encoded.codewords, [104, 33, 34, 35, 36, 42, 106]);
  assert.equal(encoded.checksum, 42);
  assert.equal(encoded.quietZoneModules, 10);
  assert.equal(encoded.modules.length, 99);
  assert.equal(encoded.modules.slice(0, 10), "0000000000");
  assert.equal(encoded.modules.slice(10, 21), "11010010000");
  assert.equal(encoded.modules.slice(-23, -10), "1100011101011");
  assert.equal(encoded.modules.slice(-10), "0000000000");
  assert.match(encoded.modules, /^[01]+$/);
  assert.equal(decodeCode128BModules(encoded.modules), "ABCD");
});

test("the rendered billing barcode round-trips the canonical account and invoice identifiers", () => {
  const invoice = createWifiInvoice(createReferenceWifiBill());
  const encoded = encodeCode128B(invoice.barcodeValue);
  assert.equal(invoice.barcodeValue, "20025842515 HF2708I003089481");
  assert.equal(decodeCode128BModules(encoded.modules), invoice.barcodeValue);

  const tampered = `${encoded.modules.slice(0, 25)}${encoded.modules[25] === "1" ? "0" : "1"}${encoded.modules.slice(26)}`;
  assert.throws(() => decodeCode128BModules(tampered), /Code 128/);
});

test("Code 128B preserves every printable ASCII character including spaces", () => {
  const value = Array.from({ length: 95 }, (_, index) => String.fromCharCode(index + 32)).join("");
  const first = encodeCode128B(value.slice(0, CODE128_B_MAX_LENGTH));
  const second = encodeCode128B(value.slice(-CODE128_B_MAX_LENGTH));

  assert.equal(first.codewords[1], 0);
  assert.equal(second.codewords.at(-3), 94);
  assert.equal(first.modules.length, 55 + 11 * CODE128_B_MAX_LENGTH);
  assert.equal(second.modules.length, 55 + 11 * CODE128_B_MAX_LENGTH);
});

test("Code 128B rejects empty, non-ASCII and oversized values", () => {
  for (const value of ["", "line\nbreak", "café", "invoice🙂"]) {
    assert.throws(() => encodeCode128B(value), /Code 128B/);
  }
  assert.throws(
    () => encodeCode128B("x".repeat(CODE128_B_MAX_LENGTH + 1)),
    /at most 80 characters/,
  );
  assert.equal(CODE128_QUIET_ZONE_MODULES, 10);
});
