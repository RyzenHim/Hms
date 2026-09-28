"use client";

import Image from "next/image";
import type { ChangeEvent, ReactNode } from "react";
import type { WifiBillData } from "../../types/wifi-bill";
import { formatBillMonth, WIFI_BILL_LINE_LIMITS, WIFI_BILL_MAX_AMOUNT, WIFI_BILL_TEXT_LIMITS } from "../../lib/wifi-bill";

type FieldErrors = Partial<Record<keyof WifiBillData, string>>;
type TextField = Exclude<keyof WifiBillData, "taxMode" | "amountMode" | "monthMode">;

interface WifiBillFormProps {
  data: WifiBillData;
  errors: FieldErrors;
  onChange: <K extends keyof WifiBillData>(field: K, value: WifiBillData[K]) => void;
  signaturePreviewUrl: string;
  signatureUploading: boolean;
  signatureError: string;
  onSignatureFileChange: (file: File) => void;
  onResetSignature: () => void;
  disabled?: boolean;
}

interface FieldDefinition {
  field: TextField;
  label: string;
  type?: "text" | "email" | "tel" | "date" | "month" | "number";
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  multiline?: boolean;
  wide?: boolean;
  hint?: string;
  autoComplete?: string;
  readOnly?: boolean;
}

const customerFields: FieldDefinition[] = [
  { field: "customerName", label: "Customer name", required: true, autoComplete: "name" },
  { field: "customerPhone", label: "Mobile number", type: "tel", required: true, autoComplete: "tel" },
  { field: "customerAddress", label: "Billing address", required: true, multiline: true, wide: true, autoComplete: "street-address" },
  { field: "customerEmail", label: "Email address", type: "email", autoComplete: "email" },
  { field: "customerGstin", label: "Customer GSTIN", hint: "Optional, for customers registered for GST." },
  { field: "customerState", label: "State / place of supply", autoComplete: "address-level1" },
  { field: "customerStateCode", label: "State code", hint: "Two-digit state code, if applicable." },
  { field: "accountNumber", label: "Account number", required: true, hint: "Printed below the Billing Address barcode; use English letters, numbers or symbols." },
  { field: "invoiceNumber", label: "Invoice number", required: true, hint: "Used as the UPI reference and printed below the Billing Address barcode; use up to 35 English letters, numbers or symbols." },
  { field: "billingBarcodeValue", label: "Billing-address barcode value", wide: true, hint: "One Code 128 payload for the Billing Address block. Leave blank to encode the account number." },
  { field: "wifiId", label: "WiFi / broadband ID" },
  { field: "fixedlineNumber", label: "Fixed-line number", type: "tel" },
];

const billingFields: FieldDefinition[] = [
  { field: "billDate", label: "Bill date", type: "date", required: true, readOnly: true },
  { field: "dueDate", label: "Payment due date", type: "date", required: true, readOnly: true },
  { field: "periodStart", label: "Billing period starts", type: "date", required: true, readOnly: true },
  { field: "periodEnd", label: "Billing period ends", type: "date", required: true, readOnly: true },
];

const planFields: FieldDefinition[] = [
  { field: "planName", label: "Plan name", required: true, wide: true },
  { field: "speed", label: "Internet speed", hint: "For example, 100 Mbps." },
  { field: "quota", label: "Data allowance", hint: "For example, Unlimited or 1,000 GB." },
  { field: "connections", label: "Number of connections", type: "number", min: 1, max: 999, step: 1 },
  { field: "hsnCode", label: "HSN / SAC code" },
  { field: "rentalAmount", label: "Plan amount (₹)", type: "number", required: true, min: 0, max: WIFI_BILL_MAX_AMOUNT, step: 0.01, hint: "Total for all connections in this billing period." },
  { field: "discount", label: "Discount (₹)", type: "number", min: 0, max: WIFI_BILL_MAX_AMOUNT, step: 0.01 },
  { field: "otherCharges", label: "Other charges (₹)", type: "number", min: 0, max: WIFI_BILL_MAX_AMOUNT, step: 0.01 },
  { field: "gstRate", label: "Total GST rate (%)", type: "number", required: true, min: 0, max: 100, step: 0.01, hint: "Use 0 for no GST. For split GST, this rate is divided equally between CGST and SGST." },
];

const providerFields: FieldDefinition[] = [
  { field: "providerName", label: "Provider / business name", required: true, wide: true },
  { field: "providerAddress", label: "Provider address", required: true, multiline: true, wide: true },
  { field: "providerGstin", label: "Provider GSTIN" },
  { field: "providerPan", label: "Provider PAN" },
  { field: "providerCin", label: "Corporate identity number (CIN)" },
  { field: "providerServiceCategory", label: "GST service category" },
  { field: "supportPhone", label: "Support phone", type: "tel" },
  { field: "supportEmail", label: "Support email", type: "email" },
  { field: "paymentInstructions", label: "Payment instructions", multiline: true, wide: true, hint: "For example, accepted payment methods or bank details." },
];

