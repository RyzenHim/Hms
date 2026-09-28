const mongoose = require("mongoose");

// Keep the API shape and printable text limits in sync with fe/src/types/wifi-bill.ts
// and fe/src/lib/wifi-bill.ts. Saving a draft does not require an issuable invoice.
const WIFI_BILL_MAX_AMOUNT = 9_999_999.99;
const WIFI_BILL_TEXT_LIMITS = Object.freeze({
  providerName: 70,
  providerAddress: 240,
  providerGstin: 15,
  supportPhone: 25,
  supportEmail: 100,
  paymentInstructions: 260,
  paymentUpiId: 100,
  paymentPayeeName: 70,
  paymentMerchantCode: 4,
  paymentTransactionNote: 80,
  issuerSignatoryName: 80,
  issuerSignatoryTitle: 100,
  issuerSignatureUrl: 500,
  issuerSignaturePublicId: 200,
  providerPan: 10,
  providerCin: 21,
  providerServiceCategory: 80,
  registeredOffice: 300,
  corporateOffice: 300,
  contactInformation: 500,
  appellateInformation: 450,
  corporateCoordinatorInformation: 250,
  chargesInformation: 650,
  addressChangeInformation: 300,
  otherInformation: 900,
  fupInformation: 350,
  hsnServiceInformation: 700,
  customerName: 80,
  customerAddress: 240,
  customerEmail: 100,
  customerPhone: 20,
  customerGstin: 15,
  customerState: 40,
  customerStateCode: 2,
  accountNumber: 40,
  invoiceNumber: 35,
  billingBarcodeValue: 80,
  wifiId: 60,
  fixedlineNumber: 25,
  planName: 80,
  speed: 30,
  quota: 40,
  hsnCode: 12,
  paymentMethod: 100,
  tariffAirtelFixedline: 160,
  tariffOtherFixedline: 160,
  tariffAirtelMobile: 160,
  tariffOtherMobile: 160,
  tariffFixedlineCug: 160,
  tariffWll: 160,
  notes: 650,
});
const WIFI_BILL_LINE_LIMITS = Object.freeze({
  providerAddress: 5,
  customerAddress: 5,
  paymentInstructions: 4,
  registeredOffice: 4,
  corporateOffice: 4,
  contactInformation: 6,
  appellateInformation: 5,
  corporateCoordinatorInformation: 4,
  chargesInformation: 7,
  addressChangeInformation: 4,
  otherInformation: 8,
  fupInformation: 4,
  hsnServiceInformation: 8,
  notes: 8,
});
const WIFI_BILL_AMOUNT_FIELDS = Object.freeze([
  "rentalAmount", "discount", "otherCharges", "gstRate",
  "previousBalance", "paymentReceived", "paymentCoupon", "credits",
  "creditLimit", "securityDeposit", "lateFee",
  "history1PreviousDues", "history1Payments", "history1PaymentCoupon", "history1Credits", "history1CurrentCharges",
  "history2PreviousDues", "history2Payments", "history2PaymentCoupon", "history2Credits", "history2CurrentCharges",
  "history3PreviousDues", "history3Payments", "history3PaymentCoupon", "history3Credits", "history3CurrentCharges",
]);
const WIFI_BILL_DATE_FIELDS = Object.freeze([
  "billDate", "dueDate", "periodStart", "periodEnd", "paymentDate",
]);
const WIFI_BILL_ENUMS = Object.freeze({
  monthMode: Object.freeze(["current", "custom"]),
  taxMode: Object.freeze(["split", "igst"]),
  amountMode: Object.freeze(["exclusive", "inclusive"]),
});
const WIFI_BILL_FIELDS = Object.freeze([
  "providerName", "providerAddress", "providerGstin", "supportPhone", "supportEmail",
  "paymentInstructions", "paymentUpiId", "paymentPayeeName", "paymentMerchantCode",
  "paymentTransactionNote", "issuerSignatoryName", "issuerSignatoryTitle",
  "issuerSignatureUrl", "issuerSignaturePublicId", "providerPan",
  "providerCin", "providerServiceCategory", "registeredOffice", "corporateOffice",
  "contactInformation", "appellateInformation", "corporateCoordinatorInformation",
  "chargesInformation", "addressChangeInformation", "otherInformation", "fupInformation",
  "hsnServiceInformation", "customerName",
  "customerAddress", "customerEmail", "customerPhone", "customerGstin", "customerState",
  "customerStateCode", "accountNumber", "invoiceNumber", "billingBarcodeValue", "wifiId", "fixedlineNumber",
  "billMonth", "monthMode", "billDate", "dueDate", "periodStart", "periodEnd", "planName",
  "speed", "quota", "connections", "hsnCode", "rentalAmount", "discount", "otherCharges",
  "gstRate", "taxMode", "amountMode", "previousBalance", "paymentReceived", "paymentDate",
  "paymentCoupon", "history1PreviousDues", "history1Payments", "history1PaymentCoupon",
  "history1Credits", "history1CurrentCharges", "history2PreviousDues", "history2Payments",
  "history2PaymentCoupon", "history2Credits", "history2CurrentCharges", "history3PreviousDues",
  "history3Payments", "history3PaymentCoupon", "history3Credits", "history3CurrentCharges",
  "paymentMethod", "credits", "creditLimit", "securityDeposit",
  "tariffAirtelFixedline", "tariffOtherFixedline", "tariffAirtelMobile", "tariffOtherMobile",
  "tariffFixedlineCug", "tariffWll", "lateFee", "notes",
]);
const WIFI_BILL_DEFAULTS = Object.freeze({
  ...Object.fromEntries(WIFI_BILL_FIELDS.map((field) => [field, WIFI_BILL_ENUMS[field]?.[0] || ""])),
  paymentMerchantCode: "4814",
  paymentTransactionNote: "121-Telemedia-BAL",
  issuerSignatoryName: "Vasim Unissa S,",
  issuerSignatoryTitle: "Head - Experience Operations (VP)",
  providerPan: "AAACH1766P",
  providerCin: "L74899DL1995PLC067527",
  providerServiceCategory: "TELECOMMUNICATION SERVICE",
  paymentInstructions: "Pay online using debit/credit card, netbanking on My Airtel App, www.airtel.in, eWallets or UPI; visit an Airtel Store to pay using cash/cheque/credit/debit cards; or activate Auto Pay from a bank account (NACH) or credit card account (SI).",
  registeredOffice: "Bharti Crescent, 1 Nelson Mandela Road, Vasant Kunj, Phase II, New Delhi - 110070, India",
  corporateOffice: "7th Floor, South Block, Tower B3 Block, World Trade Park, JLN Marg, Jaipur, Rajasthan, 302017",
  contactInformation: "For queries: call 121 (toll free for Airtel) or 0141-4444121 (charges apply from non-Airtel numbers). For complaints: call 198 (toll free for Airtel) or 0141-4444198. NDNC registration: call 1909 (activation time: 7 days). Complaint / service request status: www.airtel.in/help.",
  appellateInformation: "Mr. Khushwinder Singh, 0141-4034338, appellate.rajasthan@in.airtel.com; Bharti Hexacom Limited, 7th Floor, South Block, Tower B3 Block, World Trade Park, JLN Marg, Jaipur, Rajasthan, 302017.",
  corporateCoordinatorInformation: "For queries and complaints call 1800102002 or email Esupport@in.airtel.com.",
  chargesInformation: "Itemized bill: Rs. 50/bill. Duplicate bill: Rs. 50/bill (last 2 months free). Cheque / SI / ECS decline: Rs. 200. Late payment charges: Rs. 100 for bill value between Rs. 300 and Rs. 5,000; for bill value above Rs. 5,000, 2% of the amount capped at Rs. 750. Effective 1 July 2017, 18% GST applies to late fees. No charge is levied for any service without explicit consent.",
  addressChangeInformation: "Visit the nearest Airtel Store with new address proof. Store details: www.airtel.in/store.",
  otherInformation: "Tariff plan: no increase in any line item (except ISD) for the first 6 months from enrolment, subject to terms. No fee is charged for migrating to any plan. After permanent disconnection, the security deposit is refunded within 60 days; otherwise interest is paid at 10% p.a. Calls may be rounded off. Billing disagreements must be reported within 2 months of bill receipt; after that no claim will be entertained. Reverse charge basis: NO. The Airtel Wi-Fi router is Airtel property and may be reclaimed when service ends.",
  fupInformation: "Post consumption of the unlimited quota, speed is revised to 2 Mbps as per the Fair Usage Policy. For information on other plans, visit www.airtel.in/business/thanksforbusiness/login/.",
  hsnServiceInformation: "998412 Fixed Telephony Service; 998433 Online video content; 996812 Courier Services; 997317 Leasing or rental services concerning telecommunications equipment with or without operator; 9983 Support services; 998716 Maintenance and repair services of telecommunication equipment and apparatus; 999799 Other Services n.e.c.",
  tariffAirtelFixedline: "0.00/60 | 0/60 | 0/60 | See www.airtel.in",
  tariffOtherFixedline: "0.00/60 | 0/60 | 0/60 | See www.airtel.in",
  tariffAirtelMobile: "0.00/60 | 0/60 | 0/60 | See www.airtel.in",
  tariffOtherMobile: "0.00/60 | 0/60 | 0/60 | See www.airtel.in",
  tariffFixedlineCug: "0.00/60 | 0/60 | 0/60 | See www.airtel.in",
  tariffWll: "0.00/60 | 0/60 | 0/60 | See www.airtel.in",
});
const CUSTOMER_FIELD_MAP = Object.freeze({
  name: "customerName",
  address: "customerAddress",
  email: "customerEmail",
  phone: "customerPhone",
  gstin: "customerGstin",
  state: "customerState",
  stateCode: "customerStateCode",
  accountNumber: "accountNumber",
  wifiId: "wifiId",
  fixedlineNumber: "fixedlineNumber",
});
const DECIMAL_PATTERN = /^\d+(?:\.\d{1,2})?$/;
const NUMERIC_TEXT_LIMIT = 32;

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validMonth(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) >= 1900;
}

