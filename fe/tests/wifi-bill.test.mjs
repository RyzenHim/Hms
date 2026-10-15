import assert from "node:assert/strict";
import test from "node:test";
import {
  amountInWords,
  calculateWifiBill,
  createDefaultWifiBill,
  createReferenceWifiBill,
  formatBillDate,
  formatBillMonth,
  formatMoney,
  getBillingPeriod,
  getBillingDates,
  resolveWifiBillDates,
  validateWifiBill,
  WIFI_BILL_MAX_AMOUNT,
  WIFI_BILL_TEXT_LIMITS,
  WIFI_BILL_LINE_LIMITS,
} from "../src/lib/wifi-bill.ts";

function bill(overrides = {}) {
  return {
    ...createDefaultWifiBill(new Date(2026, 8, 22)),
    providerAddress: "Provider address",
    customerName: "Example Customer",
    customerAddressLine1: "42 Example Road",
    customerCity: "Jaipur",
    customerState: "Rajasthan",
    customerPostalCode: "302020",
    customerPhone: "+91 90000 00000",
    accountNumber: "ACCOUNT-1",
    invoiceNumber: "INVOICE-1",
    paymentUpiId: "test-account@example",
    ...overrides,
  };
}

test("999 plus 18% GST produces the sample totals", () => {
  const data = bill();
  assert.deepEqual(validateWifiBill(data), {});
  const result = calculateWifiBill(data);
  assert.equal(result.taxableAmount, 999);
  assert.equal(result.cgst, 89.91);
  assert.equal(result.sgst, 89.91);
  assert.equal(result.igst, 0);
  assert.equal(result.totalPayable, 1178.82);
  assert.equal(result.lateFee, 100);
  assert.equal(result.lateFeeGst, 18);
  assert.equal(result.lateFeeWithGst, 118);
  assert.equal(result.amountAfterDueDate, 1296.82);
});

test("inclusive amounts extract GST without charging it twice", () => {
  const result = calculateWifiBill(bill({
    rentalAmount: "1178.82", amountMode: "inclusive", taxMode: "igst",
  }));
  assert.equal(result.taxableAmount, 999);
  assert.equal(result.igst, 179.82);
  assert.equal(result.totalCurrentCharges, 1178.82);
  assert.equal(result.cgst + result.sgst, 0);
});

test("discounts precede tax and payment adjustments follow tax", () => {
  const result = calculateWifiBill(bill({
    rentalAmount: "1000", discount: "100", otherCharges: "50",
    previousBalance: "200", paymentReceived: "-100", paymentCoupon: "-10", credits: "-20",
  }));
  assert.equal(result.taxableAmount, 950);
  assert.equal(result.gstTotal, 171);
  assert.equal(result.totalCurrentCharges, 1121);
  assert.equal(result.paymentCoupon, -10);
  assert.equal(result.previousBalanceDue, 70);
  assert.equal(result.totalPayable, 1191);
  assert.equal(result.lateFee, 100);
  assert.equal(result.lateFeeGst, 18);
  assert.equal(result.amountAfterDueDate, 1309);
});

test("split tax conserves an odd paise instead of rounding it twice", () => {
  const result = calculateWifiBill(bill({ rentalAmount: "0.05", gstRate: "18" }));
  assert.equal(result.gstTotal, 0.01);
  assert.equal(result.cgst, 0.01);
  assert.equal(result.sgst, 0);
  assert.equal(result.totalPayable, 0.06);
});

test("inclusive line-item rounding conserves the taxable subtotal", () => {
  const result = calculateWifiBill(bill({
    rentalAmount: "1178.82", discount: "118", otherCharges: "11.80", amountMode: "inclusive",
  }));
  assert.equal(result.rentalBeforeTax, 999);
  assert.equal(result.discountBeforeTax, 100);
  assert.equal(result.otherChargesBeforeTax, 10);
  assert.equal(result.taxableAmount, 909);
  assert.equal(result.totalCurrentCharges, 1072.62);
  for (let paise = 1; paise < 100; paise++) {
    const rounded = calculateWifiBill(bill({
      rentalAmount: (paise / 100).toFixed(2), discount: "0.01", otherCharges: "0.01", amountMode: "inclusive",
    }));
    assert.equal(
      Math.round(rounded.rentalBeforeTax * 100) - Math.round(rounded.discountBeforeTax * 100) + Math.round(rounded.otherChargesBeforeTax * 100),
      Math.round(rounded.taxableAmount * 100),
    );
    assert.ok(rounded.discountBeforeTax >= 0);
    assert.ok(rounded.otherChargesBeforeTax >= 0);
  }
});