const issuerFields: FieldDefinition[] = [
  { field: "issuerSignatoryName", label: "Authorised signatory name" },
  { field: "issuerSignatoryTitle", label: "Authorised signatory title" },
  { field: "registeredOffice", label: "Registered office", multiline: true, wide: true },
  { field: "corporateOffice", label: "Corporate office", multiline: true, wide: true },
];

const providerInformationFields: FieldDefinition[] = [
  { field: "contactInformation", label: "Customer care information", multiline: true, wide: true },
  { field: "appellateInformation", label: "Appellate desk information", multiline: true, wide: true },
  { field: "corporateCoordinatorInformation", label: "Corporate coordinator information", multiline: true, wide: true },
  { field: "chargesInformation", label: "Administrative and late-payment charges", multiline: true, wide: true },
  { field: "addressChangeInformation", label: "Address change information", multiline: true, wide: true },
  { field: "otherInformation", label: "Other statutory information", multiline: true, wide: true },
  { field: "fupInformation", label: "Fair Usage Policy note", multiline: true, wide: true },
  { field: "hsnServiceInformation", label: "HSN / SAC service catalogue", multiline: true, wide: true },
];

const paymentFields: FieldDefinition[] = [
  { field: "previousBalance", label: "Previous balance (₹)", type: "number", min: 0, max: WIFI_BILL_MAX_AMOUNT, step: 0.01 },
  { field: "paymentReceived", label: "Payment received (₹)", type: "number", min: 0, max: WIFI_BILL_MAX_AMOUNT, step: 0.01 },
  { field: "paymentCoupon", label: "Payment coupon (₹)", type: "number", min: 0, max: WIFI_BILL_MAX_AMOUNT, step: 0.01, hint: "Reduces the balance due." },
  { field: "paymentDate", label: "Payment date", type: "date" },
  { field: "paymentMethod", label: "Payment method", hint: "For example, UPI, card or bank transfer." },
  { field: "credits", label: "Credits / adjustments (₹)", type: "number", min: 0, max: WIFI_BILL_MAX_AMOUNT, step: 0.01, hint: "Reduces the balance due." },
  { field: "creditLimit", label: "Credit limit (₹)", type: "number", min: 0, max: WIFI_BILL_MAX_AMOUNT, step: 0.01, hint: "Informational account limit shown on the tax invoice." },
  { field: "securityDeposit", label: "Security deposit (₹)", type: "number", min: 0, max: WIFI_BILL_MAX_AMOUNT, step: 0.01, hint: "Informational deposit shown on the tax invoice." },
  { field: "notes", label: "Additional notes", multiline: true, wide: true },
];

const historyFields: FieldDefinition[] = ([1, 2, 3] as const).flatMap((month) => {
  const prefix = `history${month}` as const;
  const period = month === 1 ? "1 month ago" : `${month} months ago`;
  return [
    { field: `${prefix}PreviousDues`, label: `${period} — previous dues (₹)`, type: "number", min: 0, max: WIFI_BILL_MAX_AMOUNT, step: 0.01 },
    { field: `${prefix}Payments`, label: `${period} — payments (₹)`, type: "number", min: 0, max: WIFI_BILL_MAX_AMOUNT, step: 0.01 },
    { field: `${prefix}PaymentCoupon`, label: `${period} — payment coupon (₹)`, type: "number", min: 0, max: WIFI_BILL_MAX_AMOUNT, step: 0.01 },
    { field: `${prefix}Credits`, label: `${period} — credits (₹)`, type: "number", min: 0, max: WIFI_BILL_MAX_AMOUNT, step: 0.01 },
    { field: `${prefix}CurrentCharges`, label: `${period} — monthly charges (₹)`, type: "number", min: 0, max: WIFI_BILL_MAX_AMOUNT, step: 0.01 },
  ] as FieldDefinition[];
});

const tariffFields: FieldDefinition[] = [
  { field: "tariffAirtelFixedline", label: "To Airtel fixed-line", wide: true },
  { field: "tariffOtherFixedline", label: "To other fixed-line", wide: true },
  { field: "tariffAirtelMobile", label: "To Airtel mobile", wide: true },
  { field: "tariffOtherMobile", label: "To other mobile", wide: true },
  { field: "tariffFixedlineCug", label: "To fixed-line CUG", wide: true },
  { field: "tariffWll", label: "To WLL", wide: true },
];

