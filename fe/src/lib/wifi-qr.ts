import type { WifiBillData, WifiInvoice } from "../types/wifi-bill.ts";
import { formatBillDate, formatPlainAmount } from "./wifi-bill.ts";
const REFERENCE_OPERATOR_PATTERN = /^(?:(?:bharti\s+)?airtel|bharti\s+hexacom)(?:\s+(?:limited|ltd\.?))?$/i;

function usesReferenceOperator(providerName: string): boolean {
  return REFERENCE_OPERATOR_PATTERN.test(providerName.trim());
}

export function isValidUpiId(value: string): boolean {
  return value.trim().length <= 100 && /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/.test(value.trim());
}

type WifiPaymentDestination = Pick<WifiBillData, "providerName" | "accountNumber" | "paymentUpiId">;

/** Airtel's account-specific UPI address follows the format decoded from the reference bill. */
export function deriveAirtelPaymentUpiId(accountNumber: string): string {
  const account = accountNumber.trim();
  return account ? `${account}.FL@mairtel` : "";
}

export function isDerivedAirtelPaymentUpiId(data: WifiPaymentDestination): boolean {
  return usesReferenceOperator(data.providerName)
    && Boolean(data.paymentUpiId.trim())
    && data.paymentUpiId.trim() === deriveAirtelPaymentUpiId(data.accountNumber);
}

export function syncWifiPaymentUpiId(data: WifiPaymentDestination, manuallyOverridden: boolean): string {
  if (manuallyOverridden) return data.paymentUpiId;
  return usesReferenceOperator(data.providerName)
    ? deriveAirtelPaymentUpiId(data.accountNumber)
    : "";
}

/** Upgrade older Airtel drafts that predate the account-specific payment destination field. */
export function withDerivedAirtelPaymentUpiId<T extends WifiPaymentDestination>(data: T): T {
  if (data.paymentUpiId.trim() || !usesReferenceOperator(data.providerName)) return data;
  const paymentUpiId = syncWifiPaymentUpiId(data, false);
  return paymentUpiId ? { ...data, paymentUpiId } : data;
}

function validSingleLine(value: string, maximum: number): boolean {
  const trimmed = value.trim();
  return Boolean(trimmed) && trimmed.length <= maximum && !/[\r\n]/.test(trimmed);
}

/** Protect the reference's comma-delimited metadata without changing ordinary IDs. */
function metadataValue(value: string): string {
  return value.trim().replace(/[%,=\r\n]/g, (character) => encodeURIComponent(character));
}

/** Explain why the live payment QR is unavailable instead of failing silently. */
export function getWifiPaymentQrIssue(invoice: WifiInvoice): string {
  const { calculations: totals, identifiers, payment } = invoice;
  if (!payment.upiId) {
    return usesReferenceOperator(invoice.companyProfile.legalName) && !identifiers.accountNumber
      ? "Enter the Airtel account number to create its payment UPI ID and QR code."
      : "Enter the operator's payment UPI ID to generate the QR code.";
  }
  if (!isValidUpiId(payment.upiId)) {
    return "Enter a valid payment UPI ID in the format account@provider.";
  }
  if (!validSingleLine(payment.payeeName, 70)) {
    return "Enter a payment recipient name using 70 characters or fewer.";
  }
  if (!/^\d{4}$/.test(payment.merchantCode)) {
    return "Enter the 4-digit merchant category code used by the payment provider.";
  }
  if (!validSingleLine(payment.transactionNote, 80)) {
    return "Enter a single-line UPI payment description using 80 characters or fewer.";
  }
  if (!validSingleLine(identifiers.invoiceNumber, 35)) {
    return "Enter an invoice number using 35 characters or fewer to generate the payment QR.";
  }
  if (formatBillDate(identifiers.billDate) === "—") {
    return "Select a valid bill date to generate the payment QR.";
  }
  if (!Number.isFinite(totals.totalPayable) || totals.totalPayable <= 0) {
    return "The amount payable must be greater than zero to generate a payment QR.";
  }
  return "";
}