function validDecimal(value, field) {
  if (value.length > NUMERIC_TEXT_LIMIT || !DECIMAL_PATTERN.test(value)) return false;
  const [whole, fraction = ""] = value.split(".");
  const hundredths = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return hundredths <= (field === "gstRate" ? 10_000n : 999_999_999n);
}

function validCloudinaryImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      url.pathname.includes("/image/upload/");
  } catch {
    return false;
  }
}

function fieldError(field, value) {
  if (typeof value !== "string") return "Use a string value for this field.";
  const maximum = WIFI_BILL_TEXT_LIMITS[field];
  if (maximum && value.length > maximum) return `Use ${maximum} characters or fewer.`;
  const lines = WIFI_BILL_LINE_LIMITS[field];
  if (lines && value.split(/\r\n|\r|\n/).length > lines) {
    return `Use at most ${lines} lines, including blank lines.`;
  }
  if (!lines && /[\r\n]/.test(value)) return "Use a single line for this field.";
  if (WIFI_BILL_ENUMS[field] && !WIFI_BILL_ENUMS[field].includes(value)) {
    return `Choose one of: ${WIFI_BILL_ENUMS[field].join(", ")}.`;
  }
  if (field === "customerName" && !value.trim()) return "Customer name is required.";
  if (WIFI_BILL_AMOUNT_FIELDS.includes(field) && value.trim() && !validDecimal(value.trim(), field)) {
    return field === "gstRate"
      ? "Enter a GST rate from 0 to 100 with at most 2 decimals."
      : `Enter a non-negative amount up to ${WIFI_BILL_MAX_AMOUNT} with at most 2 decimals.`;
  }
  if (field === "connections" && value.trim() && (
    value.length > NUMERIC_TEXT_LIMIT || !/^\d+$/.test(value.trim()) ||
    Number(value) < 1 || Number(value) > 999
  )) return "Enter a whole number of connections from 1 to 999.";
  if (WIFI_BILL_DATE_FIELDS.includes(field) && value && !validDate(value)) {
    return "Use a real calendar date in YYYY-MM-DD format.";
  }
  if (field === "billMonth" && value && !validMonth(value)) {
    return "Use a valid billing month in YYYY-MM format, from 1900 onward.";
  }
  if (["accountNumber", "invoiceNumber", "billingBarcodeValue"].includes(field) && value.trim() && !/^[\x20-\x7E]+$/.test(value)) {
    return "Use printable English letters, numbers or symbols so the barcode can be generated.";
  }
  if (field === "issuerSignatureUrl" && value.trim() && !validCloudinaryImageUrl(value.trim())) {
    return "Upload the signature through the bill editor.";
  }
  if (field === "issuerSignaturePublicId" && value.trim() && !/^hms_wifi-signature_[a-f0-9]{24}$/.test(value.trim())) {
    return "Upload the signature through the bill editor.";
  }
  // Even blank numeric input must not allow an unbounded whitespace payload.
  if ((WIFI_BILL_AMOUNT_FIELDS.includes(field) || field === "connections") && value.length > NUMERIC_TEXT_LIMIT) {
    return `Use ${NUMERIC_TEXT_LIMIT} characters or fewer.`;
  }
  return null;
}