test("payments above total due show credit and do not apply a late fee", () => {
  const data = bill({ paymentReceived: "-1200", lateFee: "50" });
  assert.deepEqual(validateWifiBill(data), {});
  const result = calculateWifiBill(data);
  assert.equal(result.totalPayable, 0);
  assert.equal(result.creditBalance, 21.18);
  assert.equal(result.netBalance, -21.18);
  assert.equal(result.lateFee, 0);
  assert.equal(result.lateFeeGst, 0);
  assert.equal(result.amountAfterDueDate, 0);
});

test("a manual late-fee override remains editable and GST follows the overridden value", () => {
  const result = calculateWifiBill(bill({ lateFee: "50" }));
  assert.equal(result.totalPayable, 1178.82);
  assert.equal(result.lateFee, 50);
  assert.equal(result.lateFeeGst, 9);
  assert.equal(result.amountAfterDueDate, 1237.82);
});

test("late payment charges follow the bill-value thresholds, cap and fixed GST rate", () => {
  const cases = [
    { payable: "299.99", fee: 0, gst: 0, afterDue: 299.99 },
    { payable: "300", fee: 100, gst: 18, afterDue: 418 },
    { payable: "5000", fee: 100, gst: 18, afterDue: 5118 },
    { payable: "5000.01", fee: 100, gst: 18, afterDue: 5118.01 },
    { payable: "10000", fee: 200, gst: 36, afterDue: 10236 },
    { payable: "37500", fee: 750, gst: 135, afterDue: 38385 },
    { payable: "40000", fee: 750, gst: 135, afterDue: 40885 },
  ];

  for (const expected of cases) {
    const result = calculateWifiBill(bill({ rentalAmount: expected.payable, gstRate: "0" }));
    assert.equal(result.totalPayable, Number(expected.payable));
    assert.equal(result.lateFee, expected.fee);
    assert.equal(result.lateFeeGst, expected.gst);
    assert.equal(result.amountAfterDueDate, expected.afterDue);
  }
});

test("zero GST and blank optional adjustments are supported", () => {
  const data = bill({ gstRate: "0", discount: "", otherCharges: "", paymentCoupon: "", credits: "", creditLimit: "", securityDeposit: "", lateFee: "" });
  assert.deepEqual(validateWifiBill(data), {});
  assert.equal(calculateWifiBill(data).totalPayable, 999);
});

test("prior-month summary rows accept persisted signed monetary values", () => {
  const data = bill({
    history1PreviousDues: "1178.82", history1Payments: "-1178.82",
    history1PaymentCoupon: "0", history1Credits: "0", history1CurrentCharges: "1178.82",
    history2PreviousDues: "900", history2Payments: "-400.50",
    history2PaymentCoupon: "-25", history2Credits: "-10", history2CurrentCharges: "999",
    history3PreviousDues: "", history3Payments: "", history3PaymentCoupon: "",
    history3Credits: "", history3CurrentCharges: "",
  });
  assert.deepEqual(validateWifiBill(data), {});
  assert.ok(validateWifiBill({ ...data, history2Payments: "1.001" }).history2Payments);
  assert.equal(createDefaultWifiBill().history3CurrentCharges, "");
});

test("invalid numeric edits cannot produce NaN or exportable amounts", () => {
  for (const value of ["", "NaN", "Infinity", "1e2", "-1", "1.001", "1000000000"]) {
    const data = bill({ rentalAmount: value });
    assert.ok(validateWifiBill(data).rentalAmount, `Should reject ${value}`);
    for (const amount of Object.values(calculateWifiBill(data))) assert.ok(Number.isFinite(amount));
  }
  assert.ok(validateWifiBill(bill({ gstRate: "100.01" })).gstRate);
  assert.ok(validateWifiBill(bill({ gstRate: "-1" })).gstRate);
  assert.ok(validateWifiBill(bill({ discount: "1000" })).discount);
});

