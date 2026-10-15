const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const WifiCustomer = require("../models/WifiCustomer");
const WifiBill = require("../models/WifiBill");
const {
  WIFI_BILL_FIELDS,
  WIFI_BILL_AMOUNT_FIELDS,
  WIFI_BILL_SIGNED_AMOUNT_FIELDS,
  WIFI_BILL_TEXT_LIMITS,
  WIFI_BILL_LINE_LIMITS,
  WIFI_SERVICE_CONFIGURATION,
  DEFAULT_HSN_SAC_CODE,
  DEFAULT_HSN_SERVICE_DESCRIPTION,
  validateDraftData,
  dataToStorage,
  dataFromStorage,
  customerFromData,
  customerFromStorage,
} = require("../services/wifi-bill-data");

function expectInvalid(input, field) {
  assert.throws(() => validateDraftData(input), (error) => {
    assert.equal(error.statusCode, 400);
    assert.equal(typeof error.message, "string");
    assert.equal(typeof error.errors[field], "string");
    return true;
  });
}

test("drafts expose only canonical bill fields and preserve unfinished optional values", () => {
  assert.deepEqual(WIFI_SERVICE_CONFIGURATION, {
    hsnSacCode: "998412",
    description: "Fixed telephony services",
  });
  for (const field of [
    "customerAddressLine1", "customerCity", "customerPostalCode", "planDisplayName",
    "hsnSacCode", "hsnServiceDescription",
  ]) assert.ok(WIFI_BILL_FIELDS.includes(field));
  for (const field of [
    "customerAddress", "planName", "hsnCode", "hsnServiceInformation", "billingBarcodeValue",
  ]) assert.equal(WIFI_BILL_FIELDS.includes(field), false);
  const draft = validateDraftData({ customerName: "  Sam  ", customerEmail: "sam@", paymentUpiId: "incomplete@", customerPhone: "+" });
  assert.equal(draft.customerName, "Sam");
  assert.equal(draft.customerEmail, "sam@");
  assert.equal(draft.paymentUpiId, "incomplete@");
  assert.equal(draft.customerPhone, "+");
  assert.equal(draft.monthMode, "current");
  assert.equal(draft.taxMode, "split");
  assert.equal(draft.amountMode, "exclusive");
  for (const field of WIFI_BILL_AMOUNT_FIELDS) assert.equal(draft[field], "");
  assert.equal(draft.connections, "");
  assert.equal(draft.billMonth, "");
  assert.equal(draft.billDate, "");
  assert.equal(draft.hsnSacCode, DEFAULT_HSN_SAC_CODE);
  assert.equal(draft.hsnServiceDescription, DEFAULT_HSN_SERVICE_DESCRIPTION);
  expectInvalid({}, "customerName");
  expectInvalid({ customerName: " \t " }, "customerName");
});

test("draft validation rejects unknown fields and incorrect types without Mongo casting", () => {
  for (const input of [null, [], "text", 5, new Date()]) expectInvalid(input, "data");
  for (const field of WIFI_BILL_FIELDS) {
    for (const value of [undefined, null, 12, true, [], {}]) {
      expectInvalid({ customerName: "Sam", [field]: value }, field);
    }
  }
  expectInvalid({ customerName: "Sam", customerId: "client-controlled" }, "customerId");
  for (const legacyField of ["customerAddress", "planName", "hsnCode", "hsnServiceInformation", "billingBarcodeValue"]) {
    expectInvalid({ customerName: "Sam", [legacyField]: "legacy" }, legacyField);
  }
  expectInvalid(JSON.parse('{"customerName":"Sam","__proto__":{"admin":true}}'), "__proto__");
  for (const field of ["monthMode", "taxMode", "amountMode"]) {
    expectInvalid({ customerName: "Sam", [field]: "" }, field);
    expectInvalid({ customerName: "Sam", [field]: "unknown" }, field);
  }
});