function invalidDraft(errors) {
  const error = new Error("Please correct the highlighted bill fields.");
  error.statusCode = 400;
  error.errors = errors;
  return error;
}

/** Missing fields become empty/default values; only the customer name is required. */
function validateDraftData(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw invalidDraft({ data: "Provide bill data as an object." });
  }
  const errors = {};
  for (const field of Object.keys(input)) {
    if (!WIFI_BILL_FIELDS.includes(field)) {
      // defineProperty also handles a JSON key named __proto__ as an ordinary key.
      Object.defineProperty(errors, field, {
        value: "Unknown bill field.", enumerable: true, configurable: true,
      });
    }
  }
  const data = { ...WIFI_BILL_DEFAULTS };
  for (const field of WIFI_BILL_FIELDS) {
    if (Object.hasOwn(input, field)) data[field] = input[field];
    const message = fieldError(field, data[field]);
    if (message) errors[field] = message;
    else if (WIFI_BILL_AMOUNT_FIELDS.includes(field) || field === "connections" || field === "customerName") {
      data[field] = data[field].trim();
    }
  }
  if (
    typeof data.issuerSignatureUrl === "string" &&
    typeof data.issuerSignaturePublicId === "string" &&
    Boolean(data.issuerSignatureUrl.trim()) !== Boolean(data.issuerSignaturePublicId.trim())
  ) {
    errors.issuerSignatureUrl = "Upload the signature again so its cloud reference is complete.";
  }
  if (Object.keys(errors).length) throw invalidDraft(errors);
  return data;
}

