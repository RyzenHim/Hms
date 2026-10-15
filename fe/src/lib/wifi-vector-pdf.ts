import type { jsPDF as JsPDF } from "jspdf";
import type { WifiInvoice } from "../types/wifi-bill.ts";
import { encodeCode128B } from "./code128.ts";
import { WIFI_BILL_LABELS } from "./wifi-bill-copy.ts";
import {
  amountInWords,
  formatBillDate,
  formatBillMonth,
  formatMoney,
} from "./wifi-bill.ts";

export interface WifiVectorPdfAssets {
  logoDataUrl?: string;
  detailLogoDataUrl?: string;
  paymentLogoDataUrl?: string;
  signatureDataUrl?: string;
  qrDataUrl?: string;
  pageTwoBannerDataUrl?: string;
  paymentLink?: string;
}

type PdfAlignment = "left" | "center" | "right";
type Rgb = readonly [number, number, number];

interface PdfCell {
  text: string;
  align?: PdfAlignment;
  bold?: boolean;
  color?: Rgb;
}

interface PdfTableColumn {
  width: number;
  align?: PdfAlignment;
}

interface PdfTableRow {
  cells: readonly (string | PdfCell)[];
  kind?: "normal" | "total" | "grand";
}

interface PdfTableOptions {
  x: number;
  y: number;
  width: number;
  columns: readonly PdfTableColumn[];
  header?: readonly (string | PdfCell)[];
  rows: readonly PdfTableRow[];
  fontSize?: number;
  headerFontSize?: number;
  minRowHeight?: number;
  paddingX?: number;
  paddingY?: number;
  grid?: boolean;
  headerFill?: Rgb;
  headerText?: Rgb;
  lineColor?: Rgb;
}

const PAGE_WIDTH = 210;
const MARGIN_X = 10;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const FOOTER_Y = 290;
const FONT_NAME = "Geist";
const FONT_FILE_NAME = "Geist-Regular.ttf";
const FONT_URL = "/wifi/Geist-Regular.ttf";

const BLACK: Rgb = [17, 17, 17];
const WHITE: Rgb = [255, 255, 255];
const RED: Rgb = [237, 32, 40];
const GREY: Rgb = [102, 102, 102];
const MID_GREY: Rgb = [150, 150, 150];
const LIGHT_GREY: Rgb = [245, 245, 245];
const PALE_RED: Rgb = [255, 244, 244];
const LINK_BLUE: Rgb = [22, 135, 232];

let fontBase64Promise: Promise<string> | null = null;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function loadFontBase64(): Promise<string> {
  if (!fontBase64Promise) {
    fontBase64Promise = fetch(FONT_URL)
      .then(async (response) => {
        if (!response.ok) throw new Error(`PDF font request failed with status ${response.status}.`);
        return bytesToBase64(new Uint8Array(await response.arrayBuffer()));
      })
      .catch((error: unknown) => {
        fontBase64Promise = null;
        throw error;
      });
  }
  return fontBase64Promise;
}

async function registerPdfFont(pdf: JsPDF): Promise<void> {
  let base64: string;
  try {
    base64 = await loadFontBase64();
  } catch (error) {
    throw new Error(
      `Unable to load ${FONT_URL}; the selectable PDF needs this Unicode font for Indian currency.`,
      { cause: error },
    );
  }
  pdf.addFileToVFS(FONT_FILE_NAME, base64);
  pdf.addFont(FONT_FILE_NAME, FONT_NAME, "normal");
  // The supplied font has one weight. Registering it for bold keeps every
  // glyph selectable while allowing a consistent typographic hierarchy.
  pdf.addFont(FONT_FILE_NAME, FONT_NAME, "bold");
  pdf.setFont(FONT_NAME, "normal");
}

function setTextStyle(
  pdf: JsPDF,
  size: number,
  bold = false,
  color: Rgb = BLACK,
): void {
  pdf.setFont(FONT_NAME, bold ? "bold" : "normal");
  pdf.setFontSize(size);
  pdf.setTextColor(color[0], color[1], color[2]);
}

function setDrawColor(pdf: JsPDF, color: Rgb): void {
  pdf.setDrawColor(color[0], color[1], color[2]);
}

function setFillColor(pdf: JsPDF, color: Rgb): void {
  pdf.setFillColor(color[0], color[1], color[2]);
}

function normalizedCell(value: string | PdfCell, defaultAlign: PdfAlignment): PdfCell {
  return typeof value === "string"
    ? { text: value, align: defaultAlign }
    : { ...value, align: value.align || defaultAlign };
}

function wrappedLines(pdf: JsPDF, text: string, width: number): string[] {
  if (!text) return [""];
  const result = pdf.splitTextToSize(text, Math.max(1, width));
  return Array.isArray(result) ? result.map(String) : [String(result)];
}