test("reference periods handle leap years, January rollover, and incomplete dates", () => {
  assert.deepEqual(getBillingPeriod("2024-03"), { periodStart: "2024-02-05", periodEnd: "2024-03-04" });
  assert.deepEqual(getBillingPeriod("2025-03"), { periodStart: "2025-02-05", periodEnd: "2025-03-04" });
  assert.deepEqual(getBillingPeriod("2026-01"), { periodStart: "2025-12-05", periodEnd: "2026-01-04" });
  assert.deepEqual(getBillingDates("2026-08"), { billMonth: "2026-08", billDate: "2026-08-06", dueDate: "2026-08-16", periodStart: "2026-07-05", periodEnd: "2026-08-04" });
  assert.deepEqual(getBillingPeriod("2026-13"), { periodStart: "", periodEnd: "" });
  assert.equal(formatBillDate("2025-02-29"), "—");
  assert.equal(formatBillMonth("2026-09"), "September 2026");
  assert.equal(formatBillMonth(""), "—");
});

test("date validation catches impossible dates and backwards ranges", () => {
  assert.ok(validateWifiBill(bill({ billDate: "2026-02-30" })).billDate);
  assert.ok(validateWifiBill(bill({ dueDate: "2026-09-01" })).dueDate);
  assert.ok(validateWifiBill(bill({ periodStart: "2026-10-01" })).periodEnd);
  assert.ok(validateWifiBill(bill({ paymentDate: "2025-02-29" })).paymentDate);
});

test("defaults contain no sample personal details and require the issuer and customer", () => {
  const data = createDefaultWifiBill(new Date(2026, 11, 22));
  assert.equal(data.billMonth, "2026-12");
  assert.equal(data.billDate, "2026-12-06");
  assert.equal(data.dueDate, "2026-12-16");
  assert.equal(data.customerName, "");
  assert.equal(data.accountNumber, "");
  assert.equal(data.paymentUpiId, "");
  const errors = validateWifiBill(data);
  for (const field of ["providerAddress", "customerName", "customerAddressLine1", "customerCity", "customerState", "customerPostalCode", "customerPhone", "accountNumber", "invoiceNumber"]) {
    assert.ok(errors[field]);
  }
});

test("the visible August PDF prefills every source-backed displayed field", () => {
  const data = createReferenceWifiBill();
  assert.equal(Object.keys(data).length, 89);
  assert.deepEqual(
    Object.entries(data).filter(([, value]) => value === "").map(([field]) => field),
    [
      "issuerSignatureUrl", "issuerSignaturePublicId",
      "history2PreviousDues", "history2Payments", "history2PaymentCoupon", "history2Credits", "history2CurrentCharges",
      "history3PreviousDues", "history3Payments", "history3PaymentCoupon", "history3Credits", "history3CurrentCharges",
      "lateFee", "notes",
    ],
  );
  assert.deepEqual(validateWifiBill(data), {});
  assert.deepEqual(
    {
      customerName: data.customerName,
      customerAddressLine1: data.customerAddressLine1,
      customerCity: data.customerCity,
      customerState: data.customerState,
      customerPostalCode: data.customerPostalCode,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      customerGstin: data.customerGstin,
      accountNumber: data.accountNumber,
      invoiceNumber: data.invoiceNumber,
      wifiId: data.wifiId,
      fixedlineNumber: data.fixedlineNumber,
      billMonth: data.billMonth,
      billDate: data.billDate,
      dueDate: data.dueDate,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
    },
    {
      customerName: "Ms. Jyoti Kumari Singh",
      customerAddressLine1: "Raj Manthan Rd, Sms Colony, Mansarovar",
      customerCity: "Jaipur",
      customerState: "Rajasthan",
      customerPostalCode: "302020",
      customerEmail: "jyoti.k.singh009@gmail.com",
      customerPhone: "7061415974",
      customerGstin: ".",
      accountNumber: "20025842515",
      invoiceNumber: "HF2708I003089481",
      wifiId: "014122815145_wifi",
      fixedlineNumber: "01414543702",
      billMonth: "2026-08",
      billDate: "2026-08-06",
      dueDate: "2026-08-16",
      periodStart: "2026-07-05",
      periodEnd: "2026-08-04",
    },
  );
  assert.equal(data.monthMode, "custom");
  assert.equal(data.paymentInstructions.length, 242);
  assert.equal(data.paymentUpiId, "20025842515.FL@mairtel");
  assert.equal(data.paymentMethod, "Payment via Third Party BBPS (Digital-APBL)");
  assert.equal(data.planDisplayName, "999 WiFi_100_Mbps");
  assert.equal(data.hsnSacCode, "998412");
  assert.equal(data.hsnServiceDescription, "Fixed Telephony Service");
  assert.match(data.tariffAirtelMobile, /\|\s+\|/);
  const storedHistory = [
    { previous: "1178.82", payment: "-1178.82", current: "1178.82" },
    { previous: "", payment: "", current: "" },
    { previous: "", payment: "", current: "" },
  ];
  for (const [index, row] of storedHistory.entries()) {
    const offset = index + 1;
    assert.equal(data[`history${offset}PreviousDues`], row.previous);
    assert.equal(data[`history${offset}Payments`], row.payment);
    assert.equal(data[`history${offset}PaymentCoupon`], offset === 1 ? "0" : "");
    assert.equal(data[`history${offset}Credits`], offset === 1 ? "0" : "");
    assert.equal(data[`history${offset}CurrentCharges`], row.current);
  }
  assert.equal(data.previousBalance, "999");
  assert.equal(data.paymentReceived, "-999");
  assert.equal(data.paymentDate, "2026-07-15");
  const totals = calculateWifiBill(data);
  assert.equal(totals.gstTotal, 179.82);
  assert.equal(totals.totalPayable, 1178.82);
  assert.equal(totals.lateFee, 100);
  assert.equal(totals.lateFeeGst, 18);
  assert.equal(totals.amountAfterDueDate, 1296.82);
});