/**
 * Rebuild the UPI payload decoded from the reference PDF. Its invoice metadata is
 * unusually embedded in the orgId query value as comma-delimited key/value pairs.
 * Keep that format, but never reuse the reference account, invoice, or stale tax
 * amounts. The PDF's bank account and IFSC fields are empty; no CESS is charged.
 * This is a payment QR with invoice metadata, not a signed GST e-invoice QR.
 */
export function buildWifiPaymentQrPayload(invoice: WifiInvoice): string {
  if (getWifiPaymentQrIssue(invoice)) return "";
  const { companyProfile, calculations: totals, identifiers, payment, plan } = invoice;
  const billDate = formatBillDate(identifiers.billDate);

  const invoiceMetadata = [
    "000000",
    `InvNo=${metadataValue(identifiers.invoiceNumber)}`,
    `AccountNo=${metadataValue(identifiers.accountNumber)}`,
    `PaymentReference=${metadataValue(identifiers.paymentReference)}`,
    `InvoiceBilldate=${billDate}`,
    `ItemCount=${totals.otherChargesBeforeTax > 0 ? 2 : 1}`,
    `HSN/SACCode=${metadataValue(plan.hsnSacCode)}`,
    `SellerGST=${metadataValue(companyProfile.gstin)}`,
    "Payee Bank AcctNo=",
    "IFSC_CODE=",
    `Tot_GST=${formatPlainAmount(totals.gstTotal)}`,
    `CGST=${formatPlainAmount(totals.cgst)}`,
    `SGST=${formatPlainAmount(totals.sgst)}`,
    `IGST=${formatPlainAmount(totals.igst)}`,
    "CESS=0.00",
    `TotalInvAmt=${formatPlainAmount(totals.totalCurrentCharges)}`,
  ].join(",");

  const parameters = new URLSearchParams({
    pa: payment.upiId,
    pn: payment.payeeName,
    mc: payment.merchantCode,
    tr: identifiers.paymentReference,
    tn: payment.transactionNote,
    cu: "INR",
    // NPCI treats `am` in a dynamic merchant QR as the non-editable amount.
    // Matching `mam` prevents a payment app from accepting a lower amount.
    am: formatPlainAmount(totals.totalPayable),
    mam: formatPlainAmount(totals.totalPayable),
    mode: "01",
    purpose: "00",
    orgId: invoiceMetadata,
  });
  return `upi://pay?${parameters.toString()}`;
}

export interface ParsedWifiPaymentQr {
  parameters: URLSearchParams;
  organization: string;
  metadata: Readonly<Record<string, string>>;
}

/** Parse the exact data a scanner receives, rejecting duplicate keys. */
export function parseWifiPaymentQrPayload(payload: string): ParsedWifiPaymentQr {
  const url = new URL(payload);
  if (url.protocol !== "upi:" || url.hostname !== "pay") throw new Error("Invalid UPI payment payload.");
  const parameters = url.searchParams;
  for (const key of parameters.keys()) {
    if (parameters.getAll(key).length !== 1) throw new Error(`Duplicate QR parameter: ${key}.`);
  }
  const rawMetadata = parameters.get("orgId") || "";
  const [organization, ...entries] = rawMetadata.split(",");
  const metadata: Record<string, string> = {};
  for (const entry of entries) {
    const delimiter = entry.indexOf("=");
    if (delimiter < 0) throw new Error("Invalid invoice metadata entry.");
    const key = entry.slice(0, delimiter);
    if (Object.hasOwn(metadata, key)) throw new Error(`Duplicate QR metadata: ${key}.`);
    metadata[key] = decodeURIComponent(entry.slice(delimiter + 1));
  }
  return { parameters, organization, metadata: Object.freeze(metadata) };
}
