import assert from "node:assert/strict";
import test from "node:test";
import QRCode from "qrcode";
import { createDefaultWifiBill, createReferenceWifiBill, calculateWifiBill } from "../src/lib/wifi-bill.ts";
import {
  buildWifiPaymentQrPayload,
  deriveAirtelPaymentUpiId,
  getWifiPaymentQrIssue,
  isDerivedAirtelPaymentUpiId,
  isValidUpiId,
  syncWifiPaymentUpiId,
  withDerivedAirtelPaymentUpiId,
} from "../src/lib/wifi-qr.ts";

function bill(overrides = {}) {
  return {
    ...createDefaultWifiBill(new Date(2026, 8, 25)),
    paymentUpiId: "test.account@bank",
    paymentPayeeName: "Example Broadband & Services",
    invoiceNumber: "INV-2026-09",
    providerGstin: "08ABCDE1234F1Z5",
    hsnCode: "998422",
    ...overrides,
  };
}

function qr(data) {
  const payload = buildWifiPaymentQrPayload(data, calculateWifiBill(data));
  const parameters = new URL(payload).searchParams;
  const [organization, ...entries] = parameters.get("orgId").split(",");
  return {
    payload,
    parameters,
    organization,
    metadata: Object.fromEntries(entries.map((entry) => {
      const delimiter = entry.indexOf("=");
      return [entry.slice(0, delimiter), decodeURIComponent(entry.slice(delimiter + 1))];
    })),
  };
}

test("payment QR preserves all reference metadata keys and uses current bill values", () => {
  const { payload, parameters, organization, metadata } = qr(bill());
  assert.equal(parameters.get("pa"), "test.account@bank");
  assert.equal(parameters.get("pn"), "Example Broadband & Services");
  assert.equal(parameters.get("tr"), "INV-2026-09");
  assert.equal(parameters.get("mc"), "4814");
  assert.equal(parameters.get("tn"), "121-Telemedia-BAL");
  assert.equal(parameters.get("cu"), "INR");
  assert.equal(parameters.get("mode"), "01");
  assert.equal(parameters.get("purpose"), "00");
  assert.equal(parameters.get("am"), "1178.82");
  assert.equal(parameters.get("mam"), "1178.82");
  assert.deepEqual([...parameters.keys()], [
    "pa", "pn", "mc", "tr", "tn", "cu", "am", "mam", "mode", "purpose", "orgId",
  ]);
  assert.equal(organization, "000000");
  assert.deepEqual(metadata, {
    InvNo: "INV-2026-09",
    InvoiceBilldate: "06-Sep-26",
    ItemCount: "1",
    "HSN/SACCode": "998422",
    SellerGST: "08ABCDE1234F1Z5",
    "Payee Bank AcctNo": "",
    IFSC_CODE: "",
    Tot_GST: "179.82",
    CGST: "89.91",
    SGST: "89.91",
    IGST: "0.00",
    CESS: "0.00",
    TotalInvAmt: "1178.82",
  });
  for (const staleValue of ["20025842515", "HF2708I003089481", "06-Aug-26", "470.82", "71.82", "998412"]) {
    assert.ok(!payload.includes(staleValue), `${staleValue} must not leak from the reference`);
  }
});

test("the untouched visible-PDF prefill generates its coherent payable QR", () => {
  const { parameters, metadata } = qr(createReferenceWifiBill());
  assert.equal(parameters.get("pa"), "20025842515.FL@mairtel");
  assert.equal(parameters.get("pn"), "Bharti Hexacom Limited");
  assert.equal(parameters.get("tr"), "HF2708I003089481");
  assert.equal(parameters.get("am"), "1178.82");
  assert.equal(parameters.get("mam"), "1178.82");
  assert.equal(metadata.InvoiceBilldate, "06-Aug-26");
  assert.equal(metadata["HSN/SACCode"], "998422");
  assert.equal(metadata.Tot_GST, "179.82");
  assert.equal(metadata.CGST, "89.91");
  assert.equal(metadata.SGST, "89.91");
  assert.equal(metadata.TotalInvAmt, "1178.82");
});

test("UPI payment destination, merchant code and description come from user input", () => {
  const { payload, parameters } = qr(bill({
    paymentUpiId: "customer.wifi@provider",
    paymentPayeeName: "Customer WiFi Services",
    paymentMerchantCode: "4900",
    paymentTransactionNote: "September broadband bill",
  }));
  assert.match(payload, /^upi:\/\/pay\?/);
  assert.equal(parameters.get("pa"), "customer.wifi@provider");
  assert.equal(parameters.get("pn"), "Customer WiFi Services");
  assert.equal(parameters.get("mc"), "4900");
  assert.equal(parameters.get("tn"), "September broadband bill");
  assert.equal(parameters.get("cu"), "INR");
  assert.equal(parameters.get("am"), "1178.82");
  assert.equal(parameters.get("mam"), "1178.82");
});

