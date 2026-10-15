import type {
  WifiBillData,
  WifiBillErrors,
  WifiBillTotals,
  WifiStoredMonthlyRecord,
} from "../types/wifi-bill";

// Keep all intermediate integer arithmetic below Number.MAX_SAFE_INTEGER.
export const WIFI_BILL_MAX_AMOUNT = 9_999_999.99;
export const WIFI_INTERNET_SERVICE = Object.freeze({
  hsnSacCode: "998412",
  description: "Fixed Telephony Service",
});
const FIXED_LATE_FEE_MINIMUM_PAISE = 300 * 100;
const PERCENTAGE_LATE_FEE_THRESHOLD_PAISE = 5_000 * 100;
const FIXED_LATE_FEE_PAISE = 100 * 100;
const MAXIMUM_LATE_FEE_PAISE = 750 * 100;
const LATE_FEE_GST_PERCENT = 18;
export const WIFI_BILL_TEXT_LIMITS: Partial<Record<keyof WifiBillData, number>> = {
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
  hsnServiceDescription: 160,
  customerName: 80,
  customerAddressLine1: 180,
  customerCity: 60,
  customerPostalCode: 10,
  customerEmail: 100,
  customerPhone: 20,
  customerGstin: 15,
  customerState: 40,
  customerStateCode: 2,
  accountNumber: 40,
  invoiceNumber: 35,
  wifiId: 60,
  fixedlineNumber: 25,
  planDisplayName: 80,
  speed: 30,
  quota: 40,
  hsnSacCode: 6,
  paymentMethod: 100,
  tariffAirtelFixedline: 160,
  tariffOtherFixedline: 160,
  tariffAirtelMobile: 160,
  tariffOtherMobile: 160,
  tariffFixedlineCug: 160,
  tariffWll: 160,
  notes: 650,
};
/** Explicit line breaks, including blank lines, must fit the fixed A4 sections. */
export const WIFI_BILL_LINE_LIMITS: Partial<Record<keyof WifiBillData, number>> = {
  providerAddress: 5,
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
  notes: 8,
};
const DECIMAL_PATTERN = /^\d+(?:\.\d{1,2})?$/;
const SIGNED_DECIMAL_PATTERN = /^-?\d+(?:\.\d{1,2})?$/;
const EMPTY_VALUE = "—";

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const SHORT_MONTHS = Object.freeze([
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]);

const monthFormatter = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

function isValidMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) >= 1900;
}

function localIsoDate(date: Date): string {
  return [
    date.getFullYear().toString().padStart(4, "0"),
    (date.getMonth() + 1).toString().padStart(2, "0"),
    date.getDate().toString().padStart(2, "0"),
  ].join("-");
}

/** Reference PDF cycle: 5th of the previous month through 4th of the bill month. */
export function getBillingPeriod(month: string): {
  periodStart: string;
  periodEnd: string;
} {
  if (!isValidMonth(month)) return { periodStart: "", periodEnd: "" };
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 2, 5));
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: `${month}-04`,
  };
}

export function getBillingDates(month: string) {
  return {
    billMonth: month,
    billDate: isValidMonth(month) ? `${month}-06` : "",
    dueDate: isValidMonth(month) ? `${month}-16` : "",
    ...getBillingPeriod(month),
  };
}

function offsetBillMonth(month: string, offset: number): string {
  if (!isValidMonth(month)) return "";
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + offset, 1)).toISOString().slice(0, 7);
}

function storedPaise(value: number, label: string): number {
  const paise = Math.round(value * 100);
  if (!Number.isFinite(value) || !Number.isSafeInteger(paise)) {
    throw new Error(`${label} must be a valid stored amount.`);
  }
  return paise;
}

