import type { WifiBillData, WifiCompanyAssets, WifiInvoice } from "../types/wifi-bill.ts";
import { applyPlanBasedLastPayment, calculateWifiBill } from "./wifi-bill.ts";

function cleanSingleLine(value: string): string {
  return value.trim().replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").replace(/,\s*$/, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Remove only repeated trailing location parts; street names elsewhere are preserved. */
function normalizeAddressLine1(line1: string, city: string, state: string, postalCode: string): string {
  let normalized = cleanSingleLine(line1);
  const locations = [city, state, postalCode].map(cleanSingleLine).filter(Boolean);
  for (let size = locations.length; size > 0; size -= 1) {
    const suffix = locations.slice(0, size).map(escapeRegExp).join("\\s*,\\s*");
    normalized = normalized.replace(new RegExp(`(?:\\s*,\\s*|\\s+)${suffix}$`, "i"), "");
  }
  return normalized.replace(/,\s*$/, "").trim();
}

function uniqueLocationParts(values: string[]): string[] {
  const seen = new Set<string>();
  return values.map(cleanSingleLine).filter((value) => {
    const key = value.toLocaleLowerCase("en-IN");
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function optionalPaise(value: string): number | null {
  const trimmed = value.trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const sign = trimmed.startsWith("-") ? -1 : 1;
  const [whole, fraction = ""] = trimmed.replace(/^-/, "").split(".");
  const amount = sign * (Number(whole) * 100 + Number(fraction.padEnd(2, "0")));
  return Number.isSafeInteger(amount) ? amount : null;
}

/**
 * Resolve the editable draft into the one immutable view model used by the
 * document, machine codes, validation and PDF metadata.
 */
export function createWifiInvoice(
  data: WifiBillData,
  companyAssets: Partial<WifiCompanyAssets> = {},
): WifiInvoice {
  const source = Object.freeze(applyPlanBasedLastPayment({ ...data }));
  const addressLine1 = normalizeAddressLine1(
    source.customerAddressLine1,
    source.customerCity,
    source.customerState,
    source.customerPostalCode,
  );
  const locationLine = uniqueLocationParts([
    source.customerCity,
    source.customerState,
    source.customerPostalCode,
  ]).join(", ");
  const addressLines = Object.freeze([addressLine1, locationLine].filter(Boolean));
  const calculations = Object.freeze(calculateWifiBill(source));
  const identifiers = Object.freeze({
    invoiceNumber: source.invoiceNumber.trim(),
    accountNumber: source.accountNumber.trim(),
    wifiId: source.wifiId.trim(),
    fixedlineNumber: source.fixedlineNumber.trim(),
    billMonth: source.billMonth,
    billDate: source.billDate,
    dueDate: source.dueDate,
    periodStart: source.periodStart,
    periodEnd: source.periodEnd,
    paymentReference: source.invoiceNumber.trim(),
  });
  const makeStatementRow = (
    previousDues: number | null,
    payments: number | null,
    paymentCoupon: number | null,
    credits: number | null,
    currentCharges: number | null,
  ) => {
    const hasValues = [previousDues, payments, paymentCoupon, credits, currentCharges].some((value) => value !== null);
    const payable = hasValues
      ? Math.max(0, (previousDues || 0) + (payments || 0) + (paymentCoupon || 0) + (credits || 0) + (currentCharges || 0))
      : null;
    return Object.freeze({
      // Both summary rows show the full payable as dues and an equal payment.
      previousDues: payable,
      payments: payable === null ? null : payable === 0 ? 0 : -payable,
      paymentCoupon,
      credits,
      currentCharges,
      payable,
    });
  };
  const statementRow = makeStatementRow(
    optionalPaise(source.previousBalance),
    optionalPaise(source.paymentReceived),
    optionalPaise(source.paymentCoupon),
    optionalPaise(source.credits),
    Math.round(calculations.totalCurrentCharges * 100),
  );
  // The statement intentionally shows at most the immediately previous month.
  const historyRows = Object.freeze(([1] as const).map((offset) => {
    const read = (suffix: "PreviousDues" | "Payments" | "PaymentCoupon" | "Credits" | "CurrentCharges") =>
      optionalPaise(source[`history${offset}${suffix}`]);
    const previousDues = read("PreviousDues");
    const payments = read("Payments");
    const paymentCoupon = read("PaymentCoupon");
    const credits = read("Credits");
    const currentCharges = read("CurrentCharges");
    return Object.freeze({
      offset,
      ...makeStatementRow(previousDues, payments, paymentCoupon, credits, currentCharges),
    });
  }).filter((row) => row.payable !== null));

  return Object.freeze({
    source,
    companyProfile: Object.freeze({
      legalName: source.providerName.trim(),
      address: source.providerAddress.trim(),
      gstin: source.providerGstin.trim(),
      pan: source.providerPan.trim(),
      cin: source.providerCin.trim(),
      serviceCategory: source.providerServiceCategory.trim(),
      registeredOffice: source.registeredOffice.trim(),
      corporateOffice: source.corporateOffice.trim(),
      supportPhone: source.supportPhone.trim(),
      supportEmail: source.supportEmail.trim(),
      assets: Object.freeze({
        logoUrl: companyAssets.logoUrl || "",
        detailLogoUrl: companyAssets.detailLogoUrl || companyAssets.logoUrl || "",
        paymentLogoUrl: companyAssets.paymentLogoUrl || "",
        signatureUrl: companyAssets.signatureUrl || "",
        pageTwoBannerUrl: companyAssets.pageTwoBannerUrl || "",
        paymentAppName: companyAssets.paymentAppName || "",
        paymentPortalUrl: companyAssets.paymentPortalUrl || "",
      }),
    }),
    customer: Object.freeze({
      name: source.customerName.trim(),
      addressLine1,
      city: cleanSingleLine(source.customerCity),
      state: cleanSingleLine(source.customerState),
      postalCode: cleanSingleLine(source.customerPostalCode),
      addressLines,
      email: source.customerEmail.trim(),
      phone: source.customerPhone.trim(),
      gstin: source.customerGstin.trim(),
      stateCode: source.customerStateCode.trim(),
    }),
    identifiers,
    plan: Object.freeze({
      displayName: source.planDisplayName.trim(),
      hsnSacCode: source.hsnSacCode.trim(),
      serviceDescription: source.hsnServiceDescription.trim(),
      speed: source.speed.trim(),
      quota: source.quota.trim(),
      connections: source.connections.trim(),
    }),
    payment: Object.freeze({
      upiId: source.paymentUpiId.trim(),
      payeeName: source.paymentPayeeName.trim(),
      merchantCode: source.paymentMerchantCode.trim(),
      transactionNote: source.paymentTransactionNote.trim(),
    }),
    calculations,
    barcodeValue: [identifiers.accountNumber, identifiers.invoiceNumber].filter(Boolean).join(" "),
    statementRow,
    historyRows,
  });
}
