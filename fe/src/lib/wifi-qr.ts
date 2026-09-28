import type { WifiBillData, WifiBillTotals } from "../types/wifi-bill";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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

function invoiceDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return "";
  return `${value.slice(8)}-${MONTHS[date.getUTCMonth()]}-${value.slice(2, 4)}`;
}

/** Protect the reference's comma-delimited metadata without changing ordinary IDs. */
function metadataValue(value: string): string {
  return value.trim().replace(/[%,=\r\n]/g, (character) => encodeURIComponent(character));
}

/** Explain why the live payment QR is unavailable instead of failing silently. */
export function getWifiPaymentQrIssue(data: WifiBillData, totals: WifiBillTotals): string {
  if (!data.paymentUpiId.trim()) {
    return usesReferenceOperator(data.providerName) && !data.accountNumber.trim()
      ? "Enter the Airtel account number to create its payment UPI ID and QR code."
      : "Enter the operator's payment UPI ID to generate the QR code.";
  }
  if (!isValidUpiId(data.paymentUpiId)) {
    return "Enter a valid payment UPI ID in the format account@provider.";
  }
  if (!validSingleLine(data.paymentPayeeName, 70)) {
    return "Enter a payment recipient name using 70 characters or fewer.";
  }
  if (!/^\d{4}$/.test(data.paymentMerchantCode.trim())) {
    return "Enter the 4-digit merchant category code used by the payment provider.";
  }
  if (!validSingleLine(data.paymentTransactionNote, 80)) {
    return "Enter a single-line UPI payment description using 80 characters or fewer.";
  }
  if (!validSingleLine(data.invoiceNumber, 35)) {
    return "Enter an invoice number using 35 characters or fewer to generate the payment QR.";
  }
  if (!invoiceDate(data.billDate)) {
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
export function buildWifiPaymentQrPayload(data: WifiBillData, totals: WifiBillTotals): string {
  if (getWifiPaymentQrIssue(data, totals)) return "";
  const billDate = invoiceDate(data.billDate);
  const payeeName = data.paymentPayeeName.trim();
  const merchantCode = data.paymentMerchantCode.trim();
  const transactionNote = data.paymentTransactionNote.trim();

  const invoiceMetadata = [
    "000000",
    `InvNo=${metadataValue(data.invoiceNumber)}`,
    `InvoiceBilldate=${billDate}`,
    `ItemCount=${totals.otherChargesBeforeTax > 0 ? 2 : 1}`,
    `HSN/SACCode=${metadataValue(data.hsnCode)}`,
    `SellerGST=${metadataValue(data.providerGstin)}`,
    "Payee Bank AcctNo=",
    "IFSC_CODE=",
    `Tot_GST=${totals.gstTotal.toFixed(2)}`,
    `CGST=${totals.cgst.toFixed(2)}`,
    `SGST=${totals.sgst.toFixed(2)}`,
    `IGST=${totals.igst.toFixed(2)}`,
    "CESS=0.00",
    `TotalInvAmt=${totals.totalCurrentCharges.toFixed(2)}`,
  ].join(",");

  const parameters = new URLSearchParams({
    pa: data.paymentUpiId.trim(),
    pn: payeeName,
    mc: merchantCode,
    tr: data.invoiceNumber.trim(),
    tn: transactionNote,
    cu: "INR",
    // NPCI treats `am` in a dynamic merchant QR as the non-editable amount.
    // Matching `mam` prevents a payment app from accepting a lower amount.
    am: totals.totalPayable.toFixed(2),
    mam: totals.totalPayable.toFixed(2),
    mode: "01",
    purpose: "00",
    orgId: invoiceMetadata,
  });
  return `upi://pay?${parameters.toString()}`;
}