test("all printable text and explicit line breaks stay within frontend limits", () => {
  for (const [field, limit] of Object.entries(WIFI_BILL_TEXT_LIMITS)) {
    if ([
      "issuerSignatureUrl", "issuerSignaturePublicId", "customerPostalCode",
      "customerStateCode", "hsnSacCode",
    ].includes(field)) continue;
    assert.equal(validateDraftData({ customerName: "Sam", [field]: "x".repeat(limit) })[field].length, limit);
    expectInvalid({ customerName: "Sam", [field]: "x".repeat(limit + 1) }, field);
  }
  for (const [field, limit] of Object.entries(WIFI_BILL_LINE_LIMITS)) {
    assert.equal(validateDraftData({ customerName: "Sam", [field]: "x\r\n".repeat(limit - 1) })[field], "x\r\n".repeat(limit - 1));
    expectInvalid({ customerName: "Sam", [field]: "\n".repeat(limit) }, field);
  }
  for (const field of WIFI_BILL_FIELDS.filter((field) => !WIFI_BILL_LINE_LIMITS[field])) {
    expectInvalid({ customerName: "Sam", [field]: "a\nb" }, field);
  }
  const identifiers = validateDraftData({ customerName: "Sam", accountNumber: "20025842515", invoiceNumber: "HF2708I003089481" });
  assert.equal(identifiers.accountNumber, "20025842515");
  assert.equal(identifiers.invoiceNumber, "HF2708I003089481");
  expectInvalid({ customerName: "Sam", accountNumber: "खाता-1" }, "accountNumber");
  expectInvalid({ customerName: "Sam", invoiceNumber: "INV\t01" }, "invoiceNumber");
});

test("structured address codes and HSN/SAC use canonical numeric formats", () => {
  const canonical = validateDraftData({
    customerName: "Sam",
    customerAddressLine1: "Raj Manthan Rd, Sms Colony, Mansarovar",
    customerCity: "Jaipur",
    customerPostalCode: "302020",
    customerStateCode: "08",
    hsnSacCode: "998422",
  });
  assert.equal(canonical.customerPostalCode, "302020");
  assert.equal(canonical.customerStateCode, "08");
  assert.equal(canonical.hsnSacCode, "998422");
  assert.equal(WIFI_BILL_TEXT_LIMITS.customerAddressLine1, 180);
  assert.equal(WIFI_BILL_TEXT_LIMITS.customerCity, 60);
  assert.equal(WIFI_BILL_TEXT_LIMITS.customerPostalCode, 10);
  assert.equal(WIFI_BILL_TEXT_LIMITS.hsnSacCode, 6);

  for (const value of ["30202", "3020200", "302O20", "30-2020"]) {
    expectInvalid({ customerName: "Sam", customerPostalCode: value }, "customerPostalCode");
  }
  for (const value of ["8", "008", "0A", "0-8"]) {
    expectInvalid({ customerName: "Sam", customerStateCode: value }, "customerStateCode");
  }
  for (const value of ["99842", "9984220", "998A22", "998-22"]) {
    expectInvalid({ customerName: "Sam", hsnSacCode: value }, "hsnSacCode");
  }
});

test("custom signature references must be a complete managed Cloudinary pair", () => {
  const issuerSignatureUrl = "https://res.cloudinary.com/demo/image/upload/v1/hms_wifi-signature_0123456789abcdef01234567.png";
  const issuerSignaturePublicId = "hms_wifi-signature_0123456789abcdef01234567";
  const draft = validateDraftData({ customerName: "Sam", issuerSignatureUrl, issuerSignaturePublicId });
  assert.equal(draft.issuerSignatureUrl, issuerSignatureUrl);
  assert.equal(draft.issuerSignaturePublicId, issuerSignaturePublicId);
  expectInvalid({ customerName: "Sam", issuerSignatureUrl }, "issuerSignatureUrl");
  expectInvalid({ customerName: "Sam", issuerSignaturePublicId }, "issuerSignatureUrl");
  expectInvalid({ customerName: "Sam", issuerSignatureUrl: "https://example.com/signature.png", issuerSignaturePublicId }, "issuerSignatureUrl");
  expectInvalid({ customerName: "Sam", issuerSignatureUrl, issuerSignaturePublicId: "foreign_asset" }, "issuerSignaturePublicId");
});