test("Airtel payment UPI ID follows the account until the user overrides it", () => {
  assert.equal(deriveAirtelPaymentUpiId(" 20025842515 "), "20025842515.FL@mairtel");
  const initial = bill({
    providerName: "Bharti Hexacom Limited",
    accountNumber: "20025842515",
    paymentUpiId: "",
  });
  const hydrated = withDerivedAirtelPaymentUpiId(initial);
  assert.equal(hydrated.paymentUpiId, "20025842515.FL@mairtel");
  assert.equal(isDerivedAirtelPaymentUpiId(hydrated), true);

  assert.equal(syncWifiPaymentUpiId({ ...hydrated, accountNumber: "30000000001" }, false), "30000000001.FL@mairtel");
  assert.equal(syncWifiPaymentUpiId({ ...hydrated, providerName: "Other Broadband" }, false), "");
  assert.equal(syncWifiPaymentUpiId({ ...hydrated, accountNumber: "30000000001", paymentUpiId: "custom@bank" }, true), "custom@bank");
  assert.equal(withDerivedAirtelPaymentUpiId({ ...hydrated, paymentUpiId: "custom@bank" }).paymentUpiId, "custom@bank");
});

test("QR readiness explains the first missing or invalid payment detail", () => {
  const missingAccount = bill({ accountNumber: "", paymentUpiId: "" });
  assert.match(getWifiPaymentQrIssue(missingAccount, calculateWifiBill(missingAccount)), /Airtel account number/);

  const invalidUpi = bill({ paymentUpiId: "not a upi id" });
  assert.match(getWifiPaymentQrIssue(invalidUpi, calculateWifiBill(invalidUpi)), /valid payment UPI ID/);

  const noBalance = bill({ paymentReceived: "1200" });
  assert.match(getWifiPaymentQrIssue(noBalance, calculateWifiBill(noBalance)), /greater than zero/);
  assert.equal(getWifiPaymentQrIssue(bill(), calculateWifiBill(bill())), "");
});

test("invoice metadata and payment amount stay consistent with adjustments and IGST", () => {
  const { parameters, metadata } = qr(bill({
    rentalAmount: "1000", discount: "100", otherCharges: "50", taxMode: "igst",
    previousBalance: "200", paymentReceived: "100", credits: "20",
    invoiceNumber: "CUSTOM-02", billDate: "2024-02-06",
  }));
  assert.equal(parameters.get("tr"), "CUSTOM-02");
  assert.equal(parameters.get("am"), "1201.00");
  assert.equal(parameters.get("mam"), "1201.00");
  assert.equal(metadata.TotalInvAmt, "1121.00");
  assert.equal(metadata.Tot_GST, "171.00");
  assert.equal(metadata.CGST, "0.00");
  assert.equal(metadata.SGST, "0.00");
  assert.equal(metadata.IGST, "171.00");
  assert.equal(metadata.ItemCount, "2");
  assert.equal(metadata.InvoiceBilldate, "06-Feb-24");
});

test("payment QR is absent for invalid inputs or a zero payable balance", () => {
  for (const overrides of [
    { paymentUpiId: "" }, { paymentUpiId: "test@bank&am=1" },
    { paymentUpiId: "upi://pay?pa=test@bank" }, { paymentPayeeName: " " },
    { paymentMerchantCode: "" }, { paymentMerchantCode: "481" },
    { paymentTransactionNote: "" }, { paymentTransactionNote: "line one\nline two" },
    { invoiceNumber: "" }, { invoiceNumber: "x".repeat(36) },
    { billDate: "2025-02-29" }, { paymentReceived: "1200" },
  ]) {
    const data = bill(overrides);
    assert.equal(buildWifiPaymentQrPayload(data, calculateWifiBill(data)), "");
  }
  assert.equal(isValidUpiId("sample.FL@mairtel"), true);
  assert.equal(isValidUpiId("a".repeat(100) + "@bank"), false);
});

test("invoice separators cannot inject duplicate QR metadata or payment query parameters", () => {
  const invoiceNumber = "INV/09,TotalInvAmt=0&am=1%";
  const { parameters, metadata } = qr(bill({ invoiceNumber }));
  assert.equal(parameters.get("tr"), invoiceNumber);
  assert.equal(parameters.getAll("am").length, 1);
  assert.equal(parameters.get("am"), "1178.82");
  assert.equal(metadata.InvNo, invoiceNumber);
  assert.equal(metadata.TotalInvAmt, "1178.82");
});

test("complete metadata fits a real QR with four-module quiet zone", async () => {
  const { payload } = qr(bill());
  const svg = await QRCode.toString(payload, { type: "svg", errorCorrectionLevel: "M", margin: 4 });
  assert.match(svg, /<svg/);
  const code = QRCode.create(payload, { errorCorrectionLevel: "M" });
  assert.ok(code.modules.size <= 101, "Payment QR should remain readable at the document's printed size");
});