function dataToStorage(input) {
  const data = validateDraftData(input);
  for (const field of WIFI_BILL_AMOUNT_FIELDS) {
    data[field] = data[field] === "" ? null : mongoose.Types.Decimal128.fromString(data[field]);
  }
  data.connections = data.connections === "" ? null : Number(data.connections);
  return data;
}

/** Return only the full public form shape, with no subdocument/internal fields. */
function dataFromStorage(input) {
  const source = typeof input?.toObject === "function" ? input.toObject() : (input || {});
  const data = { ...WIFI_BILL_DEFAULTS };
  for (const field of WIFI_BILL_FIELDS) {
    if (source[field] != null) data[field] = String(source[field]);
  }
  return data;
}

function customerFromData(input) {
  const data = validateDraftData(input);
  return Object.fromEntries(Object.entries(CUSTOMER_FIELD_MAP).map(
    ([field, dataField]) => [field, data[dataField]],
  ));
}

/** Typed snapshots prevent MongoDB casting from turning unfinished amounts into 0. */
function createWifiBillDataSchema() {
  const definition = {};
  for (const field of WIFI_BILL_FIELDS) {
    if (WIFI_BILL_AMOUNT_FIELDS.includes(field)) {
      definition[field] = {
        type: mongoose.Schema.Types.Decimal128,
        default: null,
        validate: {
          validator: (value) => value == null || validDecimal(value.toString(), field),
          message: `Invalid ${field}.`,
        },
      };
    } else if (field === "connections") {
      definition[field] = {
        type: Number,
        default: null,
        min: 1,
        max: 999,
        validate: { validator: (value) => value == null || Number.isInteger(value), message: "Connections must be a whole number." },
      };
    } else {
      definition[field] = {
        type: String,
        default: WIFI_BILL_DEFAULTS[field],
        ...(field === "customerName" ? { required: true } : {}),
        ...(WIFI_BILL_TEXT_LIMITS[field] ? { maxlength: WIFI_BILL_TEXT_LIMITS[field] } : {}),
        ...(WIFI_BILL_ENUMS[field] ? { enum: WIFI_BILL_ENUMS[field] } : {}),
        validate: { validator: (value) => !fieldError(field, value), message: `Invalid ${field}.` },
      };
    }
  }
  return new mongoose.Schema(definition, { _id: false, strict: "throw" });
}

module.exports = {
  WIFI_BILL_MAX_AMOUNT,
  WIFI_BILL_TEXT_LIMITS,
  WIFI_BILL_LINE_LIMITS,
  WIFI_BILL_AMOUNT_FIELDS,
  WIFI_BILL_DATE_FIELDS,
  WIFI_BILL_ENUMS,
  WIFI_BILL_FIELDS,
  WIFI_BILL_DEFAULTS,
  CUSTOMER_FIELD_MAP,
  validateDraftData,
  dataToStorage,
  dataFromStorage,
  customerFromData,
  createWifiBillDataSchema,
};
