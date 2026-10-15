import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSelectedMonthBillData,
  calculateWifiBill,
  createReferenceWifiBill,
  REFERENCE_WIFI_MONTHLY_RECORDS,
  storedMonthlyAmountPayable,
} from "../src/lib/wifi-bill.ts";
import { encodeCode128B, decodeCode128BModules } from "../src/lib/code128.ts";
import { createWifiInvoice } from "../src/lib/wifi-invoice.ts";
import { buildWifiPaymentQrPayload, parseWifiPaymentQrPayload } from "../src/lib/wifi-qr.ts";

function historySnapshot(data) {
  return [1, 2, 3].map((offset) => ({
    previousDues: data[`history${offset}PreviousDues`],
    payments: data[`history${offset}Payments`],
    paymentCoupon: data[`history${offset}PaymentCoupon`],
    credits: data[`history${offset}Credits`],
    currentCharges: data[`history${offset}CurrentCharges`],
  }));
}

test("August maps its invoice and date while the last payment follows the plan price", () => {
  const data = createReferenceWifiBill("2026-08");
  assert.deepEqual(
    {
      invoiceNumber: data.invoiceNumber,
      previousBalance: data.previousBalance,
      paymentReceived: data.paymentReceived,
      paymentDate: data.paymentDate,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      billDate: data.billDate,
      dueDate: data.dueDate,
    },
    {
      invoiceNumber: "HF2708I003089481",
      previousBalance: "999",
      paymentReceived: "-999",
      paymentDate: "2026-07-15",
      periodStart: "2026-07-05",
      periodEnd: "2026-08-04",
      billDate: "2026-08-06",
      dueDate: "2026-08-16",
    },
  );
  assert.deepEqual(historySnapshot(data).map((row) => row.currentCharges), ["1178.82", "", ""]);
  assert.deepEqual(
    REFERENCE_WIFI_MONTHLY_RECORDS.slice(0, 4).reverse().map((record) => record.currentCharges),
    [470.82, 451.19, 470.82, 588.82],
  );
});

test("September shifts persisted history and uses one plan-priced last payment", () => {
  const data = createReferenceWifiBill("2026-09");
  assert.deepEqual(
    {
      invoiceNumber: data.invoiceNumber,
      previousBalance: data.previousBalance,
      paymentReceived: data.paymentReceived,
      paymentDate: data.paymentDate,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      billDate: data.billDate,
      dueDate: data.dueDate,
    },
    {
      invoiceNumber: "HF2708I003894536",
      previousBalance: "999",
      paymentReceived: "-999",
      paymentDate: "2026-08-16",
      periodStart: "2026-08-05",
      periodEnd: "2026-09-04",
      billDate: "2026-09-06",
      dueDate: "2026-09-16",
    },
  );
  assert.deepEqual(historySnapshot(data).map((row) => row.currentCharges), ["1178.82", "", ""]);
});

test("the selected 999 plan produces the GST-inclusive balance strip", () => {
  const totals = calculateWifiBill(createReferenceWifiBill("2026-09"));
  assert.deepEqual(
    {
      lastBill: totals.previousBalance,
      paymentMade: totals.paymentReceived,
      paymentCoupon: totals.paymentCoupon,
      credits: totals.credits,
      taxable: totals.taxableAmount,
      cgst: totals.cgst,
      sgst: totals.sgst,
      gst: totals.gstTotal,
      currentCharges: totals.totalCurrentCharges,
      amountPayable: totals.totalPayable,
      lateFee: totals.lateFee,
      lateFeeGST: totals.lateFeeGst,
      amountAfterDue: totals.amountAfterDueDate,
    },
    {
      lastBill: 999,
      paymentMade: -999,
      paymentCoupon: 0,
      credits: 0,
      taxable: 999,
      cgst: 89.91,
      sgst: 89.91,
      gst: 179.82,
      currentCharges: 1178.82,
      amountPayable: 1178.82,
      lateFee: 100,
      lateFeeGST: 18,
      amountAfterDue: 1296.82,
    },
  );
});