test("amounts reject malformed, excessive precision and out of range values while accounting adjustments stay signed", () => {
  for (const field of WIFI_BILL_AMOUNT_FIELDS) {
    for (const value of ["NaN", "Infinity", "1e2", "0x12", "+1", "1,000", ".5", "1.", "1.005", "9".repeat(1000), " ".repeat(1000)]) {
      expectInvalid({ customerName: "Sam", [field]: value }, field);
    }
    if (!WIFI_BILL_SIGNED_AMOUNT_FIELDS.includes(field)) {
      expectInvalid({ customerName: "Sam", [field]: "-1" }, field);
    }
  }
  for (const field of WIFI_BILL_SIGNED_AMOUNT_FIELDS) {
    assert.equal(validateDraftData({ customerName: "Sam", [field]: "-451.19" })[field], "-451.19");
  }
  expectInvalid({ customerName: "Sam", rentalAmount: "10000000" }, "rentalAmount");
  expectInvalid({ customerName: "Sam", gstRate: "100.01" }, "gstRate");
  assert.equal(validateDraftData({ customerName: "Sam", rentalAmount: "9999999.99", gstRate: "100" }).rentalAmount, "9999999.99");
  // Drafts may temporarily have a discount above the rental while editing.
  assert.equal(validateDraftData({ customerName: "Sam", rentalAmount: "1", discount: "2" }).discount, "2");
  for (const value of ["0", "-1", "1000", "1.5", "1e2", "x"]) {
    expectInvalid({ customerName: "Sam", connections: value }, "connections");
  }
  assert.equal(validateDraftData({ customerName: "Sam", connections: "999" }).connections, "999");
});

test("calendar validation rejects rollover dates and invalid months and accepts leap days", () => {
  for (const value of ["2025-02-29", "2024-02-30", "2026-04-31", "2026-13-01", "2026-00-10", "2026-1-01", "not a date"]) {
    expectInvalid({ customerName: "Sam", billDate: value }, "billDate");
    expectInvalid({ customerName: "Sam", paymentDate: value }, "paymentDate");
  }
  assert.equal(validateDraftData({ customerName: "Sam", billDate: "2024-02-29" }).billDate, "2024-02-29");
  for (const value of ["2026-00", "2026-13", "2026-1", "1899-12", "2026-09-01"]) {
    expectInvalid({ customerName: "Sam", billMonth: value }, "billMonth");
  }
  assert.equal(validateDraftData({ customerName: "Sam", billMonth: "1900-01" }).billMonth, "1900-01");
});

test("storage round trips exact decimal amounts and blank fields without inserting zero", () => {
  const draft = validateDraftData({ customerName: "Sam", rentalAmount: "9999999.99", discount: "0.10", paymentCoupon: "-25.50", history1PreviousDues: "1178.82", history1Payments: "-1178.82", creditLimit: "2500", securityDeposit: "0", gstRate: "18.25", connections: "7", notes: "First line\nSecond line" });
  const stored = dataToStorage(draft);
  assert.ok(stored.rentalAmount instanceof mongoose.Types.Decimal128);
  assert.equal(stored.rentalAmount.toString(), "9999999.99");
  assert.equal(stored.discount.toString(), "0.10");
  assert.equal(stored.paymentCoupon.toString(), "-25.50");
  assert.equal(stored.history1PreviousDues.toString(), "1178.82");
  assert.equal(stored.history1Payments.toString(), "-1178.82");
  assert.equal(stored.creditLimit.toString(), "2500");
  assert.equal(stored.securityDeposit.toString(), "0");
  assert.equal(stored.gstRate.toString(), "18.25");
  assert.equal(stored.lateFee, null);
  assert.equal(stored.otherCharges, null);
  assert.equal(stored.connections, 7);
  assert.deepEqual(dataFromStorage(stored), draft);
  const emptyStored = dataToStorage({ customerName: "Sam", rentalAmount: "  ", connections: "  " });
  assert.equal(emptyStored.rentalAmount, null);
  assert.equal(emptyStored.connections, null);
  assert.equal(dataFromStorage(emptyStored).rentalAmount, "");
  assert.equal(dataFromStorage(emptyStored).connections, "");
  assert.equal(dataFromStorage({ ...stored, _id: "internal" })._id, undefined);
  for (const legacyField of ["customerAddress", "planName", "hsnCode", "hsnServiceInformation", "billingBarcodeValue"]) {
    assert.equal(Object.hasOwn(stored, legacyField), false);
  }
});