test("the reference template can switch to system dates without losing its prefill", () => {
  const reference = createReferenceWifiBill();
  const current = resolveWifiBillDates({ ...reference, monthMode: "current" }, new Date(2027, 0, 23));
  assert.equal(current.billMonth, "2027-01");
  assert.equal(current.periodStart, "2026-12-05");
  assert.equal(current.periodEnd, "2027-01-04");
  assert.equal(current.billDate, "2027-01-06");
  assert.equal(current.dueDate, "2027-01-16");
  assert.equal(current.customerName, reference.customerName);
  assert.equal(current.accountNumber, reference.accountNumber);
  assert.equal(current.paymentUpiId, reference.paymentUpiId);
});

test("current month uses the local system clock and refreshes across a year boundary", () => {
  const data = bill({ billMonth: "2026-12" });
  const updated = resolveWifiBillDates(data, new Date(2027, 0, 1, 0, 1));
  assert.equal(updated.billMonth, "2027-01");
  assert.equal(updated.periodStart, "2026-12-05");
  assert.equal(updated.periodEnd, "2027-01-04");
  assert.equal(updated.billDate, "2027-01-06");
  assert.equal(updated.dueDate, "2027-01-16");
  assert.equal(updated.invoiceNumber, data.invoiceNumber);
});

test("custom month retains the selected year and applies the full reference schedule", () => {
  const data = bill({ monthMode: "custom", billMonth: "2024-02" });
  const updated = resolveWifiBillDates(data, new Date(2027, 0, 1));
  assert.equal(updated.billMonth, "2024-02");
  assert.equal(updated.periodStart, "2024-01-05");
  assert.equal(updated.periodEnd, "2024-02-04");
  assert.equal(updated.billDate, "2024-02-06");
  assert.equal(updated.dueDate, "2024-02-16");
  assert.equal(resolveWifiBillDates({ ...data, billMonth: "" }).dueDate, "");
});

test("payment QR requires explicit recipient details and rejects malformed UPI IDs", () => {
  for (const paymentUpiId of ["", "missing-handle", "upi://pay?pa=wrong", "account@example&am=1"]) {
    assert.ok(validateWifiBill(bill({ paymentUpiId })).paymentUpiId);
  }
  assert.ok(validateWifiBill(bill({ paymentPayeeName: "" })).paymentPayeeName);
  assert.ok(validateWifiBill(bill({ paymentMerchantCode: "481" })).paymentMerchantCode);
  assert.ok(validateWifiBill(bill({ paymentMerchantCode: "48A4" })).paymentMerchantCode);
  assert.ok(validateWifiBill(bill({ paymentTransactionNote: "" })).paymentTransactionNote);
});

