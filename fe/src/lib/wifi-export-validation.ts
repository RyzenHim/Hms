import jsQR from "jsqr";
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  GlobalHistogramBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from "@zxing/library";
import type { WifiInvoice } from "../types/wifi-bill.ts";
import { calculateWifiBill, formatBillDate, formatPlainAmount } from "./wifi-bill.ts";
import { parseWifiPaymentQrPayload } from "./wifi-qr.ts";

export interface QrModuleMatrix {
  size: number;
  data: ArrayLike<number | boolean>;
}

export interface WifiExportArtifacts {
  qrPayload: string;
  decodedQrPayload: string;
  barcodeModules: string;
}

/** Decode the actual QR module matrix produced by `qrcode`. */
export function decodeQrModuleMatrix(modules: QrModuleMatrix, margin = 4, scale = 4): string {
  const width = (modules.size + margin * 2) * scale;
  const rgba = new Uint8ClampedArray(width * width * 4);
  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const moduleX = Math.floor(x / scale) - margin;
      const moduleY = Math.floor(y / scale) - margin;
      const dark = moduleX >= 0 && moduleX < modules.size && moduleY >= 0 && moduleY < modules.size
        ? Boolean(modules.data[moduleY * modules.size + moduleX])
        : false;
      const offset = (y * width + x) * 4;
      const channel = dark ? 0 : 255;
      rgba[offset] = channel;
      rgba[offset + 1] = channel;
      rgba[offset + 2] = channel;
      rgba[offset + 3] = 255;
    }
  }
  return jsQR(rgba, width, width, { inversionAttempts: "dontInvert" })?.data || "";
}

/** Rasterize the printed Code 128 bars and decode them with an independent scanner. */
export function decodeRenderedCode128(modules: string, scale = 3, height = 96): string {
  if (!/^[01]+$/.test(modules) || scale < 1 || height < 32) {
    throw new Error("The rendered barcode data is invalid.");
  }
  const width = modules.length * scale;
  const luminance = new Uint8ClampedArray(width * height);
  luminance.fill(255);
  const verticalMargin = Math.max(4, Math.floor(height / 12));
  for (let y = verticalMargin; y < height - verticalMargin; y += 1) {
    for (let moduleIndex = 0; moduleIndex < modules.length; moduleIndex += 1) {
      if (modules[moduleIndex] !== "1") continue;
      const start = y * width + moduleIndex * scale;
      luminance.fill(0, start, start + scale);
    }
  }
  const bitmap = new BinaryBitmap(new GlobalHistogramBinarizer(
    new RGBLuminanceSource(luminance, width, height),
  ));
  const hints = new Map<DecodeHintType, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]],
    [DecodeHintType.TRY_HARDER, true],
  ]);
  return new MultiFormatReader().decode(bitmap, hints).getText();
}

function paise(value: number): number {
  return Math.round(value * 100);
}

function expectEqual(issues: string[], label: string, actual: string | number, expected: string | number) {
  if (actual !== expected) issues.push(`${label} does not match the invoice model.`);
}

/**
 * Final consistency gate. PDF generation must not proceed when any machine code,
 * identifier, date, tax or calculation differs from the canonical invoice.
 */