function drawTable(pdf: JsPDF, options: PdfTableOptions): number {
  const {
    x,
    y,
    width,
    columns,
    rows,
    header,
    grid = false,
    fontSize = 7.5,
    headerFontSize = fontSize,
    minRowHeight = 6,
    paddingX = 1.5,
    paddingY = 1.25,
    headerFill = LIGHT_GREY,
    headerText = BLACK,
    lineColor = MID_GREY,
  } = options;
  const widthTotal = columns.reduce((sum, column) => sum + column.width, 0) || 1;
  const widths = columns.map((column) => (column.width / widthTotal) * width);
  let cursorY = y;

  const drawRow = (
    values: readonly (string | PdfCell)[],
    rowKind: PdfTableRow["kind"] | "header",
  ) => {
    const isHeader = rowKind === "header";
    const cells = columns.map((column, index) =>
      normalizedCell(values[index] || "", column.align || "left"),
    );
    const size = isHeader ? headerFontSize : fontSize;
    const lineHeight = size * 0.42;
    const lines = cells.map((cell, index) => {
      setTextStyle(pdf, size, isHeader || cell.bold, cell.color || (isHeader ? headerText : BLACK));
      return wrappedLines(pdf, cell.text, widths[index] - paddingX * 2);
    });
    const rowHeight = Math.max(
      minRowHeight,
      ...lines.map((value) => value.length * lineHeight + paddingY * 2),
    );

    if (isHeader) {
      setFillColor(pdf, headerFill);
      pdf.rect(x, cursorY, width, rowHeight, "F");
    } else if (rowKind === "grand") {
      setFillColor(pdf, PALE_RED);
      pdf.rect(x, cursorY, width, rowHeight, "F");
    }

    setDrawColor(pdf, rowKind === "grand" ? RED : lineColor);
    pdf.setLineWidth(rowKind === "grand" ? 0.35 : 0.16);
    if (grid) {
      pdf.rect(x, cursorY, width, rowHeight);
    } else {
      pdf.line(x, cursorY + rowHeight, x + width, cursorY + rowHeight);
      if (rowKind === "total" || rowKind === "grand") {
        pdf.line(x, cursorY, x + width, cursorY);
      }
    }

    let cellX = x;
    for (let index = 0; index < columns.length; index += 1) {
      if (grid && index > 0) pdf.line(cellX, cursorY, cellX, cursorY + rowHeight);
      const cell = cells[index];
      setTextStyle(
        pdf,
        size,
        isHeader || cell.bold || rowKind === "total" || rowKind === "grand",
        cell.color || (isHeader ? headerText : BLACK),
      );
      const align = cell.align || "left";
      const textX = align === "right"
        ? cellX + widths[index] - paddingX
        : align === "center"
          ? cellX + widths[index] / 2
          : cellX + paddingX;
      const textY = cursorY + paddingY + size * 0.35;
      pdf.text(lines[index], textX, textY, {
        align,
        baseline: "top",
        lineHeightFactor: 1.18,
      });
      cellX += widths[index];
    }
    cursorY += rowHeight;
  };

  if (header) drawRow(header, "header");
  for (const row of rows) drawRow(row.cells, row.kind || "normal");
  return cursorY;
}

function drawSectionHeader(
  pdf: JsPDF,
  y: number,
  title: string,
  trailing = "",
  x = MARGIN_X,
  width = CONTENT_WIDTH,
): number {
  const height = 8;
  setFillColor(pdf, BLACK);
  pdf.rect(x, y, width, height, "F");
  setTextStyle(pdf, 9.5, true, WHITE);
  pdf.text(title, x + 3, y + 5.25);
  if (trailing) pdf.text(trailing, x + width - 3, y + 5.25, { align: "right" });
  return y + height;
}

function imageFormat(source: string): "PNG" | "JPEG" | "WEBP" {
  const match = /^data:image\/(png|jpe?g|webp)/i.exec(source);
  if (match?.[1].toLowerCase() === "png") return "PNG";
  if (match?.[1].toLowerCase() === "webp") return "WEBP";
  return "JPEG";
}

function addImageSafe(
  pdf: JsPDF,
  source: string | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  if (!source) return false;
  try {
    pdf.addImage(source, imageFormat(source), x, y, width, height, undefined, "FAST");
    return true;
  } catch {
    return false;
  }
}

function drawHeader(
  pdf: JsPDF,
  title: string,
  companyName: string,
  logoDataUrl: string | undefined,
  options: { detail?: boolean } = {},
): void {
  const detail = Boolean(options.detail);
  setTextStyle(pdf, detail ? 11.5 : 14, true, RED);
  pdf.text(title, MARGIN_X, detail ? 16 : 17);
  const logoWidth = detail ? 24 : 31;
  const logoHeight = detail ? 9 : 14;
  const logoX = PAGE_WIDTH - MARGIN_X - logoWidth;
  const logoY = detail ? 7 : 6;
  if (!addImageSafe(pdf, logoDataUrl, logoX, logoY, logoWidth, logoHeight)) {
    setTextStyle(pdf, detail ? 9 : 12, true, RED);
    pdf.text(companyName || "Service provider", PAGE_WIDTH - MARGIN_X, detail ? 14 : 16, {
      align: "right",
      maxWidth: 66,
    });
  }
}

function drawFooter(pdf: JsPDF, page: number, invoiceNumber: string): void {
  setDrawColor(pdf, MID_GREY);
  pdf.setLineWidth(0.15);
  pdf.line(MARGIN_X, FOOTER_Y - 4, PAGE_WIDTH - MARGIN_X, FOOTER_Y - 4);
  setTextStyle(pdf, 6.5, false, GREY);
  pdf.text(invoiceNumber ? `Invoice ${invoiceNumber}` : "", MARGIN_X, FOOTER_Y);
  pdf.text(`Page ${page} of 4`, PAGE_WIDTH - MARGIN_X, FOOTER_Y, { align: "right" });
}

function drawCustomer(
  pdf: JsPDF,
  invoice: WifiInvoice,
  x: number,
  y: number,
  width: number,
  showGstin = false,
): number {
  const { customer } = invoice;
  let cursorY = y;
  setTextStyle(pdf, 8.3, true);
  pdf.text(customer.name || "Customer name", x, cursorY);
  cursorY += 4;
  setTextStyle(pdf, 7.4);
  for (const addressLine of customer.addressLines.length ? customer.addressLines : ["Customer address"]) {
    const lines = wrappedLines(pdf, addressLine, width);
    pdf.text(lines, x, cursorY, { lineHeightFactor: 1.2 });
    cursorY += lines.length * 3.4;
  }
  pdf.text(`Email address: ${customer.email || "-"}`, x, cursorY);
  cursorY += 3.5;
  pdf.text(`Registered telephone number: ${customer.phone || "-"}`, x, cursorY);
  cursorY += 3.5;
  if (showGstin && customer.gstin) {
    pdf.text(`GSTIN: ${customer.gstin}`, x, cursorY);
    cursorY += 3.5;
  }
  return cursorY;
}

function drawKeyValue(
  pdf: JsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  options: { size?: number; valueWidth?: number } = {},
): void {
  const size = options.size || 7.3;
  const valueWidth = options.valueWidth || width * 0.62;
  setTextStyle(pdf, size);
  pdf.text(label, x, y, { maxWidth: width - valueWidth - 2 });
  setTextStyle(pdf, size, true);
  pdf.text(value || "-", x + width, y, { align: "right", maxWidth: valueWidth });
}