const qrFields: FieldDefinition[] = [
  { field: "paymentUpiId", label: "Operator UPI ID for this account", required: true, wide: true, hint: "Use the UPI ID shown on the account's operator bill. Check it before sharing a payment QR." },
  { field: "paymentPayeeName", label: "Payment recipient name", required: true, wide: true },
  { field: "paymentMerchantCode", label: "Merchant category code (MCC)", required: true, hint: "Use the 4-digit MCC assigned by the acquiring bank. The Airtel reference uses 4814 for telecommunications." },
  { field: "paymentTransactionNote", label: "UPI payment description", required: true, hint: "Shown to the customer in the UPI app." },
];

const inputClassName =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60 [color-scheme:dark]";

export function WifiBillForm({
  data,
  errors,
  onChange,
  signaturePreviewUrl,
  signatureUploading,
  signatureError,
  onSignatureFileChange,
  onResetSignature,
  disabled = false,
}: WifiBillFormProps) {
  const renderField = ({ field, label, type = "text", required, min, max, step, multiline, wide, hint, autoComplete, readOnly }: FieldDefinition) => {
    const id = `wifi-${field}`;
    const error = errors[field];
    const lineLimit = WIFI_BILL_LINE_LIMITS[field];
    const fieldHint = [hint, multiline && lineLimit ? `Up to ${lineLimit} lines.` : undefined].filter(Boolean).join(" ");
    const describedBy = [fieldHint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
    const sharedProps = {
      id,
      name: field,
      value: data[field],
      required,
      readOnly,
      maxLength: WIFI_BILL_TEXT_LIMITS[field],
      autoComplete: autoComplete ?? "off",
      "aria-invalid": Boolean(error),
      "aria-describedby": describedBy,
      className: `${inputClassName}${error ? " border-rose-500" : ""}`,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(field, event.target.value),
    };

    return (
      <div key={field} className={wide ? "sm:col-span-2" : undefined}>
        <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-slate-300">
          {label}{required && <span className="ml-1 text-sky-400" aria-hidden="true">*</span>}
        </label>
        {multiline ? (
          <textarea {...sharedProps} rows={3} className={`${sharedProps.className} resize-y`} />
        ) : (
          <input {...sharedProps} type={type} min={min} max={max} step={step} inputMode={type === "number" ? (step === 1 ? "numeric" : "decimal") : undefined} />
        )}
        {fieldHint && <p id={`${id}-hint`} className="mt-1.5 text-xs leading-5 text-slate-500">{fieldHint}</p>}
        {error && <p id={`${id}-error`} className="mt-1.5 text-xs text-rose-400">{error}</p>}
      </div>
    );
  };

  const renderSection = (title: string, description: string, fields: FieldDefinition[], children?: ReactNode, optional = false) => (
    <details className="group overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60" open={!optional || fields.some(({ field }) => Boolean(errors[field]))}>
      <summary className="cursor-pointer px-4 py-4 text-sm font-semibold text-slate-100 outline-none hover:bg-slate-800/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500">
        {title}
        {optional && <span className="ml-2 text-xs font-normal text-slate-500">Optional</span>}
      </summary>
      <div className="border-t border-slate-800 px-4 pb-5 pt-4">
        <p className="mb-4 text-xs leading-5 text-slate-400">{description}</p>
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
          {fields.map(renderField)}
          {children}
        </div>
      </div>
    </details>
  );

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-4">
      <legend className="sr-only">WiFi bill details</legend>
      <p className="text-xs text-slate-500">Fields marked <span className="text-sky-400">*</span> are required.</p>
      <section className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4" aria-labelledby="wifi-month-mode-label">
        <h3 id="wifi-month-mode-label" className="text-sm font-semibold">Generate bill for</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {([['current', 'Current month'], ['custom', 'Custom month']] as const).map(([value, label]) => (
            <label key={value} className={`cursor-pointer rounded-lg border p-3 text-sm ${data.monthMode === value ? "border-sky-400 bg-sky-400/10 text-sky-200" : "border-slate-700 text-slate-300"}`}>
              <input id={`wifi-monthMode-${value}`} type="radio" name="monthMode" value={value} checked={data.monthMode === value} onChange={() => onChange("monthMode", value)} className="mr-2 accent-sky-400" />
              {label}
            </label>
          ))}
        </div>
        <div className="mt-4">
          {data.monthMode === "custom" ? renderField({ field: "billMonth", label: "Choose month and year", type: "month", required: true }) : <p className="text-sm text-sky-200">{formatBillMonth(data.billMonth)} <span className="block mt-1 text-xs text-slate-400">Uses your device&apos;s current month, refreshed before generating.</span></p>}
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-400">Reference bill schedule: previous month&apos;s 5th through this month&apos;s 4th. Bill date: 6th. Payment due: 16th.</p>
      </section>
      {renderSection("Customer information", "Enter the customer and account details to print on the bill.", customerFields)}
      {renderSection("Billing period", "Dates follow the reference PDF schedule for the selected month.", billingFields)}
      {renderSection("Payment QR", "The QR and payment link use these recipient details plus the bill's current payable amount, invoice, HSN and GST values.", qrFields)}
      {renderSection("Plan & charges", "Set the complete plan amount and choose how GST is applied.", planFields, <>
        <div>
          <label htmlFor="wifi-amountMode" className="mb-1.5 block text-xs font-medium text-slate-300">Amount entry</label>
          <select id="wifi-amountMode" name="amountMode" value={data.amountMode} onChange={(event) => onChange("amountMode", event.target.value as WifiBillData["amountMode"])} className={inputClassName} aria-invalid={Boolean(errors.amountMode)} aria-describedby={`wifi-amountMode-hint${errors.amountMode ? " wifi-amountMode-error" : ""}`}>
            <option value="exclusive">Amounts exclude GST</option>
            <option value="inclusive">Amounts include GST</option>
          </select>
          <p id="wifi-amountMode-hint" className="mt-1.5 text-xs leading-5 text-slate-500">Applies to the plan amount, discount and other charges. Inclusive amounts have GST extracted from them.</p>
          {errors.amountMode && <p id="wifi-amountMode-error" className="mt-1.5 text-xs text-rose-400">{errors.amountMode}</p>}
        </div>
        <div>
          <label htmlFor="wifi-taxMode" className="mb-1.5 block text-xs font-medium text-slate-300">GST breakdown</label>
          <select id="wifi-taxMode" name="taxMode" value={data.taxMode} onChange={(event) => onChange("taxMode", event.target.value as WifiBillData["taxMode"])} className={inputClassName} aria-invalid={Boolean(errors.taxMode)} aria-describedby={`wifi-taxMode-hint${errors.taxMode ? " wifi-taxMode-error" : ""}`}>
            <option value="split">CGST + SGST (equal split)</option>
            <option value="igst">IGST</option>
          </select>
          <p id="wifi-taxMode-hint" className="mt-1.5 text-xs leading-5 text-slate-500">Choose the tax breakdown applicable to this bill.</p>
          {errors.taxMode && <p id="wifi-taxMode-error" className="mt-1.5 text-xs text-rose-400">{errors.taxMode}</p>}
        </div>
      </>)}
      {renderSection("Provider", "Add the business details and payment instructions shown on the invoice.", providerFields)}
      {renderSection("Issuer & office details", "These details appear beside the authorisation and in the statutory information block.", issuerFields, (
        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-slate-300">Authorised signature image</span>
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-700 bg-white p-3">
            <Image
              src={signaturePreviewUrl}
              alt="Signature shown on the tax invoice"
              width={156}
              height={70}
              className="h-[70px] w-[156px] object-fill"
              unoptimized
            />
            <div className="min-w-0 flex-1 space-y-2">
              <label htmlFor="wifi-signature-file" className="inline-flex cursor-pointer rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400">
                {signatureUploading ? "Uploading..." : "Choose another signature"}
              </label>
              <input
                id="wifi-signature-file"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={signatureUploading}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) onSignatureFileChange(file);
                }}
              />
              {data.issuerSignatureUrl && (
                <button type="button" onClick={onResetSignature} disabled={signatureUploading} className="ml-2 text-xs font-semibold text-sky-700 underline underline-offset-2 disabled:opacity-50">
                  Use PDF signature
                </button>
              )}
              <p className="text-xs leading-5 text-slate-600">
                {data.issuerSignatureUrl ? "Custom signature stored with this draft." : "Exact signature extracted from the supplied PDF."} PNG, JPEG or WebP, up to 2 MB.
              </p>
            </div>
          </div>
          {signatureError && <p role="alert" className="mt-1.5 text-xs text-rose-400">{signatureError}</p>}
        </div>
      ), true)}
      {renderSection("Provider notices", "Review the customer-care, statutory, policy and HSN information printed on the final page.", providerInformationFields, undefined, true)}
      {renderSection("Voice tariff details", "Enter each row as Local | STD intra-circle | STD inter-circle | ISD. These values are printed in the same four columns as the reference bill.", tariffFields, undefined, true)}
      {renderSection("Previous bill history", "Enter the five values printed for each of the three earlier months. Amount payable is calculated from previous dues minus payments, coupons and credits, plus monthly charges.", historyFields, undefined, true)}
      {renderSection("Payments & adjustments", "Use these fields to reconcile previous balances and payments. Leave unused amounts at zero.", paymentFields, undefined, true)}
    </fieldset>
  );
}