function storedInputAmount(value: number, label: string, adjustment = false): string {
  const paise = storedPaise(value, label);
  if (adjustment && paise > 0) {
    throw new Error(`${label} must be stored as a signed zero or negative adjustment.`);
  }
  if (!adjustment && paise < 0) {
    throw new Error(`${label} cannot be negative.`);
  }
  const amount = adjustment ? paise : Math.abs(paise);
  return (amount / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

/** Apply the same signed formula used by a persisted bills-and-payments row. */
export function storedMonthlyAmountPayable(record: WifiStoredMonthlyRecord): number {
  const payablePaise = storedPaise(record.previousDues, "Previous dues")
    + storedPaise(record.payments, "Payments")
    + storedPaise(record.paymentCoupon, "Payment coupon")
    + storedPaise(record.credits, "Credits")
    + storedPaise(record.currentCharges, "Current charges");
  return Math.max(0, payablePaise) / 100;
}

function emptyHistoryFields(offset: 1 | 2 | 3): Partial<WifiBillData> {
  return {
    [`history${offset}PreviousDues`]: "",
    [`history${offset}Payments`]: "",
    [`history${offset}PaymentCoupon`]: "",
    [`history${offset}Credits`]: "",
    [`history${offset}CurrentCharges`]: "",
  } as Partial<WifiBillData>;
}

/**
 * Hydrate the selected statement from stored month/account records. The plan
 * fields remain editable and drive the selected month's current charges plus
 * the last payment and the GST-inclusive previous-month summary row.
 * A missing selected record is rejected so an invoice number must be generated
 * and persisted once by the API before rendering or export.
 */
export function buildSelectedMonthBillData(
  data: WifiBillData,
  records: readonly WifiStoredMonthlyRecord[],
  selectedMonth = data.billMonth,
): WifiBillData {
  const accountNumber = data.accountNumber.trim();
  const accountRecords = records.filter((record) => record.accountNumber.trim() === accountNumber);
  const recordByMonth = new Map(accountRecords.map((record) => [record.billMonth, record]));
  const selectedRecord = recordByMonth.get(selectedMonth);
  if (!selectedRecord?.invoiceNumber.trim()) {
    throw new Error(`Persist the ${selectedMonth || "selected month"} billing record before generating its bill.`);
  }

  const previousRecord = recordByMonth.get(offsetBillMonth(selectedMonth, -1));
  const settlement = previousRecord?.settlement || null;
  const history: Partial<WifiBillData> = {
    ...emptyHistoryFields(1),
    ...emptyHistoryFields(2),
    ...emptyHistoryFields(3),
    ...(previousRecord ? {
      // Non-empty markers create the single previous-month row. The exact
      // plan calculation replaces every amount in applyPlanBasedLastPayment below.
      history1PreviousDues: "0",
      history1Payments: "0",
      history1PaymentCoupon: "0",
      history1Credits: "0",
      history1CurrentCharges: "0",
    } : {}),
  };

  return applyPlanBasedLastPayment({
    ...data,
    ...getBillingDates(selectedMonth),
    invoiceNumber: selectedRecord.invoiceNumber.trim(),
    previousBalance: "0",
    paymentReceived: "0",
    paymentCoupon: "0",
    credits: "0",
    paymentDate: settlement?.paymentDate || "",
    paymentMethod: settlement?.paymentMethod || "",
    statementCurrentCharges: storedInputAmount(
      selectedRecord.currentCharges,
      `${selectedRecord.billMonth} current charges`,
    ),
    ...history,
  });
}

export const REFERENCE_ACCOUNT_NUMBER = "20025842515";

/** Stored operator history; current plan edits never mutate these records. */
export const REFERENCE_WIFI_MONTHLY_RECORDS: readonly WifiStoredMonthlyRecord[] = Object.freeze([
  Object.freeze({
    accountNumber: REFERENCE_ACCOUNT_NUMBER,
    billMonth: "2026-05",
    invoiceNumber: "",
    previousDues: 520.52,
    payments: -520.52,
    paymentCoupon: 0,
    credits: 0,
    currentCharges: 588.82,
    settlement: Object.freeze({ payments: -588.82, paymentCoupon: 0, credits: 0, paymentDate: "2026-05-16", paymentMethod: "Payment via Third Party BBPS (Digital-APBL)" }),
  }),
  Object.freeze({
    accountNumber: REFERENCE_ACCOUNT_NUMBER,
    billMonth: "2026-06",
    invoiceNumber: "",
    previousDues: 588.82,
    payments: -588.82,
    paymentCoupon: 0,
    credits: 0,
    currentCharges: 470.82,
    settlement: Object.freeze({ payments: -470.82, paymentCoupon: 0, credits: 0, paymentDate: "2026-06-16", paymentMethod: "Payment via Third Party BBPS (Digital-APBL)" }),
  }),
  Object.freeze({
    accountNumber: REFERENCE_ACCOUNT_NUMBER,
    billMonth: "2026-07",
    invoiceNumber: "",
    previousDues: 470.82,
    payments: -470.82,
    paymentCoupon: 0,
    credits: 0,
    currentCharges: 451.19,
    settlement: Object.freeze({ payments: -451.19, paymentCoupon: 0, credits: 0, paymentDate: "2026-07-15", paymentMethod: "Payment via Third Party BBPS (Digital-APBL)" }),
  }),
  Object.freeze({
    accountNumber: REFERENCE_ACCOUNT_NUMBER,
    billMonth: "2026-08",
    invoiceNumber: "HF2708I003089481",
    previousDues: 451.19,
    payments: -451.19,
    paymentCoupon: 0,
    credits: 0,
    currentCharges: 470.82,
    settlement: Object.freeze({ payments: -470.82, paymentCoupon: 0, credits: 0, paymentDate: "2026-08-16", paymentMethod: "Payment via Third Party BBPS (Digital-APBL)" }),
  }),
  Object.freeze({
    accountNumber: REFERENCE_ACCOUNT_NUMBER,
    billMonth: "2026-09",
    invoiceNumber: "HF2708I003894536",
    previousDues: 470.82,
    payments: -470.82,
    paymentCoupon: 0,
    credits: 0,
    currentCharges: 1178.82,
    settlement: null,
  }),
]);

/** Resolve from the user's local system clock, including immediately before export. */
export function resolveWifiBillDates(data: WifiBillData, now: Date = new Date()): WifiBillData {
  const month = data.monthMode === "current" ? localIsoDate(now).slice(0, 7) : data.billMonth;
  return { ...data, ...getBillingDates(month) };
}

export function createDefaultWifiBill(now: Date = new Date()): WifiBillData {
  const billMonth = localIsoDate(now).slice(0, 7);

  return {
    providerName: "Bharti Hexacom Limited",
    providerAddress: "",
    providerGstin: "08AAACH1766P1Z5",
    supportPhone: "",
    supportEmail: "",
    paymentInstructions: "Pay online using debit/credit card, netbanking on My Airtel App, www.airtel.in, eWallets or UPI; visit an Airtel Store to pay using cash/cheque/credit/debit cards; or activate Auto Pay from a bank account (NACH) or credit card account (SI).",
    paymentUpiId: "",
    paymentPayeeName: "Bharti Hexacom Limited",
    paymentMerchantCode: "4814",
    paymentTransactionNote: "121-Telemedia-BAL",
    issuerSignatoryName: "Vasim Unissa S,",
    issuerSignatoryTitle: "Head - Experience Operations (VP)",
    issuerSignatureUrl: "",
    issuerSignaturePublicId: "",
    providerPan: "AAACH1766P",
    providerCin: "L74899DL1995PLC067527",
    providerServiceCategory: "TELECOMMUNICATION SERVICE",
    registeredOffice: "Bharti Crescent, 1 Nelson Mandela Road, Vasant Kunj, Phase II, New Delhi - 110070, India",
    corporateOffice: "7th Floor, South Block, Tower B3 Block, World Trade Park, JLN Marg, Jaipur, Rajasthan, 302017",
    contactInformation: "For queries: call 121 (toll free for Airtel) or 0141-4444121 (charges apply from non-Airtel numbers). For complaints: call 198 (toll free for Airtel) or 0141-4444198. NDNC registration: call 1909 (activation time: 7 days). Complaint / service request status: www.airtel.in/help.",
    appellateInformation: "Mr. Khushwinder Singh, 0141-4034338, appellate.rajasthan@in.airtel.com; Bharti Hexacom Limited, 7th Floor, South Block, Tower B3 Block, World Trade Park, JLN Marg, Jaipur, Rajasthan, 302017.",
    corporateCoordinatorInformation: "For queries and complaints call 1800102002 or email Esupport@in.airtel.com.",
    chargesInformation: "Itemized bill: Rs. 50/bill. Duplicate bill: Rs. 50/bill (last 2 months free). Cheque / SI / ECS decline: Rs. 200. Late payment charges: Rs. 100 for bill value between Rs. 300 and Rs. 5,000; for bill value above Rs. 5,000, 2% of the amount capped at Rs. 750. Effective 1 July 2017, 18% GST applies to late fees. No charge is levied for any service without explicit consent.",
    addressChangeInformation: "Visit the nearest Airtel Store with new address proof. Store details: www.airtel.in/store.",
    otherInformation: "Tariff plan: no increase in any line item (except ISD) for the first 6 months from enrolment, subject to terms. No fee is charged for migrating to any plan. After permanent disconnection, the security deposit is refunded within 60 days; otherwise interest is paid at 10% p.a. Calls may be rounded off. Billing disagreements must be reported within 2 months of bill receipt; after that no claim will be entertained. Reverse charge basis: NO. The Airtel Wi-Fi router is Airtel property and may be reclaimed when service ends.",
    fupInformation: "Post consumption of the unlimited quota, speed is revised to 2 Mbps as per the Fair Usage Policy. For information on other plans, visit www.airtel.in/business/thanksforbusiness/login/.",
    hsnServiceDescription: WIFI_INTERNET_SERVICE.description,
    customerName: "",
    customerAddressLine1: "",
    customerCity: "",
    customerPostalCode: "",
    customerEmail: "",
    customerPhone: "",
    customerGstin: "",
    customerState: "",
    customerStateCode: "",
    accountNumber: "",
    invoiceNumber: "",
    wifiId: "",
    fixedlineNumber: "",
    monthMode: "current",
    ...getBillingDates(billMonth),
    planDisplayName: "Broadband Plan",
    speed: "",
    quota: "",
    connections: "1",
    hsnSacCode: WIFI_INTERNET_SERVICE.hsnSacCode,
    rentalAmount: "999",
    discount: "0",
    otherCharges: "0",
    gstRate: "18",
    taxMode: "split",
    amountMode: "exclusive",
    previousBalance: "0",
    paymentReceived: "0",
    paymentCoupon: "0",
    statementCurrentCharges: "",
    history1PreviousDues: "",
    history1Payments: "",
    history1PaymentCoupon: "",
    history1Credits: "",
    history1CurrentCharges: "",
    history2PreviousDues: "",
    history2Payments: "",
    history2PaymentCoupon: "",
    history2Credits: "",
    history2CurrentCharges: "",
    history3PreviousDues: "",
    history3Payments: "",
    history3PaymentCoupon: "",
    history3Credits: "",
    history3CurrentCharges: "",
    paymentDate: "",
    paymentMethod: "",
    credits: "0",
    creditLimit: "0",
    securityDeposit: "0",
    tariffAirtelFixedline: "0.00/60 | 0/60 | 0/60 | See www.airtel.in",
    tariffOtherFixedline: "0.00/60 | 0/60 | 0/60 | See www.airtel.in",
    tariffAirtelMobile: "0.00/60 | 0/60 | 0/60 | See www.airtel.in",
    tariffOtherMobile: "0.00/60 | 0/60 | 0/60 | See www.airtel.in",
    tariffFixedlineCug: "0.00/60 | 0/60 | 0/60 | See www.airtel.in",
    tariffWll: "0.00/60 | 0/60 | 0/60 | See www.airtel.in",
    lateFee: "",
    notes: "",
  };
}

/**
 * Editable values transcribed from the visible bill in aug.pdf.
 *
 * The PDF also contains a hidden, superseded bill layer. Keep this template tied
 * to the visible Ms. Jyoti Kumari Singh / Rs. 1,178.82 statement only. The
 * payment QR is rebuilt elsewhere from these coherent visible values.
 */
export function createReferenceWifiBill(billMonth = "2026-08"): WifiBillData {
  const reference = {
    ...createDefaultWifiBill(),
    providerName: "Bharti Hexacom Limited",
    providerAddress: "Bharti Hexacom Limited, 7th Floor, South Block, Tower B3 Block, World Trade Park, JLN Marg, Jaipur, Rajasthan, 302017",
    providerGstin: "08AAACH1766P1Z5",
    supportPhone: "121 / 0141-4444121",
    supportEmail: "Esupport@in.airtel.com",
    paymentInstructions: "Pay online using debit/credit card, netbanking on My Airtel App, www.airtel.in, eWallets, UPI, visit an Airtel Store to pay using cash/cheque/credit/debit cards or activate Auto pay options from bank account (NACH) or Credit card account (SI)",
    paymentUpiId: "20025842515.FL@mairtel",
    paymentPayeeName: "Bharti Hexacom Limited",
    paymentMerchantCode: "4814",
    paymentTransactionNote: "121-Telemedia-BAL",
    issuerSignatoryName: "Vasim Unissa S,",
    issuerSignatoryTitle: "Head - Experience Operations (VP)",
    providerPan: "AAACH1766P",
    providerCin: "L74899DL1995PLC067527",
    providerServiceCategory: "TELECOMMUNICATION SERVICE",
    registeredOffice: "Bharti crescent, 1, nelson mandela road, vasant kunj, phase ii, new delhi - 110 070, india",
    corporateOffice: "Bharti Hexacom Limited, 7th Floor, South Block, Tower B3 Block, World Trade Park, JLN Marg, Jaipur, Rajasthan, 302017",
    contactInformation: "For Queries: Call 121 (toll free for Airtel), 0141-4444121(for Non-Airtel number, call charges apply) | Complaints: Call 198 (toll free for Airtel), 0141-4444198(for Non-Airtel number, call charges apply) | NDNC Registration: Call 1909 (Activation time: 7 days) | Complaint/SR Status: www.airtel.in/help. |",
    appellateInformation: "Mr. Khushwinder Singh , 0141-4034338; appellate.rajasthan@in.airtel.com; address: Bharti Hexacom Limited, 7th Floor, South Block, Tower B3 Block, World Trade Park, JLN Marg, Jaipur, Rajasthan, 302017",
    corporateCoordinatorInformation: "For queries and complaints: Call 1800102002 | Email: Esupport@in.airtel.com",
    chargesInformation: "Itemized bill: Rs. 50/Bill | Duplicate Bill: Rs. 50/Bill (Last 2 months free) | Cheque / SI / ECS Decline: Rs. 200 | Late payment charges shall be Rs. 100 for bill value between Rs. 300 and Rs. 5,000; and for bill value above Rs. 5,000, a charge of 2% of the amount, capped at a maximum of Rs. 750 will be applied. As per the Government directive, effective 1-July-17, 18% GST is applicable on Late Fee Charges. No charge is levied for any service without your explicit consent.",
    addressChangeInformation: "Visit the nearest Airtel Store with new address proof. For store details, visit www.airtel.in/store",
    otherInformation: "Tariff Plan: No increase in any line item (except ISD) for first 6months effective enrolment date. T&C apply | No fee is charged for migrating to any plan | Disconnection: For permanent disconnection, security deposit will be refunded within 60days. Else, interest will be paid @10%p.a. | Call pulses will be rounded off | Billing disagreements should be reported within 2months of bill receipt. Post this period no claim shall be entertained. | Whether tax is payable on Reverse Charge Basis - \"NO\". The Airtel Wi-Fi router is Airtel's property & may be reclaimed if the customer discontinues Airtel's Wi-Fi services.",
    fupInformation: "Post consumption of Unlimited quota, the speed would be revised to 2 Mbps as per Fair Usage Policy | For information on other plans, visit www.airtel.in/business/thanksforbusiness/login/",
    hsnServiceDescription: WIFI_INTERNET_SERVICE.description,
    customerName: "Ms. Jyoti Kumari Singh",
    customerAddressLine1: "Raj Manthan Rd, Sms Colony, Mansarovar",
    customerCity: "Jaipur",
    customerPostalCode: "302020",
    customerEmail: "jyoti.k.singh009@gmail.com",
    customerPhone: "7061415974",
    customerGstin: ".",
    customerState: "Rajasthan",
    customerStateCode: "08",
    accountNumber: "20025842515",
    invoiceNumber: "",
    wifiId: "014122815145_wifi",
    fixedlineNumber: "01414543702",
    monthMode: "custom",
    ...getBillingDates(billMonth),
    planDisplayName: "999 WiFi_100_Mbps",
    speed: "100 Mbps",
    quota: "Unlimited",
    connections: "1",
    hsnSacCode: WIFI_INTERNET_SERVICE.hsnSacCode,
    rentalAmount: "999",
    discount: "0",
    otherCharges: "0",
    gstRate: "18",
    taxMode: "split",
    amountMode: "exclusive",
    previousBalance: "0",
    paymentReceived: "0",
    paymentCoupon: "0",
    statementCurrentCharges: "",
    history1PreviousDues: "",
    history1Payments: "",
    history1PaymentCoupon: "0",
    history1Credits: "0",
    history1CurrentCharges: "",
    history2PreviousDues: "",
    history2Payments: "",
    history2PaymentCoupon: "0",
    history2Credits: "0",
    history2CurrentCharges: "",
    history3PreviousDues: "",
    history3Payments: "",
    history3PaymentCoupon: "0",
    history3Credits: "0",
    history3CurrentCharges: "",
    paymentDate: "",
    paymentMethod: "",
    credits: "0",
    creditLimit: "2500",
    securityDeposit: "0",
    tariffAirtelFixedline: "0.00/60 | 0/60 | 0/60 | for country specific rates visit www.airtel.in",
    tariffOtherFixedline: "0.00/60 | 0/60 | 0/60 | for country specific rates visit www.airtel.in",
    tariffAirtelMobile: "0.00/60 |  | 0/60 | for country specific rates visit www.airtel.in",
    tariffOtherMobile: "0.00/60 |  | 0/60 | for country specific rates visit www.airtel.in",
    tariffFixedlineCug: "0.00/60 | 0/60 | 0/60 | for country specific rates visit www.airtel.in",
    tariffWll: "0.00/60 | 0/60 | 0/60 | for country specific rates visit www.airtel.in",
    lateFee: "",
    notes: "",
  } satisfies WifiBillData;
  return buildSelectedMonthBillData(reference, REFERENCE_WIFI_MONTHLY_RECORDS, billMonth);
}

/** Exact decimal parsing avoids floating-point errors such as 1.005 * 100. */
function toPaise(value: string, maximum = WIFI_BILL_MAX_AMOUNT): number {
  const trimmed = value.trim();
  if (!DECIMAL_PATTERN.test(trimmed) || Number(trimmed) > maximum) return 0;
  const [whole, fraction = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function toSignedPaise(value: string, maximum = WIFI_BILL_MAX_AMOUNT): number {
  const trimmed = value.trim();
  if (!SIGNED_DECIMAL_PATTERN.test(trimmed) || Math.abs(Number(trimmed)) > maximum) return 0;
  const sign = trimmed.startsWith("-") ? -1 : 1;
  const unsigned = trimmed.replace(/^-/, "");
  const [whole, fraction = ""] = unsigned.split(".");
  return sign * (Number(whole) * 100 + Number(fraction.padEnd(2, "0")));
}

function inputAmountFromPaise(paise: number): string {
  return (paise / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

/**
 * The generated statement shows one last payment equal to the entered plan
 * price. The displayed previous-month row uses the full GST-inclusive payable
 * for both dues and its equal negative payment.
 */
export function applyPlanBasedLastPayment(data: WifiBillData): WifiBillData {
  const exclusiveData: WifiBillData = { ...data, amountMode: "exclusive" };
  const rental = exclusiveData.rentalAmount.trim();
  if (!DECIMAL_PATTERN.test(rental) || Number(rental) > WIFI_BILL_MAX_AMOUNT) return data;
  const planPricePaise = toPaise(rental);
  const planPrice = inputAmountFromPaise(planPricePaise);
  const signedPlanPayment = planPricePaise === 0 ? "0" : `-${planPrice}`;
  const currentChargesWithGst = inputAmountFromPaise(
    Math.round(calculateWifiBill(exclusiveData).totalCurrentCharges * 100),
  );
  const hasPreviousMonth = [
    exclusiveData.history1PreviousDues,
    exclusiveData.history1Payments,
    exclusiveData.history1PaymentCoupon,
    exclusiveData.history1Credits,
    exclusiveData.history1CurrentCharges,
  ].some((value) => value.trim() !== "");
  return {
    ...exclusiveData,
    previousBalance: planPrice,
    paymentReceived: signedPlanPayment,
    ...(hasPreviousMonth ? {
      history1PreviousDues: currentChargesWithGst,
      history1Payments: currentChargesWithGst === "0" ? "0" : `-${currentChargesWithGst}`,
      history1PaymentCoupon: "0",
      history1Credits: "0",
      history1CurrentCharges: currentChargesWithGst,
    } : {}),
  };
}

/** Calculate the contingent overdue fee from the outstanding bill value. */
function calculateAutomaticLateFee(payable: number) {
  if (payable < FIXED_LATE_FEE_MINIMUM_PAISE) {
    return 0;
  }

  return payable <= PERCENTAGE_LATE_FEE_THRESHOLD_PAISE
    ? FIXED_LATE_FEE_PAISE
    : Math.min(Math.round((payable * 2) / 100), MAXIMUM_LATE_FEE_PAISE);
}

/** Safe for live previews; validateWifiBill must pass before issuing the bill. */
export function calculateWifiBill(data: WifiBillData): WifiBillTotals {
  const rental = toPaise(data.rentalAmount);
  const discount = Math.min(toPaise(data.discount), rental);
  const otherCharges = toPaise(data.otherCharges);
  const subtotal = rental - discount + otherCharges;
  const gstBasisPoints = toPaise(data.gstRate, 100);
  const taxable = data.amountMode === "inclusive"
    ? Math.round((subtotal * 10_000) / (10_000 + gstBasisPoints))
    : subtotal;
  const rentalBeforeTax = data.amountMode === "inclusive"
    ? Math.round((rental * 10_000) / (10_000 + gstBasisPoints))
    : rental;
  const discountedRentalBeforeTax = data.amountMode === "inclusive"
    ? Math.round(((rental - discount) * 10_000) / (10_000 + gstBasisPoints))
    : rental - discount;
  // Allocate inclusive rounding across line items so their net equals taxable.
  const discountBeforeTax = rentalBeforeTax - discountedRentalBeforeTax;
  const otherChargesBeforeTax = taxable - discountedRentalBeforeTax;
  const tax = data.amountMode === "inclusive"
    ? subtotal - taxable
    : Math.round((taxable * gstBasisPoints) / 10_000);
  // Allocate the rounding remainder instead of rounding both halves separately.
  const cgst = data.taxMode === "split" ? Math.round(tax / 2) : 0;
  const sgst = data.taxMode === "split" ? tax - cgst : 0;
  const igst = data.taxMode === "igst" ? tax : 0;
  const currentCharges = taxable + tax;
  const previousBalance = toPaise(data.previousBalance);
  const paymentReceived = toSignedPaise(data.paymentReceived);
  const paymentCoupon = toSignedPaise(data.paymentCoupon);
  const credits = toSignedPaise(data.credits);
  const creditLimit = toPaise(data.creditLimit);
  const securityDeposit = toPaise(data.securityDeposit);
  const previousBalanceDue = previousBalance + paymentReceived + paymentCoupon + credits;
  const netBalance = currentCharges + previousBalanceDue;
  const payable = Math.max(0, netBalance);
  const lateFee = payable > 0
    ? (data.lateFee.trim() ? toPaise(data.lateFee) : calculateAutomaticLateFee(payable))
    : 0;
  const lateFeeGst = Math.round((lateFee * LATE_FEE_GST_PERCENT) / 100);

  return {
    rentalAmount: rental / 100,
    discount: discount / 100,
    otherCharges: otherCharges / 100,
    rentalBeforeTax: rentalBeforeTax / 100,
    discountBeforeTax: discountBeforeTax / 100,
    otherChargesBeforeTax: otherChargesBeforeTax / 100,
    grossChargesBeforeTax: (rentalBeforeTax + otherChargesBeforeTax) / 100,
    taxableAmount: taxable / 100,
    cgstRate: data.taxMode === "split" ? gstBasisPoints / 200 : 0,
    sgstRate: data.taxMode === "split" ? gstBasisPoints / 200 : 0,
    cgst: cgst / 100,
    sgst: sgst / 100,
    igst: igst / 100,
    gstTotal: tax / 100,
    totalCurrentCharges: currentCharges / 100,
    previousBalance: previousBalance / 100,
    paymentReceived: paymentReceived / 100,
    paymentCoupon: paymentCoupon / 100,
    credits: credits / 100,
    creditLimit: creditLimit / 100,
    securityDeposit: securityDeposit / 100,
    paymentTotal: (paymentReceived + paymentCoupon + credits) / 100,
    netRental: (rentalBeforeTax - discountBeforeTax) / 100,
    lateFee: lateFee / 100,
    lateFeeGst: lateFeeGst / 100,
    lateFeeWithGst: (lateFee + lateFeeGst) / 100,
    previousBalanceDue: previousBalanceDue / 100,
    netBalance: netBalance / 100,
    totalPayable: payable / 100,
    creditBalance: Math.max(0, -netBalance) / 100,
    amountAfterDueDate: (payable + lateFee + lateFeeGst) / 100,
  };
}

export function validateWifiBill(data: WifiBillData): WifiBillErrors {
  const errors: WifiBillErrors = {};
  const requiredFields: Partial<Record<keyof WifiBillData, string>> = {
    providerName: "Provider name",
    providerAddress: "Provider address",
    customerName: "Customer name",
    customerAddressLine1: "Address line 1",
    customerCity: "City",
    customerState: "State",
    customerPostalCode: "Postal code",
    customerPhone: "Customer phone",
    accountNumber: "Account number",
    invoiceNumber: "Invoice number",
    planDisplayName: "Plan name",
    hsnSacCode: "HSN / SAC code",
  };
  for (const [field, label] of Object.entries(requiredFields)) {
    if (!data[field as keyof WifiBillData].trim()) {
      errors[field as keyof WifiBillData] = `${label} is required.`;
    }
  }
  for (const [field, maximum] of Object.entries(WIFI_BILL_TEXT_LIMITS)) {
    if (data[field as keyof WifiBillData].length > maximum) {
      errors[field as keyof WifiBillData] = `Use ${maximum} characters or fewer.`;
    }
  }
  for (const field of Object.keys(data) as (keyof WifiBillData)[]) {
    const maximum = WIFI_BILL_LINE_LIMITS[field];
    if (maximum && data[field].split(/\r\n|\r|\n/).length > maximum) {
      errors[field] = `Use at most ${maximum} lines, including blank lines.`;
    } else if (!maximum && /[\r\n]/.test(data[field])) {
      errors[field] = "Use a single line for this field.";
    }
  }

  if (data.issuerSignatureUrl.trim()) {
    try {
      const url = new URL(data.issuerSignatureUrl);
      if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || !url.pathname.includes("/image/upload/")) {
        errors.issuerSignatureUrl = "Upload the signature through the bill editor.";
      }
    } catch {
      errors.issuerSignatureUrl = "Upload the signature through the bill editor.";
    }
  }
  if (Boolean(data.issuerSignatureUrl.trim()) !== Boolean(data.issuerSignaturePublicId.trim())) {
    errors.issuerSignatureUrl = "Upload the signature again so its cloud reference is complete.";
  }
  if (data.issuerSignaturePublicId.trim() && !/^hms_wifi-signature_[a-f0-9]{24}$/.test(data.issuerSignaturePublicId.trim())) {
    errors.issuerSignaturePublicId = "Upload the signature through the bill editor.";
  }

  const unsignedMoneyFields = [
    "rentalAmount", "discount", "otherCharges", "previousBalance", "statementCurrentCharges",
    "creditLimit", "securityDeposit", "lateFee",
    "history1PreviousDues", "history1CurrentCharges",
    "history2PreviousDues", "history2CurrentCharges",
    "history3PreviousDues", "history3CurrentCharges",
  ] as const;
  for (const field of unsignedMoneyFields) {
    const value = data[field].trim();
    if (!value && field !== "rentalAmount") continue;
    if (!DECIMAL_PATTERN.test(value) || Number(value) > WIFI_BILL_MAX_AMOUNT) {
      errors[field] = `Enter a non-negative amount up to ${WIFI_BILL_MAX_AMOUNT} with at most 2 decimals.`;
    }
  }
  const adjustmentFields = [
    "paymentReceived", "paymentCoupon", "credits",
    "history1Payments", "history1PaymentCoupon", "history1Credits",
    "history2Payments", "history2PaymentCoupon", "history2Credits",
    "history3Payments", "history3PaymentCoupon", "history3Credits",
  ] as const;
  for (const field of adjustmentFields) {
    const value = data[field].trim();
    if (!value) continue;
    if (!SIGNED_DECIMAL_PATTERN.test(value) || Number(value) > 0 || Math.abs(Number(value)) > WIFI_BILL_MAX_AMOUNT) {
      errors[field] = `Enter a signed zero or negative amount up to ${WIFI_BILL_MAX_AMOUNT} with at most 2 decimals.`;
    }
  }
  if (!errors.rentalAmount && !errors.discount && toPaise(data.discount) > toPaise(data.rentalAmount)) {
    errors.discount = "Discount cannot exceed the rental amount.";
  }
  if (!DECIMAL_PATTERN.test(data.gstRate.trim()) || Number(data.gstRate) > 100) {
    errors.gstRate = "Enter a GST rate from 0 to 100 with at most 2 decimals.";
  }
  if (data.taxMode !== "split" && data.taxMode !== "igst") {
    errors.taxMode = "Select CGST + SGST or IGST.";
  }
  if (data.amountMode !== "exclusive" && data.amountMode !== "inclusive") {
    errors.amountMode = "Select whether the entered amounts include GST.";
  }

  if (!isValidMonth(data.billMonth)) errors.billMonth = "Select a valid billing month.";
  if (data.monthMode !== "current" && data.monthMode !== "custom") errors.monthMode = "Choose current month or custom month.";
  for (const field of ["billDate", "dueDate", "periodStart", "periodEnd"] as const) {
    if (!parseDate(data[field])) errors[field] = "Select a valid date.";
  }
  if (!errors.periodStart && !errors.periodEnd && data.periodStart > data.periodEnd) {
    errors.periodEnd = "Billing period must end on or after its start date.";
  }
  if (!errors.billDate && !errors.dueDate && data.dueDate < data.billDate) {
    errors.dueDate = "Due date must be on or after the bill date.";
  }
  if (data.paymentDate && !parseDate(data.paymentDate)) errors.paymentDate = "Select a valid payment date.";

  if (!data.paymentUpiId.trim() || !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/.test(data.paymentUpiId.trim())) {
    errors.paymentUpiId = "Enter the operator's UPI ID for this account to generate the payment QR.";
  }
  if (!data.paymentPayeeName.trim()) errors.paymentPayeeName = "Enter the payment recipient's name.";
  if (!/^\d{4}$/.test(data.paymentMerchantCode.trim())) {
    errors.paymentMerchantCode = "Enter the 4-digit merchant category code assigned by the acquiring bank.";
  }
  if (!data.paymentTransactionNote.trim()) {
    errors.paymentTransactionNote = "Enter the payment description shown in the UPI app.";
  }

  for (const field of ["customerEmail", "supportEmail"] as const) {
    if (data[field].trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data[field].trim())) {
      errors[field] = "Enter a valid email address.";
    }
  }
  for (const field of ["customerPhone", "supportPhone", "fixedlineNumber"] as const) {
    const value = data[field].trim();
    if (value && (!/^[+\d\s().\/-]+$/.test(value) || !/^\d{6,18}$/.test(value.replace(/\D/g, "")))) {
      errors[field] = "Enter a valid phone number with 6 to 18 digits.";
    }
  }
  if (data.connections.trim() && (!/^\d+$/.test(data.connections) || Number(data.connections) < 1 || Number(data.connections) > 999)) {
    errors.connections = "Enter a whole number of connections from 1 to 999.";
  }
  for (const field of ["accountNumber", "invoiceNumber"] as const) {
    if (data[field].trim() && !/^[\x20-\x7E]+$/.test(data[field])) {
      errors[field] = "Use printable English letters, numbers or symbols so the barcode can be generated.";
    }
  }
  if (data.customerPostalCode.trim() && !/^\d{6}$/.test(data.customerPostalCode.trim())) {
    errors.customerPostalCode = "Enter a 6-digit postal code.";
  }
  if (data.customerStateCode.trim() && !/^\d{2}$/.test(data.customerStateCode.trim())) {
    errors.customerStateCode = "Enter a 2-digit state code.";
  }
  if (data.hsnSacCode.trim() && !/^\d{6}$/.test(data.hsnSacCode.trim())) {
    errors.hsnSacCode = "Enter a 6-digit HSN / SAC code.";
  }
  return errors;
}

export function formatMoney(amount: number): string {
  return moneyFormatter.format(Number.isFinite(amount) ? amount : 0);
}

/** Machine-readable monetary values share the same two-decimal rounding rule. */
export function formatPlainAmount(amount: number): string {
  return (Number.isFinite(amount) ? amount : 0).toFixed(2);
}

export function formatBillDate(value: string): string {
  const date = parseDate(value);
  return date
    ? `${String(date.getUTCDate()).padStart(2, "0")} ${SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
    : EMPTY_VALUE;
}

export function formatBillMonth(value: string): string {
  return isValidMonth(value)
    ? monthFormatter.format(new Date(`${value}-01T00:00:00.000Z`))
    : EMPTY_VALUE;
}

const SMALL_NUMBERS = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function integerInWords(value: number): string {
  if (value < 20) return SMALL_NUMBERS[value];
  if (value < 100) return `${TENS[Math.floor(value / 10)]}${value % 10 ? ` ${SMALL_NUMBERS[value % 10]}` : ""}`;
  for (const [unit, label] of [[10_000_000, "Crore"], [100_000, "Lakh"], [1000, "Thousand"], [100, "Hundred"]] as const) {
    if (value >= unit) {
      return `${integerInWords(Math.floor(value / unit))} ${label}${value % unit ? ` ${integerInWords(value % unit)}` : ""}`;
    }
  }
  return "Zero";
}

export function amountInWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(Math.round(amount * 100))) return EMPTY_VALUE;
  const paise = Math.round(amount * 100);
  const rupees = Math.floor(paise / 100);
  const fraction = paise % 100;
  return `${integerInWords(rupees)} ${rupees === 1 ? "Rupee" : "Rupees"}${fraction ? ` and ${integerInWords(fraction)} ${fraction === 1 ? "Paisa" : "Paise"}` : ""} Only`;
}