export function validateWifiInvoiceForExport(invoice: WifiInvoice, artifacts: WifiExportArtifacts): string[] {
  const issues: string[] = [];
  const { calculations: amounts, identifiers, plan, source } = invoice;
  const recalculated = calculateWifiBill(source);
  for (const [name, value] of Object.entries(amounts)) {
    if (!Number.isFinite(value) || !Number.isSafeInteger(paise(value))) {
      issues.push(`${name} is not a valid two-decimal amount.`);
    }
  }
  for (const [name, expected] of Object.entries(recalculated)) {
    expectEqual(issues, `Recalculated ${name}`, paise(amounts[name as keyof typeof amounts]), paise(expected));
  }

  expectEqual(issues, "GST total", paise(amounts.gstTotal), paise(amounts.cgst + amounts.sgst + amounts.igst));
  expectEqual(issues, "Current charges", paise(amounts.totalCurrentCharges), paise(amounts.taxableAmount + amounts.gstTotal));
  expectEqual(issues, "Gross charges before tax", paise(amounts.grossChargesBeforeTax), paise(amounts.rentalBeforeTax + amounts.otherChargesBeforeTax));
  expectEqual(issues, "Payment total", paise(amounts.paymentTotal), paise(amounts.paymentReceived + amounts.paymentCoupon + amounts.credits));
  expectEqual(issues, "Previous balance due", paise(amounts.previousBalanceDue), paise(amounts.previousBalance + amounts.paymentTotal));
  expectEqual(issues, "Net balance", paise(amounts.netBalance), paise(amounts.totalCurrentCharges + amounts.previousBalanceDue));
  expectEqual(issues, "Amount payable", paise(amounts.totalPayable), paise(Math.max(0, amounts.netBalance)));
  expectEqual(issues, "Credit balance", paise(amounts.creditBalance), paise(Math.max(0, -amounts.netBalance)));
  expectEqual(issues, "Net rental", paise(amounts.netRental), paise(amounts.rentalBeforeTax - amounts.discountBeforeTax));
  expectEqual(issues, "Late fee including GST", paise(amounts.lateFeeWithGst), paise(amounts.lateFee + amounts.lateFeeGst));
  expectEqual(issues, "Amount after due date", paise(amounts.amountAfterDueDate), paise(amounts.totalPayable + amounts.lateFeeWithGst));
  expectEqual(issues, "Last bill amount", paise(amounts.previousBalance), paise(amounts.rentalAmount));
  expectEqual(issues, "Last payment", paise(amounts.paymentReceived), -paise(amounts.rentalAmount));
  if (invoice.historyRows.length > 1) issues.push("Only the immediately previous billing month may be printed.");

  expectEqual(issues, "Invoice number", identifiers.invoiceNumber, source.invoiceNumber.trim());
  expectEqual(issues, "Account number", identifiers.accountNumber, source.accountNumber.trim());
  expectEqual(issues, "Wi-Fi ID", identifiers.wifiId, source.wifiId.trim());
  expectEqual(issues, "Fixedline number", identifiers.fixedlineNumber, source.fixedlineNumber.trim());
  expectEqual(issues, "Bill month", identifiers.billMonth, source.billMonth);
  expectEqual(issues, "Bill date", identifiers.billDate, source.billDate);
  expectEqual(issues, "Due date", identifiers.dueDate, source.dueDate);
  expectEqual(issues, "Bill period start", identifiers.periodStart, source.periodStart);
  expectEqual(issues, "Bill period end", identifiers.periodEnd, source.periodEnd);
  expectEqual(issues, "Payment reference", identifiers.paymentReference, identifiers.invoiceNumber);
  expectEqual(issues, "Plan name", plan.displayName, source.planDisplayName.trim());
  expectEqual(issues, "HSN / SAC", plan.hsnSacCode, source.hsnSacCode.trim());
  if (!/^\d{6}$/.test(plan.hsnSacCode)) issues.push("HSN / SAC must contain exactly 6 digits.");
  if ([identifiers.billDate, identifiers.dueDate, identifiers.periodStart, identifiers.periodEnd]
    .some((value) => formatBillDate(value) === "—")) {
    issues.push("Invoice dates must be valid calendar dates.");
  }
  if (identifiers.dueDate < identifiers.billDate || identifiers.periodEnd < identifiers.periodStart) {
    issues.push("Invoice date order is invalid.");
  }

  try {
    const decodedBarcode = decodeRenderedCode128(artifacts.barcodeModules);
    expectEqual(issues, "Barcode", decodedBarcode, invoice.barcodeValue);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Barcode validation failed.");
  }

  if (!artifacts.decodedQrPayload) {
    issues.push("The generated payment QR could not be decoded.");
  } else {
    expectEqual(issues, "Decoded QR", artifacts.decodedQrPayload, artifacts.qrPayload);
    try {
      const { organization, parameters, metadata } = parseWifiPaymentQrPayload(artifacts.decodedQrPayload);
      expectEqual(issues, "QR organization", organization, "000000");
      expectEqual(issues, "QR payment reference", parameters.get("tr") || "", identifiers.paymentReference);
      expectEqual(issues, "QR amount", parameters.get("am") || "", formatPlainAmount(amounts.totalPayable));
      expectEqual(issues, "QR minimum amount", parameters.get("mam") || "", formatPlainAmount(amounts.totalPayable));
      expectEqual(issues, "QR invoice number", metadata.InvNo || "", identifiers.invoiceNumber);
      expectEqual(issues, "QR account number", metadata.AccountNo || "", identifiers.accountNumber);
      expectEqual(issues, "QR metadata payment reference", metadata.PaymentReference || "", identifiers.paymentReference);
      expectEqual(issues, "QR bill date", metadata.InvoiceBilldate || "", formatBillDate(identifiers.billDate));
      expectEqual(issues, "QR HSN / SAC", metadata["HSN/SACCode"] || "", plan.hsnSacCode);
      expectEqual(issues, "QR seller GST", metadata.SellerGST || "", invoice.companyProfile.gstin);
      expectEqual(issues, "QR GST total", metadata.Tot_GST || "", formatPlainAmount(amounts.gstTotal));
      expectEqual(issues, "QR CGST", metadata.CGST || "", formatPlainAmount(amounts.cgst));
      expectEqual(issues, "QR SGST", metadata.SGST || "", formatPlainAmount(amounts.sgst));
      expectEqual(issues, "QR IGST", metadata.IGST || "", formatPlainAmount(amounts.igst));
      expectEqual(issues, "QR invoice total", metadata.TotalInvAmt || "", formatPlainAmount(amounts.totalCurrentCharges));
    } catch (error) {
      issues.push(error instanceof Error ? error.message : "QR metadata validation failed.");
    }
  }
  return [...new Set(issues)];
}

export function assertWifiInvoiceReadyForExport(invoice: WifiInvoice, artifacts: WifiExportArtifacts): void {
  const issues = validateWifiInvoiceForExport(invoice, artifacts);
  if (issues.length) throw new Error(`PDF generation blocked: ${issues.join(" ")}`);
}