function formatDebit(amount: number): string {
  return amount === 0 ? formatMoney(0) : formatMoney(amount > 0 ? -amount : amount);
}

function optionalMoney(paise: number | null, debit = false): string {
  if (paise === null) return "-";
  const amount = paise / 100;
  return debit && amount > 0 ? formatMoney(-amount) : formatMoney(amount);
}

function priorBillMonth(value: string, monthsBack: number): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return "-";
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 - monthsBack, 1));
  return formatBillMonth(date.toISOString().slice(0, 7));
}

function drawBarcode(
  pdf: JsPDF,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const modules = encodeCode128B(value).modules;
  const moduleWidth = width / modules.length;
  setFillColor(pdf, BLACK);
  for (let index = 0; index < modules.length;) {
    if (modules[index] === "0") {
      index += 1;
      continue;
    }
    const start = index;
    while (index < modules.length && modules[index] === "1") index += 1;
    pdf.rect(x + start * moduleWidth, y, (index - start) * moduleWidth, height, "F");
  }
}

function isSupportedLink(value: string): boolean {
  try {
    return ["https:", "http:", "upi:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function drawQr(
  pdf: JsPDF,
  assets: WifiVectorPdfAssets,
  invoice: WifiInvoice,
  x: number,
  y: number,
  size: number,
  detailed = false,
): number {
  if (detailed) {
    setTextStyle(pdf, 6.6, true);
    pdf.text("BHIM UPI", x + size / 2, y, { align: "center" });
    setTextStyle(pdf, 5.7);
    pdf.text(`Send payment to ${invoice.payment.upiId || "-"}`, x + size / 2, y + 3.2, {
      align: "center",
      maxWidth: size + 12,
    });
    y += 5;
  }
  const imageAdded = addImageSafe(pdf, assets.qrDataUrl, x, y, size, size);
  if (assets.qrDataUrl && !imageAdded) {
    throw new Error("The payment QR image could not be embedded in the selectable PDF.");
  }
  if (!imageAdded) {
    setDrawColor(pdf, MID_GREY);
    pdf.rect(x, y, size, size);
    setTextStyle(pdf, 6.5, false, GREY);
    pdf.text("Payment QR", x + size / 2, y + size / 2, { align: "center" });
  }
  if (assets.paymentLink && isSupportedLink(assets.paymentLink)) {
    pdf.link(x, y, size, size, { url: assets.paymentLink });
  }
  let cursorY = y + size + 3;
  setTextStyle(pdf, 6.2, true);
  pdf.text("Scan & pay via any UPI Apps", x + size / 2, cursorY, { align: "center" });
  cursorY += 3;
  if (assets.paymentLogoDataUrl) {
    setTextStyle(pdf, 4.8, true);
    pdf.text("Powered by", x + size * 0.17, cursorY + 2, { align: "center" });
    addImageSafe(pdf, assets.paymentLogoDataUrl, x + size * 0.31, cursorY, size * 0.68, 4.2);
    cursorY += 5;
  } else {
    setTextStyle(pdf, 5.5, false, GREY);
    pdf.text(`${formatMoney(invoice.calculations.totalPayable)} prefilled`, x + size / 2, cursorY, {
      align: "center",
    });
    cursorY += 3;
  }
  return cursorY;
}

function drawPageOne(pdf: JsPDF, invoice: WifiInvoice, assets: WifiVectorPdfAssets): void {
  const { calculations: totals, companyProfile, identifiers, plan, source } = invoice;
  const period = `${formatBillDate(identifiers.periodStart)} to ${formatBillDate(identifiers.periodEnd)}`;
  drawHeader(pdf, "POSTPAID Wi-Fi MONTHLY STATEMENT", companyProfile.legalName, assets.logoDataUrl);

  drawCustomer(pdf, invoice, MARGIN_X, 28, 87);
  setTextStyle(pdf, 7.4, true);
  pdf.text(`Your plan: ${plan.displayName || "Wi-Fi monthly plan"}`, MARGIN_X, 51, { maxWidth: 87 });
  setTextStyle(pdf, 7.2);
  pdf.text(`Number of connections: ${plan.connections || "1"}`, MARGIN_X, 56);
  pdf.text(`Statement date: ${formatBillDate(identifiers.billDate)}`, MARGIN_X, 60);
  pdf.text(`Statement period: ${period}`, MARGIN_X, 64);

  const paymentX = 108;
  const paymentY = 25;
  const paymentWidth = 92;
  const paymentHeight = 45;
  setDrawColor(pdf, GREY);
  pdf.setLineWidth(0.2);
  pdf.rect(paymentX, paymentY, paymentWidth, paymentHeight);
  pdf.line(paymentX, paymentY + 13, paymentX + paymentWidth, paymentY + 13);
  setTextStyle(pdf, 6.8, true);
  pdf.text(WIFI_BILL_LABELS.amountPayable, paymentX + 3, paymentY + 5);
  pdf.text(WIFI_BILL_LABELS.dueDate, paymentX + paymentWidth - 3, paymentY + 5, { align: "right" });
  setTextStyle(pdf, 12.5, true);
  pdf.text(formatMoney(totals.totalPayable), paymentX + 3, paymentY + 11);
  setTextStyle(pdf, 10, true);
  pdf.text(formatBillDate(identifiers.dueDate), paymentX + paymentWidth - 3, paymentY + 11, { align: "right" });
  setTextStyle(pdf, 7, true);
  pdf.text(companyProfile.assets.paymentAppName ? "Pay via" : "Pay securely", paymentX + 25, paymentY + 23, { align: "center" });
  pdf.text(companyProfile.assets.paymentAppName || "using UPI", paymentX + 25, paymentY + 27, { align: "center", maxWidth: 47 });
  if (companyProfile.assets.paymentPortalUrl && isSupportedLink(companyProfile.assets.paymentPortalUrl)) {
    const portalLabel = companyProfile.assets.paymentPortalUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    setTextStyle(pdf, 6.3, true, LINK_BLUE);
    pdf.text(portalLabel, paymentX + 25, paymentY + 32, { align: "center", maxWidth: 47 });
    pdf.link(paymentX + 2, paymentY + 29, 46, 5, { url: companyProfile.assets.paymentPortalUrl });
  }
  if (assets.qrDataUrl) drawQr(pdf, assets, invoice, paymentX + 61, paymentY + 15, 24);

  const balanceY = 75;
  const balanceHeight = 18;
  setFillColor(pdf, BLACK);
  pdf.rect(MARGIN_X, balanceY, CONTENT_WIDTH, balanceHeight, "F");
  const balances = [
    ["Last bill amount", optionalMoney(invoice.statementRow.previousDues)],
    ["Payment made", optionalMoney(invoice.statementRow.payments, true)],
    ["Payment coupon", formatDebit(totals.paymentCoupon)],
    ["Credits", formatDebit(totals.credits)],
    [WIFI_BILL_LABELS.currentCharges, formatMoney(totals.totalCurrentCharges)],
    [WIFI_BILL_LABELS.amountPayable, formatMoney(totals.totalPayable)],
    [WIFI_BILL_LABELS.amountAfterDueDate, formatMoney(totals.amountAfterDueDate)],
  ] as const;
  const balanceWidth = CONTENT_WIDTH / balances.length;
  balances.forEach(([label, value], index) => {
    const cellX = MARGIN_X + index * balanceWidth;
    setTextStyle(pdf, 5.6, true, WHITE);
    pdf.text(wrappedLines(pdf, label, balanceWidth - 3), cellX + 1.5, balanceY + 3, {
      baseline: "top",
      lineHeightFactor: 1.1,
    });
    setTextStyle(pdf, 5.8, true, WHITE);
    pdf.text(value, cellX + balanceWidth - 1.5, balanceY + 15.5, { align: "right" });
  });

  let y = drawSectionHeader(pdf, 98, WIFI_BILL_LABELS.chargesSummary);
  y = drawTable(pdf, {
    x: MARGIN_X,
    y,
    width: CONTENT_WIDTH,
    columns: [
      { width: 32 },
      { width: 14, align: "center" },
      { width: 18, align: "right" },
      { width: 18, align: "right" },
      { width: 18, align: "right" },
    ],
    header: ["Services", "No. of connections", "Plan charges", "Other charges", "Total"],
    fontSize: 7,
    headerFontSize: 6.8,
    minRowHeight: 5.7,
    paddingY: 1.05,
    rows: [
      { cells: [`Wi-Fi${identifiers.wifiId ? ` - ${identifiers.wifiId}` : ""}`, plan.connections || "1", formatMoney(totals.rentalBeforeTax), formatMoney(totals.otherChargesBeforeTax), formatMoney(totals.grossChargesBeforeTax)] },
      { cells: ["Plan discount", "-", formatDebit(totals.discountBeforeTax), "-", formatDebit(totals.discountBeforeTax)] },
      { cells: ["Revised charges", "-", "-", "-", "-"] },
      { cells: ["Taxes (GST)", "-", "-", formatMoney(totals.gstTotal), formatMoney(totals.gstTotal)] },
      { cells: [{ text: WIFI_BILL_LABELS.currentCharges, bold: true }, "", "", "", formatMoney(totals.totalCurrentCharges)], kind: "total" },
      { cells: [{ text: "Last bill amount", bold: true }, "", "", "", optionalMoney(invoice.statementRow.previousDues)] },
      { cells: [{ text: "Last payment made", bold: true }, "", "", "", optionalMoney(invoice.statementRow.payments, true)] },
      { cells: [{ text: WIFI_BILL_LABELS.amountPayable, bold: true }, "", "", "", { text: formatMoney(totals.totalPayable), bold: true }], kind: "grand" },
    ],
  });
  setTextStyle(pdf, 7, true);
  pdf.text(`Total: ${amountInWords(totals.totalPayable)}`, MARGIN_X + 1.5, y + 5);

  y = drawSectionHeader(pdf, y + 9, "Bills & payments summary");
  drawTable(pdf, {
    x: MARGIN_X,
    y,
    width: CONTENT_WIDTH,
    columns: [
      { width: 16 },
      { width: 14, align: "right" },
      { width: 14, align: "right" },
      { width: 14, align: "right" },
      { width: 14, align: "right" },
      { width: 14, align: "right" },
      { width: 14, align: "right" },
    ],
    header: ["Month", "Previous dues (A)", "Payments (B)", "Payment coupon (C)", "Credits (D)", "Current charges (E)", "Amount payable"],
    rows: [
      {
        cells: [
          formatBillMonth(identifiers.billMonth),
          optionalMoney(invoice.statementRow.previousDues),
          optionalMoney(invoice.statementRow.payments, true),
          optionalMoney(invoice.statementRow.paymentCoupon, true),
          optionalMoney(invoice.statementRow.credits, true),
          optionalMoney(invoice.statementRow.currentCharges),
          optionalMoney(invoice.statementRow.payable),
        ],
      },
      ...invoice.historyRows.map((row) => ({
        cells: [
          priorBillMonth(identifiers.billMonth, row.offset),
          optionalMoney(row.previousDues),
          optionalMoney(row.payments, true),
          optionalMoney(row.paymentCoupon, true),
          optionalMoney(row.credits, true),
          optionalMoney(row.currentCharges),
          optionalMoney(row.payable),
        ],
      })),
    ],
    fontSize: 6,
    headerFontSize: 5.8,
    minRowHeight: 7,
    paddingX: 0.8,
    paddingY: 1,
    grid: true,
    headerFill: LIGHT_GREY,
  });

  drawFooter(pdf, 1, identifiers.invoiceNumber);
  void source;
}

function drawPageTwo(pdf: JsPDF, invoice: WifiInvoice, assets: WifiVectorPdfAssets): void {
  const { calculations: totals, companyProfile, identifiers, source } = invoice;
  drawHeader(pdf, "POSTPAID Wi-Fi MONTHLY STATEMENT", companyProfile.legalName, assets.logoDataUrl);

  setTextStyle(pdf, 10, true, RED);
  pdf.text(WIFI_BILL_LABELS.paymentsAndRefunds, MARGIN_X, 29);
  setTextStyle(pdf, 7.3, true);
  pdf.text("Last payment against this account", MARGIN_X, 34);

  const paymentRows: PdfTableRow[] = [{
    cells: [
      totals.paymentReceived !== 0 ? source.paymentMethod || "Payment received" : "No payment recorded",
      source.paymentDate ? formatBillDate(source.paymentDate) : "-",
      formatDebit(totals.totalPayable),
    ],
  }];
  paymentRows.push({ cells: [WIFI_BILL_LABELS.total, "", formatDebit(totals.totalPayable)], kind: "total" });
  let y = drawTable(pdf, {
    x: MARGIN_X,
    y: 37,
    width: CONTENT_WIDTH,
    columns: [{ width: 54 }, { width: 22 }, { width: 24, align: "right" }],
    header: ["Description", "Date", "Amount paid"],
    rows: paymentRows,
    fontSize: 7.4,
    headerFontSize: 7.2,
    minRowHeight: 7.5,
  });

  y += 6;
  if (assets.pageTwoBannerDataUrl && addImageSafe(pdf, assets.pageTwoBannerDataUrl, MARGIN_X, y, CONTENT_WIDTH, 55.7)) {
    y += 61;
  } else {
    setFillColor(pdf, PALE_RED);
    setDrawColor(pdf, RED);
    pdf.rect(MARGIN_X, y, CONTENT_WIDTH, 38, "FD");
    addImageSafe(pdf, assets.logoDataUrl, MARGIN_X + 8, y + 9, 31, 14);
    setTextStyle(pdf, 13, true, RED);
    pdf.text("Manage your connection online", MARGIN_X + 48, y + 14);
    setTextStyle(pdf, 8);
    pdf.text(
      "View bills, make payments, manage your plan and get support through your operator's app or website.",
      MARGIN_X + 48,
      y + 21,
      { maxWidth: 130 },
    );
    y += 44;
  }

  setDrawColor(pdf, RED);
  pdf.setLineDashPattern([1.2, 1.2], 0);
  pdf.line(MARGIN_X, 277, PAGE_WIDTH - MARGIN_X, 277);
  pdf.setLineDashPattern([], 0);
  setTextStyle(pdf, 6.8);
  pdf.text(
    "This is only a summary statement. Input tax credit will not be available on the basis of this document.",
    MARGIN_X,
    282,
  );
  drawFooter(pdf, 2, identifiers.invoiceNumber);
}

function drawPageThree(pdf: JsPDF, invoice: WifiInvoice, assets: WifiVectorPdfAssets): void {
  const { calculations: totals, companyProfile, customer, identifiers, plan, source } = invoice;
  const period = `${formatBillDate(identifiers.periodStart)} to ${formatBillDate(identifiers.periodEnd)}`;
  drawHeader(pdf, "FIXEDLINE AND Wi-Fi SERVICES", companyProfile.legalName, assets.logoDataUrl);
  setTextStyle(pdf, 6.7, false, GREY);
  pdf.text(`Original copy for recipient provided by ${companyProfile.legalName || "Service provider"} - Tax Invoice`, MARGIN_X, 21);
  setTextStyle(pdf, 7.4);
  pdf.text(`${identifiers.fixedlineNumber ? `Fixedline number: ${identifiers.fixedlineNumber} / ` : ""}Wi-Fi ID: ${identifiers.wifiId || "-"}`, MARGIN_X, 25);

  let y = drawSectionHeader(pdf, 29, WIFI_BILL_LABELS.billingAddress);
  const billingTop = y;
  const billingHeight = 39;
  setDrawColor(pdf, GREY);
  pdf.rect(MARGIN_X, billingTop, CONTENT_WIDTH, billingHeight);
  pdf.line(105, billingTop, 105, billingTop + billingHeight);
  drawCustomer(pdf, invoice, MARGIN_X + 4, billingTop + 6, 87);
  const barcodeX = 112;
  const barcodeWidth = 78;
  drawBarcode(pdf, invoice.barcodeValue, barcodeX, billingTop + 7, barcodeWidth, 11);
  setTextStyle(pdf, 6.6);
  pdf.text(identifiers.invoiceNumber || "-", barcodeX, billingTop + 22);
  pdf.text(identifiers.accountNumber || "-", barcodeX + barcodeWidth, billingTop + 22, { align: "right" });
  setTextStyle(pdf, 6.7);
  pdf.text(`Ship To State Code : ${customer.stateCode || "-"}`, barcodeX, billingTop + 30);
  pdf.text(`Place of Supply : ${customer.state || "-"}`, barcodeX + barcodeWidth, billingTop + 30, { align: "right" });

  y = drawSectionHeader(pdf, billingTop + billingHeight + 5, WIFI_BILL_LABELS.account);
  const accountTop = y;
  const accountHeight = 31;
  setDrawColor(pdf, GREY);
  pdf.rect(MARGIN_X, accountTop, CONTENT_WIDTH, accountHeight);
  pdf.line(105, accountTop, 105, accountTop + accountHeight);
  [
    ["Account No", identifiers.accountNumber],
    ["GST No", customer.gstin || "Not provided"],
    [WIFI_BILL_LABELS.billPeriod, period],
  ].forEach(([label, value], index) => drawKeyValue(pdf, label, value, MARGIN_X + 4, accountTop + 7 + index * 8, 87, { size: 7.1 }));
  [
    ["Bill No", identifiers.invoiceNumber],
    [WIFI_BILL_LABELS.billDate, formatBillDate(identifiers.billDate)],
    [WIFI_BILL_LABELS.dueDate, formatBillDate(identifiers.dueDate)],
    ["Credit limit", formatMoney(totals.creditLimit)],
    ["Security deposit", formatMoney(totals.securityDeposit)],
  ].forEach(([label, value], index) => drawKeyValue(pdf, label, value, 109, accountTop + 5 + index * 5.6, 87, { size: 6.8 }));

  y = drawSectionHeader(pdf, accountTop + accountHeight + 5, WIFI_BILL_LABELS.thisMonthsCharges, "Charges (₹)");
  const chargeRows: PdfTableRow[] = [
    { cells: [{ text: WIFI_BILL_LABELS.rentalCharges, bold: true }, formatMoney(totals.netRental)] },
  ];
  if (totals.otherChargesBeforeTax > 0) chargeRows.push({ cells: ["Other charges", formatMoney(totals.otherChargesBeforeTax)] });
  chargeRows.push(
    { cells: ["Taxes", formatMoney(totals.gstTotal)] },
    { cells: [WIFI_BILL_LABELS.currentCharges, formatMoney(totals.totalCurrentCharges)], kind: "total" },
  );
  y = drawTable(pdf, {
    x: MARGIN_X,
    y,
    width: CONTENT_WIDTH,
    columns: [{ width: 78 }, { width: 22, align: "right" }],
    rows: chargeRows,
    fontSize: 7.4,
    minRowHeight: 6.8,
  });
  setTextStyle(pdf, 7, true);
  pdf.text(`Total: ${amountInWords(totals.totalCurrentCharges)}`, MARGIN_X + 1.5, y + 5);
  setTextStyle(pdf, 6.6, false, GREY);
  pdf.text("Detailed breakup of these charges can be found on the next page.", MARGIN_X, y + 10);

  const issuerY = Math.max(198, y + 23);
  setTextStyle(pdf, 7.2, true);
  pdf.text(`For ${companyProfile.legalName || "Service provider"}`, MARGIN_X, issuerY);
  if (assets.signatureDataUrl) {
    addImageSafe(pdf, assets.signatureDataUrl, MARGIN_X, issuerY + 4, 38, 17);
  } else {
    setTextStyle(pdf, 10, false, [48, 64, 100]);
    pdf.text("Authorised Signatory", MARGIN_X, issuerY + 16);
    setDrawColor(pdf, MID_GREY);
    pdf.line(MARGIN_X, issuerY + 18, MARGIN_X + 43, issuerY + 18);
  }
  setTextStyle(pdf, 7, true);
  pdf.text(source.issuerSignatoryName || "Authorised signatory", MARGIN_X, issuerY + 26);
  setTextStyle(pdf, 6.8);
  pdf.text(source.issuerSignatoryTitle || "Authorised representative", MARGIN_X, issuerY + 31);
  if (assets.qrDataUrl || assets.paymentLink) drawQr(pdf, assets, invoice, 164, issuerY - 3, 30, true);

  drawFooter(pdf, 3, identifiers.invoiceNumber);
  void plan;
}

function tariffValues(value: string): [string, string, string, string] {
  if (!value.trim()) return ["0.00/60", "0/60", "0/60", "See www.airtel.in"];
  const parts = value.split("|").map((part) => part.trim());
  return [
    parts[0] || "0.00/60",
    parts[1] || "0/60",
    parts[2] || "0/60",
    parts[3] || "See www.airtel.in",
  ];
}

function drawLabeledParagraph(
  pdf: JsPDF,
  label: string,
  body: string,
  x: number,
  y: number,
  width: number,
  fontSize: number,
  lineHeight: number,
): number {
  const fullText = `${label} - ${body || "-"}`;
  setTextStyle(pdf, fontSize);
  const lines = wrappedLines(pdf, fullText, width);
  pdf.text(lines, x, y, { baseline: "top", lineHeightFactor: lineHeight / (fontSize * 0.3528) });
  return y + lines.length * lineHeight;
}

function drawPageFour(pdf: JsPDF, invoice: WifiInvoice, assets: WifiVectorPdfAssets): void {
  const { calculations: totals, companyProfile, customer, identifiers, plan, source } = invoice;
  if (!addImageSafe(pdf, assets.detailLogoDataUrl || assets.logoDataUrl, MARGIN_X, 6, 24, 9)) {
    setTextStyle(pdf, 9, true, RED);
    pdf.text(companyProfile.legalName || "Service provider", MARGIN_X, 14, { maxWidth: 90 });
  }
  setTextStyle(pdf, 7.5, true);
  pdf.text(`Relationship No : ${identifiers.accountNumber || "-"}`, PAGE_WIDTH - MARGIN_X, 15, { align: "right" });
  setTextStyle(pdf, 11, true, RED);
  pdf.text("YOUR CHARGES IN DETAIL", MARGIN_X, 26);
  setDrawColor(pdf, BLACK);
  pdf.setLineWidth(0.5);
  pdf.line(MARGIN_X, 28, PAGE_WIDTH - MARGIN_X, 28);

  setTextStyle(pdf, 8.2, true, RED);
  pdf.text(WIFI_BILL_LABELS.rentalCharges, MARGIN_X, 34);
  let y = drawTable(pdf, {
    x: MARGIN_X,
    y: 36,
    width: CONTENT_WIDTH,
    columns: [
      { width: 27 },
      { width: 14 },
      { width: 14 },
      { width: 11, align: "right" },
      { width: 11, align: "right" },
      { width: 12, align: "right" },
      { width: 11, align: "right" },
    ],
    header: ["Description", "From date", "To date", "Rental", "Discount", "Net charges", "Total (₹)"],
    rows: [
      { cells: [{ text: "Plan details", bold: true, color: RED }, "", "", "", "", "", { text: formatMoney(totals.netRental), bold: true }] },
      { cells: [plan.displayName || "Wi-Fi monthly plan", formatBillDate(identifiers.periodStart), formatBillDate(identifiers.periodEnd), formatMoney(totals.rentalBeforeTax), formatMoney(totals.discountBeforeTax), formatMoney(totals.netRental), ""] },
      ...(totals.otherChargesBeforeTax > 0
        ? [{ cells: ["Other charges", "-", "-", "-", "-", formatMoney(totals.otherChargesBeforeTax), formatMoney(totals.otherChargesBeforeTax)] }]
        : []),
    ],
    fontSize: 6.2,
    headerFontSize: 5.8,
    minRowHeight: 5.5,
    paddingX: 0.8,
    paddingY: 0.8,
  });

  setTextStyle(pdf, 8.2, true, RED);
  pdf.text(WIFI_BILL_LABELS.taxDetails, MARGIN_X, y + 5);
  y = drawTable(pdf, {
    x: MARGIN_X,
    y: y + 7,
    width: CONTENT_WIDTH,
    columns: [
      { width: 9 },
      { width: 12, align: "right" },
      { width: 9, align: "right" },
      { width: 11, align: "right" },
      { width: 12, align: "right" },
      { width: 13, align: "right" },
      { width: 8, align: "right" },
      { width: 10, align: "right" },
      { width: 8, align: "right" },
      { width: 8, align: "right" },
    ],
    header: ["HSN / SAC", "Taxable value", "CGST rate", "CGST amount", "SGST / UTGST rate", "SGST / UTGST amount", "IGST rate", "IGST amount", "Total tax", "Total"],
    rows: [
      { cells: [plan.hsnSacCode || "-", formatMoney(totals.taxableAmount), `${totals.cgstRate}%`, formatMoney(totals.cgst), `${totals.sgstRate}%`, formatMoney(totals.sgst), source.taxMode === "igst" ? `${source.gstRate}%` : "0%", formatMoney(totals.igst), formatMoney(totals.gstTotal), { text: formatMoney(totals.gstTotal), bold: true }] },
      { cells: [{ text: WIFI_BILL_LABELS.currentCharges, bold: true }, "", "", "", "", "", "", "", "", formatMoney(totals.totalCurrentCharges)], kind: "total" },
    ],
    fontSize: 5.3,
    headerFontSize: 4.9,
    minRowHeight: 6.2,
    paddingX: 0.45,
    paddingY: 0.7,
  });

  setTextStyle(pdf, 8.2, true, RED);
  pdf.text(WIFI_BILL_LABELS.paymentsAndRefunds, MARGIN_X, y + 5);
  const paymentRows: PdfTableRow[] = [{
    cells: [
      totals.paymentReceived !== 0 ? source.paymentMethod || "Payment received" : "No payment recorded",
      source.paymentDate ? formatBillDate(source.paymentDate) : "-",
      formatDebit(totals.totalPayable),
      formatDebit(totals.totalPayable),
    ],
  }];
  y = drawTable(pdf, {
    x: MARGIN_X,
    y: y + 7,
    width: CONTENT_WIDTH,
    columns: [{ width: 55 }, { width: 18 }, { width: 14, align: "right" }, { width: 13, align: "right" }],
    header: ["Description", "Date", "Amount", "Total (₹)"],
    rows: paymentRows,
    fontSize: 6.1,
    headerFontSize: 5.9,
    minRowHeight: 5.5,
    paddingY: 0.8,
  });

  const tariffTop = y + 5;
  setFillColor(pdf, BLACK);
  pdf.rect(MARGIN_X, tariffTop, CONTENT_WIDTH, 6, "F");
  setTextStyle(pdf, 7, true, WHITE);
  pdf.text(`Bill plan details: ${plan.displayName || "Wi-Fi monthly plan"}`, MARGIN_X + 2, tariffTop + 4.1);
  setTextStyle(pdf, 6.2);
  pdf.text(`Rental: ${formatMoney(totals.rentalBeforeTax)}`, MARGIN_X + 2, tariffTop + 10);
  pdf.text(`Quota: ${plan.quota || "Not specified"}`, MARGIN_X + 68, tariffTop + 10);
  pdf.text(`Speed: ${plan.speed || "Not specified"}`, MARGIN_X + 133, tariffTop + 10);
  setFillColor(pdf, BLACK);
  pdf.rect(MARGIN_X, tariffTop + 13, CONTENT_WIDTH, 6, "F");
  setTextStyle(pdf, 7, true, WHITE);
  pdf.text("Tariff details", MARGIN_X + 2, tariffTop + 17.1);
  const tariffRows = [
    ["to airtel fixedline", source.tariffAirtelFixedline],
    ["to other fixedline", source.tariffOtherFixedline],
    ["to airtel mobile", source.tariffAirtelMobile],
    ["to other mobile", source.tariffOtherMobile],
    ["to fixedline CUG", source.tariffFixedlineCug],
    ["to WLL", source.tariffWll],
  ].map(([label, raw]) => {
    const [local, intra, inter, isd] = tariffValues(raw);
    return { cells: [label, local, intra, inter, isd] };
  });
  y = drawTable(pdf, {
    x: MARGIN_X,
    y: tariffTop + 19,
    width: CONTENT_WIDTH,
    columns: [{ width: 27 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 19 }],
    header: ["Voice - Call rates", "Local (Rs/sec)", "STD intra circle (Rs/sec)", "STD inter circle (Rs/sec)", "ISD (Rs/sec)"],
    rows: tariffRows,
    fontSize: 5.3,
    headerFontSize: 5,
    minRowHeight: 4.4,
    paddingX: 0.8,
    paddingY: 0.6,
    grid: true,
  });
  setTextStyle(pdf, 5.3);
  const fupLines = wrappedLines(pdf, `*${source.fupInformation || "Post unlimited quota, speed may be revised as per the Fair Usage Policy."}`, CONTENT_WIDTH - 4);
  pdf.text(fupLines, MARGIN_X + 2, y + 3, { baseline: "top", lineHeightFactor: 1.12 });
  y += fupLines.length * 2.15 + 5;

  const legalEntries: readonly (readonly [string, string])[] = [
    ["Payment modes", source.paymentInstructions || "Contact the service provider for payment instructions."],
    ["Contact information", source.contactInformation || [companyProfile.supportPhone, companyProfile.supportEmail].filter(Boolean).join(" | ") || "Contact the service provider for assistance."],
    ["Appellate desk", source.appellateInformation || "Contact the operator's appellate desk for unresolved complaints."],
    ...(!/\b1930\b/.test(source.appellateInformation) ? [["Cyber-crime fraud reporting", "Call 1930."] as const] : []),
    ["Corporate coordinator contact information", source.corporateCoordinatorInformation || "Contact the corporate support desk for business account queries."],
    ["Charges", source.chargesInformation || "Charges and late payment fees apply as disclosed by the operator and applicable law."],
    ["Address change", source.addressChangeInformation || "Contact support or visit the nearest operator store with address proof."],
    ["Other information", source.otherInformation || "Tariff, tax and service terms are subject to the operator's published terms."],
    ...(source.notes ? [["Notes", source.notes] as const] : []),
    ["Registered office", companyProfile.registeredOffice || companyProfile.address || "-"],
    ["Corporate office", companyProfile.corporateOffice || companyProfile.address || "-"],
    ["Corporate identity number", companyProfile.cin || "-"],
    ["Tax registration", `Ship To State Code: ${customer.stateCode || "-"}; GST registration no: ${companyProfile.gstin || "-"}; Category: ${companyProfile.serviceCategory || "-"}; PAN: ${companyProfile.pan || "-"}`],
    ["HSN / SAC", `${plan.hsnSacCode || "-"} - ${plan.serviceDescription || companyProfile.serviceCategory || "Telecommunication service"}`],
  ];
  const legalTop = y;
  const legalBottom = FOOTER_Y - 7;
  let legalFontSize = 5.2;
  let legalLineHeight = 2.05;
  const estimateHeight = (size: number, lineHeight: number) => {
    setTextStyle(pdf, size);
    return legalEntries.reduce((height, [label, body]) =>
      height + wrappedLines(pdf, `${label} - ${body || "-"}`, CONTENT_WIDTH - 5).length * lineHeight + 0.45, 4);
  };
  while (legalFontSize > 4.4 && estimateHeight(legalFontSize, legalLineHeight) > legalBottom - legalTop) {
    legalFontSize -= 0.2;
    legalLineHeight -= 0.07;
  }
  let legalY = legalTop + 3;
  for (const [label, body] of legalEntries) {
    legalY = drawLabeledParagraph(pdf, label, body, MARGIN_X + 2.5, legalY, CONTENT_WIDTH - 5, legalFontSize, legalLineHeight) + 0.45;
  }
  setDrawColor(pdf, RED);
  pdf.setLineWidth(0.18);
  pdf.rect(MARGIN_X, legalTop, CONTENT_WIDTH, Math.min(legalBottom, legalY + 1) - legalTop);

  drawFooter(pdf, 4, identifiers.invoiceNumber);
}

function validExportDate(value: Date): Date {
  return value instanceof Date && Number.isFinite(value.getTime()) ? value : new Date();
}

function utcPdfDate(value: Date): string {
  const part = (number: number) => String(number).padStart(2, "0");
  return `D:${value.getUTCFullYear()}${part(value.getUTCMonth() + 1)}${part(value.getUTCDate())}${part(value.getUTCHours())}${part(value.getUTCMinutes())}${part(value.getUTCSeconds())}+00'00'`;
}

/**
 * Generate four A4 pages with selectable text and vector rules, tables and
 * Code 128 bars. Only supplied artwork and QR assets remain raster images.
 */
export async function buildVectorWifiBillPdf(
  invoice: WifiInvoice,
  assets: WifiVectorPdfAssets,
  exportedAt: Date = new Date(),
): Promise<JsPDF> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
    precision: 3,
  });
  await registerPdfFont(pdf);

  const generatedAt = validExportDate(exportedAt);
  const { companyProfile, identifiers, plan } = invoice;
  pdf.setProperties({
    title: `Wi-Fi invoice ${identifiers.invoiceNumber} - ${formatBillMonth(identifiers.billMonth)}`,
    subject: `Account ${identifiers.accountNumber}; HSN / SAC ${plan.hsnSacCode}; period ${identifiers.periodStart} to ${identifiers.periodEnd}`,
    author: companyProfile.legalName,
    creator: "HMS WiFi Billing",
    keywords: `Wi-Fi, invoice, ${identifiers.invoiceNumber}, ${identifiers.accountNumber}, ${plan.hsnSacCode}`,
  });
  pdf.setCreationDate(utcPdfDate(generatedAt));
  pdf.setLanguage("en");

  drawPageOne(pdf, invoice, assets);
  pdf.addPage("a4", "portrait");
  drawPageTwo(pdf, invoice, assets);
  pdf.addPage("a4", "portrait");
  drawPageThree(pdf, invoice, assets);
  pdf.addPage("a4", "portrait");
  drawPageFour(pdf, invoice, assets);
  return pdf;
}

