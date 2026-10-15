import assert from "node:assert/strict";
import test from "node:test";
import QRCode from "qrcode";
import { encodeCode128B } from "../src/lib/code128.ts";
import { createReferenceWifiBill } from "../src/lib/wifi-bill.ts";
import { createWifiInvoice } from "../src/lib/wifi-invoice.ts";
import { buildWifiPaymentQrPayload } from "../src/lib/wifi-qr.ts";
import {
  decodeQrModuleMatrix,
  decodeRenderedCode128,
  validateWifiInvoiceForExport,
} from "../src/lib/wifi-export-validation.ts";

function fixture() {
  const invoice = createWifiInvoice(createReferenceWifiBill());
  const qrPayload = buildWifiPaymentQrPayload(invoice);
  const decodedQrPayload = decodeQrModuleMatrix(QRCode.create(qrPayload, { errorCorrectionLevel: "M" }).modules);
  return {
    invoice,
    artifacts: {
      qrPayload,
      decodedQrPayload,
      barcodeModules: encodeCode128B(invoice.barcodeValue).modules,
    },
  };
}

test("one canonical invoice drives address, plan, HSN, amounts, QR and barcode", () => {
  const { invoice, artifacts } = fixture();
  assert.deepEqual(invoice.customer.addressLines, [
    "Raj Manthan Rd, Sms Colony, Mansarovar",
    "Jaipur, Rajasthan, 302020",
  ]);
  assert.equal(invoice.customer.addressLines.join(" ").match(/Jaipur/g)?.length, 1);
  assert.equal(invoice.customer.addressLines.join(" ").match(/Rajasthan/g)?.length, 1);
  assert.equal(invoice.plan.displayName, "999 WiFi_100_Mbps");
  assert.equal(invoice.plan.hsnSacCode, "998412");
  assert.equal(invoice.calculations.totalPayable, 1178.82);
  assert.equal(invoice.calculations.amountAfterDueDate, 1296.82);
  assert.equal(invoice.barcodeValue, "20025842515 HF2708I003089481");
  assert.equal(decodeRenderedCode128(artifacts.barcodeModules), invoice.barcodeValue);
  assert.deepEqual(validateWifiInvoiceForExport(invoice, artifacts), []);
});

test("pre-export validation blocks QR, barcode and calculation drift", () => {
  const { invoice, artifacts } = fixture();

  const hsnUrl = new URL(artifacts.qrPayload);
  hsnUrl.searchParams.set("orgId", hsnUrl.searchParams.get("orgId").replace("998412", "998422"));
  const badQr = hsnUrl.toString();
  assert.ok(validateWifiInvoiceForExport(invoice, {
    ...artifacts,
    qrPayload: badQr,
    decodedQrPayload: badQr,
  }).some((issue) => issue.includes("QR HSN / SAC")));

  assert.ok(validateWifiInvoiceForExport(invoice, {
    ...artifacts,
    barcodeModules: encodeCode128B("DIFFERENT ACCOUNT").modules,
  }).some((issue) => issue.includes("Barcode")));

  const driftedInvoice = {
    ...invoice,
    calculations: { ...invoice.calculations, amountAfterDueDate: 1 },
  };
  assert.ok(validateWifiInvoiceForExport(driftedInvoice, artifacts)
    .some((issue) => issue.includes("Amount after due date")));

  const driftedIdentifiers = {
    ...invoice,
    identifiers: { ...invoice.identifiers, dueDate: "2026-08-99" },
  };
  assert.ok(validateWifiInvoiceForExport(driftedIdentifiers, artifacts)
    .some((issue) => issue.includes("Due date")));
});