test("custom signatures require a complete managed Cloudinary reference", () => {
  const issuerSignatureUrl = "https://res.cloudinary.com/demo/image/upload/v1/hms_wifi-signature_0123456789abcdef01234567.png";
  const issuerSignaturePublicId = "hms_wifi-signature_0123456789abcdef01234567";
  assert.deepEqual(validateWifiBill(bill({ issuerSignatureUrl, issuerSignaturePublicId })), {});
  assert.ok(validateWifiBill(bill({ issuerSignatureUrl })).issuerSignatureUrl);
  assert.ok(validateWifiBill(bill({ issuerSignaturePublicId })).issuerSignatureUrl);
  assert.ok(validateWifiBill(bill({ issuerSignatureUrl: "https://example.com/signature.png", issuerSignaturePublicId })).issuerSignatureUrl);
  assert.ok(validateWifiBill(bill({ issuerSignatureUrl, issuerSignaturePublicId: "foreign_asset" })).issuerSignaturePublicId);
});

test("invoice and account identifiers remain Code 128B encodable", () => {
  assert.deepEqual(validateWifiBill(bill({ accountNumber: "20025842515", invoiceNumber: "HF2708I003089481" })), {});
  assert.match(validateWifiBill(bill({ accountNumber: "खाता-1" })).accountNumber, /barcode/);
  assert.match(validateWifiBill(bill({ invoiceNumber: "INV\t01" })).invoiceNumber, /barcode/);
});

test("structured address and service classification reject malformed values", () => {
  assert.ok(validateWifiBill(bill({ customerPostalCode: "30202" })).customerPostalCode);
  assert.ok(validateWifiBill(bill({ customerStateCode: "8" })).customerStateCode);
  assert.ok(validateWifiBill(bill({ hsnSacCode: "9984122" })).hsnSacCode);
  assert.deepEqual(validateWifiBill(bill({ customerStateCode: "08", hsnSacCode: "998412" })), {});
});

test("document limits reject oversized fields and accept the maximum supported amount", () => {
  assert.ok(validateWifiBill(bill({ providerName: "a".repeat(WIFI_BILL_TEXT_LIMITS.providerName + 1) })).providerName);
  assert.ok(validateWifiBill(bill({ notes: "a".repeat(WIFI_BILL_TEXT_LIMITS.notes + 1) })).notes);
  assert.ok(validateWifiBill(bill({ rentalAmount: String(WIFI_BILL_MAX_AMOUNT + 1) })).rentalAmount);
  assert.ok(validateWifiBill(bill({ connections: "1000" })).connections);
  assert.deepEqual(validateWifiBill(bill({ rentalAmount: String(WIFI_BILL_MAX_AMOUNT) })), {});
  assert.equal(calculateWifiBill(bill({ rentalAmount: String(WIFI_BILL_MAX_AMOUNT), gstRate: "100" })).totalPayable, 19999999.98);
});

test("multiline sections enforce A4 line limits including blank and trailing lines", () => {
  for (const [field, maximum] of Object.entries(WIFI_BILL_LINE_LIMITS)) {
    for (const newline of ["\n", "\r\n", "\r"]) {
      const atLimit = Array(maximum).fill("Line").join(newline);
      assert.deepEqual(validateWifiBill(bill({ [field]: atLimit })), {});
      assert.ok(validateWifiBill(bill({ [field]: `${atLimit}${newline}` }))[field]);
      assert.ok(validateWifiBill(bill({ [field]: `Line${newline.repeat(maximum)}` }))[field]);
    }
  }
});

test("all single-line fields reject CR and LF even when trimming would hide them", () => {
  const data = bill();
  for (const field of Object.keys(data)) {
    if (WIFI_BILL_LINE_LIMITS[field]) continue;
    for (const newline of ["\n", "\r\n", "\r"]) {
      assert.ok(validateWifiBill(bill({ [field]: `${data[field]}${newline}` }))[field], `${field} must reject line breaks`);
    }
  }
});

test("words and currency use rupees, paise, and Indian number grouping", () => {
  assert.equal(amountInWords(1178.82), "One Thousand One Hundred Seventy Eight Rupees and Eighty Two Paise Only");
  assert.equal(amountInWords(100001.01), "One Lakh One Rupees and One Paisa Only");
  assert.equal(amountInWords(0), "Zero Rupees Only");
  assert.equal(amountInWords(1), "One Rupee Only");
  assert.equal(formatMoney(123456.78), "₹1,23,456.78");
});