test("legacy snapshots are normalized on read while new writes remain canonical", () => {
  const legacyBill = WifiBill.hydrate({
    _id: "000000000000000000000001",
    customer: "000000000000000000000002",
    data: {
      customerName: "Legacy customer",
      customerAddress: "Raj Manthan Rd, Sms Colony, Mansarovar, Jaipur, Rajasthan\nJaipur, Rajasthan, 302020,",
      customerState: "Rajasthan",
      planName: "999 WiFi_100_Mbps",
      hsnCode: "998422",
      hsnServiceInformation: "998412 Fixed Telephony Service",
      billingBarcodeValue: "legacy barcode payload",
    },
  });
  const migrated = dataFromStorage(legacyBill.data);
  assert.equal(migrated.customerAddressLine1, "Raj Manthan Rd, Sms Colony, Mansarovar");
  assert.equal(migrated.customerCity, "Jaipur");
  assert.equal(migrated.customerPostalCode, "302020");
  assert.equal(migrated.planDisplayName, "999 WiFi_100_Mbps");
  assert.equal(migrated.hsnSacCode, "998422");
  assert.equal(migrated.hsnServiceDescription, "");
  for (const legacyField of ["customerAddress", "planName", "hsnCode", "hsnServiceInformation", "billingBarcodeValue"]) {
    assert.equal(Object.hasOwn(migrated, legacyField), false);
  }
});

test("customer extraction is explicit and keeps contact details independent from invoice data", () => {
  assert.deepEqual(customerFromData({ customerName: "Sam", customerAddressLine1: "A", customerCity: "B", customerPostalCode: "302020", customerEmail: "s@", accountNumber: "A001", rentalAmount: "100" }), {
    name: "Sam", addressLine1: "A", city: "B", postalCode: "302020", email: "s@", phone: "", gstin: "", state: "", stateCode: "", accountNumber: "A001", wifiId: "", fixedlineNumber: "", paymentUpiId: "",
  });
  assert.deepEqual(customerFromStorage({ name: "Legacy", address: "Street, Jaipur, Rajasthan, 302020", state: "Rajasthan" }), {
    name: "Legacy", addressLine1: "Street", city: "Jaipur", postalCode: "302020", email: "", phone: "", gstin: "", state: "Rajasthan", stateCode: "", accountNumber: "", wifiId: "", fixedlineNumber: "", paymentUpiId: "",
  });
});