test("one month-specific invoice number propagates to invoice, QR and barcode", () => {
  const invoice = createWifiInvoice(createReferenceWifiBill("2026-09"));
  const payload = buildWifiPaymentQrPayload(invoice);
  const { parameters, metadata } = parseWifiPaymentQrPayload(payload);
  assert.equal(invoice.identifiers.invoiceNumber, "HF2708I003894536");
  assert.equal(invoice.identifiers.paymentReference, invoice.identifiers.invoiceNumber);
  assert.equal(parameters.get("tr"), invoice.identifiers.invoiceNumber);
  assert.equal(metadata.InvNo, invoice.identifiers.invoiceNumber);
  assert.equal(metadata.PaymentReference, invoice.identifiers.invoiceNumber);
  assert.equal(metadata.AccountNo, invoice.identifiers.accountNumber);
  assert.equal(metadata["HSN/SACCode"], "998412");
  assert.equal(
    decodeCode128BModules(encodeCode128B(invoice.barcodeValue).modules),
    `${invoice.identifiers.accountNumber} ${invoice.identifiers.invoiceNumber}`,
  );
});

test("changing the plan updates every amount in the one displayed previous-month row", () => {
  const august = createReferenceWifiBill("2026-08");
  const storedHistoryBefore = REFERENCE_WIFI_MONTHLY_RECORDS.map((record) => ({ ...record }));
  const cheaperPlan = buildSelectedMonthBillData({
    ...august,
    planDisplayName: "499 WiFi_40_Mbps",
    rentalAmount: "499",
    speed: "40 Mbps",
    amountMode: "inclusive",
  }, REFERENCE_WIFI_MONTHLY_RECORDS, "2026-08");

  assert.equal(cheaperPlan.amountMode, "exclusive");
  assert.equal(cheaperPlan.previousBalance, "499");
  assert.equal(cheaperPlan.paymentReceived, "-499");
  assert.equal(cheaperPlan.history1PreviousDues, "499");
  assert.equal(cheaperPlan.history1Payments, "-499");
  assert.equal(cheaperPlan.history1PaymentCoupon, "0");
  assert.equal(cheaperPlan.history1Credits, "0");
  assert.equal(cheaperPlan.history1CurrentCharges, "588.82");
  assert.equal(cheaperPlan.paymentDate, august.paymentDate);
  assert.equal(calculateWifiBill(august).totalCurrentCharges, 1178.82);
  assert.equal(calculateWifiBill(cheaperPlan).totalCurrentCharges, 588.82);
  const invoice = createWifiInvoice(cheaperPlan);
  assert.equal(invoice.historyRows.length, 1);
  assert.equal(invoice.historyRows[0].payments, -49_900);
  assert.equal(invoice.historyRows[0].currentCharges, 58_882);
  assert.equal(invoice.historyRows[0].payable, 58_882);
  assert.deepEqual(REFERENCE_WIFI_MONTHLY_RECORDS.map((record) => ({ ...record })), storedHistoryBefore);
});

test("stored rows use signed adjustments and missing month invoices cannot be reused", () => {
  const augustRecord = REFERENCE_WIFI_MONTHLY_RECORDS.find((record) => record.billMonth === "2026-08");
  assert.equal(storedMonthlyAmountPayable(augustRecord), 470.82);
  assert.ok(REFERENCE_WIFI_MONTHLY_RECORDS.every((record) => record.payments <= 0 && record.paymentCoupon <= 0 && record.credits <= 0));
  assert.throws(
    () => buildSelectedMonthBillData({ ...createReferenceWifiBill(), billMonth: "2026-10" }, REFERENCE_WIFI_MONTHLY_RECORDS, "2026-10"),
    /Persist the 2026-10 billing record/,
  );
});