function findBytes(haystack: Uint8Array, needle: Uint8Array, from = 0): number {
  outer: for (let index = from; index <= haystack.length - needle.length; index += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[index + offset] !== needle[offset]) continue outer;
    }
    return index;
  }
  return -1;
}

/**
 * Replace jsPDF's library Producer value without changing any byte offsets.
 * The replacement is applied only when the existing value begins with jsPDF
 * and has exactly the same byte length as "HMS Billing".
 */
export function replaceJsPdfProducer(bytes: Uint8Array): Uint8Array {
  const output = bytes.slice();
  const encoder = new TextEncoder();
  const prefix = encoder.encode("/Producer (");
  const replacement = encoder.encode("HMS Billing");
  const start = findBytes(output, prefix);
  if (start < 0) throw new Error("The PDF Producer metadata entry is missing.");
  const valueStart = start + prefix.length;
  let valueEnd = valueStart;
  while (valueEnd < output.length && output[valueEnd] !== 0x29 && output[valueEnd] !== 0x0a && output[valueEnd] !== 0x0d) {
    valueEnd += 1;
  }
  const current = output.subarray(valueStart, valueEnd);
  const jsPdfPrefix = encoder.encode("jsPDF");
  if (current.length !== replacement.length || findBytes(current, jsPdfPrefix) !== 0) {
    throw new Error("The jsPDF Producer value cannot be replaced without changing PDF byte offsets.");
  }
  output.set(replacement, valueStart);
  return output;
}

/** Serialize the PDF and stamp the billing-system Producer safely in-place. */
export function serializeVectorWifiBillPdf(pdf: JsPDF): Uint8Array {
  return replaceJsPdfProducer(new Uint8Array(pdf.output("arraybuffer")));
}