test("schemas use stable customer IDs, nonunique names, typed snapshots, and versioned edits", async () => {
  const firstCustomer = new WifiCustomer({ name: "Sam" });
  const secondCustomer = new WifiCustomer({ name: "Sam" });
  assert.notEqual(String(firstCustomer._id), String(secondCustomer._id));
  await firstCustomer.validate();
  await secondCustomer.validate();
  assert.equal(WifiCustomer.schema.path("name").options.index, true);
  assert.notEqual(WifiCustomer.schema.path("name").options.unique, true);
  for (const field of ["addressLine1", "city", "postalCode"]) assert.equal(WifiCustomer.schema.path(field).instance, "String");
  assert.equal(WifiCustomer.schema.path("address"), undefined);
  assert.equal(WifiCustomer.schema.options.timestamps, true);
  assert.equal(WifiCustomer.schema.options.bufferCommands, false);
  assert.equal(WifiCustomer.schema.virtualpath("bills").options.ref, "WifiBill");
  assert.equal(WifiCustomer.schema.virtualpath("bills").options.localField, "_id");
  assert.equal(WifiCustomer.schema.virtualpath("bills").options.foreignField, "customer");
  assert.ok(WifiCustomer.schema.indexes().some(([keys]) => keys.updatedAt === -1));
  assert.equal(WifiBill.schema.path("customer").instance, "ObjectId");
  assert.equal(WifiBill.schema.path("customer").options.ref, "WifiCustomer");
  assert.equal(WifiBill.schema.path("customer").options.index, true);
  assert.equal(WifiBill.schema.path("customer").options.required, true);
  assert.equal(WifiBill.schema.options.versionKey, "version");
  assert.equal(WifiBill.schema.options.optimisticConcurrency, true);
  assert.equal(WifiBill.schema.options.timestamps, true);
  assert.equal(WifiBill.schema.options.bufferCommands, false);
  assert.equal(WifiBill.schema.path("clientDraftId").options.immutable, true);
  assert.notEqual(WifiBill.schema.path("clientDraftId").options.required, true);
  assert.ok(WifiBill.schema.indexes().some(([keys, options]) => keys.clientDraftId === 1 && options.unique && options.sparse));
  assert.ok(WifiBill.schema.indexes().some(([keys]) => keys.customer === 1 && keys.updatedAt === -1));
  assert.ok(WifiBill.schema.indexes().some(([keys, options]) =>
    keys.customer === 1 && keys["data.billMonth"] === 1 && options.unique && options.partialFilterExpression));
  assert.ok(WifiBill.schema.indexes().some(([keys, options]) =>
    keys["data.invoiceNumber"] === 1 && options.unique && options.partialFilterExpression));
  const snapshot = WifiBill.schema.path("data").schema;
  assert.deepEqual(Object.keys(snapshot.paths).sort(), [...WIFI_BILL_FIELDS].sort());
  for (const field of WIFI_BILL_FIELDS) {
    assert.equal(snapshot.path(field).instance,
      WIFI_BILL_AMOUNT_FIELDS.includes(field) ? "Decimal128" : field === "connections" ? "Number" : "String");
  }
  const bill = new WifiBill({ customer: firstCustomer._id, data: dataToStorage({ customerName: "Sam" }) });
  assert.equal(bill.version, 0);
  await bill.validate();
  assert.deepEqual(dataFromStorage(bill.data), validateDraftData({ customerName: "Sam" }));
  await assert.rejects(new WifiBill({ data: dataToStorage({ customerName: "Sam" }) }).validate(), (error) => Boolean(error.errors.customer));
  await assert.rejects(new WifiBill({ customer: firstCustomer._id }).validate(), (error) => Boolean(error.errors.data));
  bill.data.connections = 1.5;
  await assert.rejects(bill.validate(), (error) => Boolean(error.errors["data.connections"]));
  bill.data.connections = null;
  bill.data.rentalAmount = mongoose.Types.Decimal128.fromString("1.005");
  await assert.rejects(bill.validate(), (error) => Boolean(error.errors["data.rentalAmount"]));
  const retrySafeBill = new WifiBill({
    customer: firstCustomer._id,
    clientDraftId: "374a1001-005d-4a71-82f3-1be992b7eb95",
    data: dataToStorage({ customerName: "Sam" }),
  });
  await retrySafeBill.validate();
  retrySafeBill.clientDraftId = "malformed";
  await assert.rejects(retrySafeBill.validate(), (error) => Boolean(error.errors.clientDraftId));
});
