import Image from "next/image";
import type { ReactNode } from "react";
import {
  amountInWords,
  formatBillDate,
  formatBillMonth,
  formatMoney,
} from "@/lib/wifi-bill";
import { WIFI_BILL_LABELS } from "@/lib/wifi-bill-copy";
import { encodeCode128B } from "@/lib/code128";
import type { WifiInvoice } from "@/types/wifi-bill";
import { BillTable, TotalRow } from "./BillTable";
import styles from "./WifiBillDocument.module.css";

interface WifiBillDocumentProps {
  invoice: WifiInvoice;
  onPageRef: (index: number, element: HTMLDivElement | null) => void;
  paymentQrUrl?: string;
  paymentLink?: string;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <span>{label}</span>
      <strong>{children || "-"}</strong>
    </div>
  );
}

function SectionTitle({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className={styles.sectionTitle}>
      <h3>{children}</h3>
      {trailing && <span>{trailing}</span>}
    </div>
  );
}

function Provider({ name, logoUrl, detail = false }: { name: string; logoUrl?: string; detail?: boolean }) {
  return (
    <div className={`${styles.provider}${name.length > 30 ? ` ${styles.providerLong}` : ""}`}>
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={`${name || "Service provider"} logo`}
          width={264}
          height={66}
          className={`${styles.providerLogo}${detail ? ` ${styles.detailProviderLogo}` : ""}`}
          unoptimized
          loading="eager"
        />
      ) : name || "Service provider"}
    </div>
  );
}

function BillQr({ src, paymentLink, amount, upiId, detailed = false, statement = false, paymentLogoUrl }: {
  src: string;
  paymentLink: string;
  amount: string;
  upiId: string;
  detailed?: boolean;
  statement?: boolean;
  paymentLogoUrl?: string;
}) {
  const showPaymentBrand = statement || detailed;
  return (
    <figure className={styles.qrCode}>
      {detailed && <span className={styles.qrBrand}>BHIM UPI</span>}
      {detailed && <span className={styles.qrDestination}>Send payment to<br />{upiId}</span>}
      <a
        href={paymentLink}
        data-pdf-link={paymentLink}
        className={styles.qrPaymentLink}
        aria-label={`Open UPI payment link with ${amount} prefilled`}
      >
        <Image
          src={src}
          alt="UPI payment QR code containing this bill's invoice and tax metadata"
          data-pdf-qr={paymentLink}
          width={144}
          height={144}
          unoptimized
          loading="eager"
        />
      </a>
      <figcaption>
        <strong>Scan &amp; pay via any UPI {showPaymentBrand ? "Apps" : "app"}</strong>
        {showPaymentBrand ? (
          paymentLogoUrl && (
            <span className={styles.qrPoweredBy}>
              <span>Powered by</span>
              <Image src={paymentLogoUrl} alt="Airtel Payments Bank" width={352} height={70} className={styles.qrPaymentsBankLogo} unoptimized loading="eager" />
            </span>
          )
        ) : (
          <>
            <span>{amount} prefilled</span>
            {detailed && <span>Invoice and GST metadata included</span>}
          </>
        )}
      </figcaption>
    </figure>
  );
}

function Customer({ invoice, showGstin = true }: { invoice: WifiInvoice; showGstin?: boolean }) {
  const { customer } = invoice;
  return (
    <div className={styles.customer}>
      <strong>{customer.name || "Customer name"}</strong>
      <p className={styles.multiline}>{customer.addressLines.length ? customer.addressLines.join("\n") : "Customer address"}</p>
      <p>Email address: {customer.email || "-"}</p>
      <p>Registered telephone number: {customer.phone || "-"}</p>
      {showGstin && customer.gstin && <p>GSTIN: {customer.gstin}</p>}
    </div>
  );
}

function Footer({ page, invoiceNumber }: { page: number; invoiceNumber: string }) {
  return (
    <footer className={styles.footer}>
      <span>{invoiceNumber && `Invoice ${invoiceNumber}`}</span>
      <span>Page {page} of 4</span>
    </footer>
  );
}

function priorBillMonth(value: string, monthsBack: number): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return "—";
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 - monthsBack, 1));
  return formatBillMonth(date.toISOString().slice(0, 7));
}

function OptionalMoney({ paise, debit = false }: { paise: number | null; debit?: boolean }) {
  if (paise === null) return <>—</>;
  return <>{formatMoney((debit && paise > 0 ? -paise : paise) / 100)}</>;
}

function formatDebit(amount: number): string {
  return amount === 0 ? formatMoney(0) : formatMoney(amount > 0 ? -amount : amount);
}

function paymentPortalLabel(value: string): string {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return value;
  }
}

function DebitAmount({ amount }: { amount: number }) {
  return <>{formatDebit(amount)}</>;
}

function Code128Barcode({ value, label, caption }: { value: string; label: string; caption?: ReactNode }) {
  if (!value) return <div className={styles.barcodeFallback}><span>No {label.toLowerCase()}</span></div>;
  let modules = "";
  try {
    modules = encodeCode128B(value).modules;
  } catch {
    return <div className={styles.barcodeFallback}><span>{value}</span></div>;
  }
  const bars: { x: number; width: number }[] = [];
  for (let index = 0; index < modules.length;) {
    if (modules[index] === "0") { index += 1; continue; }
    const start = index;
    while (modules[index] === "1") index += 1;
    bars.push({ x: start, width: index - start });
  }
  return (
    <div className={styles.encodedBarcode}>
      <svg viewBox={`0 0 ${modules.length} 50`} role="img" aria-label={`${label} barcode for ${value}`} preserveAspectRatio="none">
        <title>{label}: {value}</title>
        {bars.map((bar) => <rect key={bar.x} x={bar.x} y="0" width={bar.width} height="50" fill="#000000" />)}
      </svg>
      <div className={styles.barcodeCaption}>{caption || value}</div>
    </div>
  );
}

function tariffValues(value: string): [string, string, string, string] {
  if (!value.trim()) return ["0.00/60", "0/60", "0/60", "See www.airtel.in"];
  const parts = value.split("|").map((part) => part.trim());
  return [
    parts.length > 0 ? parts[0] : "0.00/60",
    parts.length > 1 ? parts[1] : "0/60",
    parts.length > 2 ? parts[2] : "0/60",
    parts.length > 3 ? parts[3] : "See www.airtel.in",
  ];
}

/** Four fixed A4 pages shared by the on-screen preview and PDF capture. */
export function WifiBillDocument({ invoice, onPageRef, paymentQrUrl, paymentLink }: WifiBillDocumentProps) {
  const data = invoice.source;
  const { calculations: totals, companyProfile, customer, identifiers, plan } = invoice;
  const resolvedLogoUrl = companyProfile.assets.logoUrl || undefined;
  const resolvedPaymentLogoUrl = companyProfile.assets.paymentLogoUrl || undefined;
  const resolvedSignatureUrl = companyProfile.assets.signatureUrl || undefined;
  const resolvedDetailLogoUrl = companyProfile.assets.detailLogoUrl || resolvedLogoUrl;
  const period = `${formatBillDate(identifiers.periodStart)} to ${formatBillDate(identifiers.periodEnd)}`;
  const paymentDescription = data.paymentInstructions || "Please contact your service provider for payment instructions.";
  const statementRow = invoice.statementRow;
  const netRental = totals.netRental;
  const hasLargeAmounts = Math.max(
    totals.rentalBeforeTax,
    totals.previousBalance,
    Math.abs(totals.paymentReceived),
    Math.abs(totals.paymentCoupon),
    totals.totalCurrentCharges,
    totals.amountAfterDueDate,
  ) >= 100_000;
  const legalText = [
    companyProfile.registeredOffice,
    companyProfile.corporateOffice,
    data.contactInformation,
    data.appellateInformation,
    data.corporateCoordinatorInformation,
    data.chargesInformation,
    data.addressChangeInformation,
    data.otherInformation,
    plan.serviceDescription,
  ].join("");
  const hasLongContent = [companyProfile.address, customer.addressLines.join(" "), data.paymentInstructions, data.notes].join("").length > 650
    || legalText.length > 2_900;
  const tariffRows = [
    ["to airtel fixedline", data.tariffAirtelFixedline],
    ["to other fixedline", data.tariffOtherFixedline],
    ["to airtel mobile", data.tariffAirtelMobile],
    ["to other mobile", data.tariffOtherMobile],
    ["to fixedline CUG", data.tariffFixedlineCug],
    ["to WLL", data.tariffWll],
  ];
  const historyRows = invoice.historyRows;

  return (
    <div className={[styles.document, hasLargeAmounts && styles.largeAmounts, hasLongContent && styles.compact].filter(Boolean).join(" ")}>
      <div className={`${styles.page} ${styles.statementPage}`} ref={(element) => onPageRef(0, element)} aria-label="Wi-Fi statement, page 1">
        <header className={styles.header}>
          <h2 className={styles.redHeading}>POSTPAID Wi-Fi MONTHLY STATEMENT</h2>
          <Provider name={companyProfile.legalName} logoUrl={resolvedLogoUrl} />
        </header>

        <div className={styles.statementOverview}>
          <div>
            <Customer invoice={invoice} showGstin={false} />
            <div className={styles.planSummary}>
              <strong>Your plan: {plan.displayName || "Wi-Fi monthly plan"}{plan.displayName && !/monthly rental/i.test(plan.displayName) ? " (Monthly Rental)" : ""}</strong>
              <p>Number of connections: {data.connections || "1"}</p>
              <p>Statement date: {formatBillDate(identifiers.billDate)}</p>
              <p>Statement period: {period}</p>
            </div>
          </div>
          <aside className={styles.paymentBox}>
            <div className={styles.payableHeader}>
              <div><span>{WIFI_BILL_LABELS.amountPayable}</span><strong>{formatMoney(totals.totalPayable)}</strong></div>
              <div><span>{WIFI_BILL_LABELS.dueDate}</span><strong>{formatBillDate(identifiers.dueDate)}</strong></div>
            </div>
            <div className={`${styles.paymentInstructions}${paymentQrUrl ? ` ${styles.withPaymentQr}` : ""}`}>
            <div className={styles.paymentCta}>
                <strong>{companyProfile.assets.paymentAppName ? <>Pay via<br />{companyProfile.assets.paymentAppName}</> : <>Pay securely<br />using UPI</>}</strong>
                {companyProfile.assets.paymentPortalUrl && <a href={companyProfile.assets.paymentPortalUrl} data-pdf-link={companyProfile.assets.paymentPortalUrl} className={styles.paymentPortalLink}>{paymentPortalLabel(companyProfile.assets.paymentPortalUrl)}</a>}
              </div>
              {paymentQrUrl && paymentLink && (
                <BillQr src={paymentQrUrl} paymentLink={paymentLink} amount={formatMoney(totals.totalPayable)} upiId={data.paymentUpiId} statement paymentLogoUrl={resolvedPaymentLogoUrl} />
              )}
            </div>
          </aside>
        </div>

        <div className={styles.balanceStrip}>
          {[
            { label: "Last bill amount", value: <OptionalMoney paise={statementRow.previousDues} /> },
            { label: "Payment made", value: <OptionalMoney paise={statementRow.payments} debit /> },
            { label: "Payment coupon", value: formatDebit(totals.paymentCoupon) },
            { label: "Credits", value: formatDebit(totals.credits) },
            { label: WIFI_BILL_LABELS.currentCharges, value: formatMoney(totals.totalCurrentCharges) },
            { label: WIFI_BILL_LABELS.amountPayable, value: formatMoney(totals.totalPayable) },
            { label: WIFI_BILL_LABELS.amountAfterDueDate, value: formatMoney(totals.amountAfterDueDate) },
          ].map(({ label, value }) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
        </div>

        <section className={styles.section}>
          <SectionTitle>{WIFI_BILL_LABELS.chargesSummary}</SectionTitle>
          <div className={styles.sectionBody}>
            <BillTable>
              <colgroup><col style={{ width: "32%" }} /><col style={{ width: "14%" }} /><col style={{ width: "18%" }} /><col style={{ width: "18%" }} /><col style={{ width: "18%" }} /></colgroup>
              <thead><tr><th>Services</th><th className={styles.center}>No. of connections</th><th className={styles.money}>Plan charges</th><th className={styles.money}>Other charges</th><th className={styles.money}>Total</th></tr></thead>
              <tbody>
                <tr><th>Wi-Fi{identifiers.wifiId && <span className={styles.regular}> - {identifiers.wifiId}</span>}</th><td className={styles.center}>{plan.connections || "1"}</td><td className={styles.money}>{formatMoney(totals.rentalBeforeTax)}</td><td className={styles.money}>{formatMoney(totals.otherChargesBeforeTax)}</td><td className={styles.money}>{formatMoney(totals.grossChargesBeforeTax)}</td></tr>
                <tr><th>Plan discount</th><td className={styles.center}>-</td><td className={styles.money}>{formatDebit(totals.discountBeforeTax)}</td><td className={styles.money}>-</td><td className={styles.money}>{formatDebit(totals.discountBeforeTax)}</td></tr>
                <tr><th>Revised charges</th><td className={styles.center}>-</td><td className={styles.money}>-</td><td className={styles.money}>-</td><td className={styles.money}>-</td></tr>
                <tr><th>Taxes (GST)</th><td className={styles.center}>-</td><td className={styles.money}>-</td><td className={styles.money}>{formatMoney(totals.gstTotal)}</td><td className={styles.money}>{formatMoney(totals.gstTotal)}</td></tr>
                <tr className={styles.rule}><th colSpan={4}>{WIFI_BILL_LABELS.currentCharges}</th><td className={styles.money}>{formatMoney(totals.totalCurrentCharges)}</td></tr>
                <tr><th colSpan={4}>Last bill amount</th><td className={styles.money}><OptionalMoney paise={statementRow.previousDues} /></td></tr>
                <tr><th colSpan={4}>Last payment made</th><td className={styles.money}><OptionalMoney paise={statementRow.payments} debit /></td></tr>
                <TotalRow grand><th colSpan={4}>{WIFI_BILL_LABELS.amountPayable}</th><td className={styles.money}>{formatMoney(totals.totalPayable)}</td></TotalRow>
              </tbody>
            </BillTable>
            <p className={styles.amountWords}>Total: {amountInWords(totals.totalPayable)}</p>
          </div>
        </section>

        <section className={styles.section}>
          <SectionTitle>Bills &amp; Payments Summary</SectionTitle>
          <div className={styles.sectionBody}>
            <BillTable variant="grid">
              <thead><tr><th>Month</th><th>Previous dues<br />(A)</th><th>Payments<br />(B)</th><th>Payment coupon<br />(C)</th><th>Credits<br />(D)</th><th>{WIFI_BILL_LABELS.currentCharges}<br />(E)</th><th>{WIFI_BILL_LABELS.amountPayable}<br />(A+B+C+D+E)</th></tr></thead>
              <tbody>
                <tr><th>{formatBillMonth(identifiers.billMonth)}</th><td><OptionalMoney paise={statementRow.previousDues} /></td><td><OptionalMoney paise={statementRow.payments} debit /></td><td><OptionalMoney paise={statementRow.paymentCoupon} debit /></td><td><OptionalMoney paise={statementRow.credits} debit /></td><td><OptionalMoney paise={statementRow.currentCharges} /></td><td><OptionalMoney paise={statementRow.payable} /></td></tr>
                {historyRows.map((row) => <tr key={row.offset}>
                  <th>{priorBillMonth(identifiers.billMonth, row.offset)}</th>
                  <td><OptionalMoney paise={row.previousDues} /></td>
                  <td><OptionalMoney paise={row.payments} debit /></td>
                  <td><OptionalMoney paise={row.paymentCoupon} debit /></td>
                  <td><OptionalMoney paise={row.credits} debit /></td>
                  <td><OptionalMoney paise={row.currentCharges} /></td>
                  <td><OptionalMoney paise={row.payable} /></td>
                </tr>)}
              </tbody>
            </BillTable>
          </div>
        </section>
        <Footer page={1} invoiceNumber={identifiers.invoiceNumber} />
      </div>

      <div className={`${styles.page} ${styles.summaryPage}`} ref={(element) => onPageRef(1, element)} aria-label="Wi-Fi payments and refunds, page 2">
        <header className={styles.header}>
          <h2 className={styles.redHeading}>POSTPAID Wi-Fi MONTHLY STATEMENT</h2>
          <Provider name={companyProfile.legalName} logoUrl={resolvedLogoUrl} />
        </header>
        <section className={styles.paymentHistory}>
          <h3>{WIFI_BILL_LABELS.paymentsAndRefunds}</h3>
          <strong>Last payment against this account</strong>
          <BillTable variant="payment">
            <thead><tr><th>Description</th><th>Date</th><th className={styles.money}>Amount paid</th></tr></thead>
            <tbody>
              <tr><td>{totals.paymentReceived !== 0 ? data.paymentMethod || "Payment received" : "No payment recorded"}</td><td>{data.paymentDate ? formatBillDate(data.paymentDate) : "-"}</td><td className={styles.money}><DebitAmount amount={totals.totalPayable} /></td></tr>
              <tr className={styles.totalRow}><th colSpan={2}>Total</th><td className={styles.money}><DebitAmount amount={totals.totalPayable} /></td></tr>
            </tbody>
          </BillTable>
        </section>
        {companyProfile.assets.pageTwoBannerUrl ? (
          <Image
            src={companyProfile.assets.pageTwoBannerUrl}
            alt="Airtel and Adobe Express customer offer"
            width={720}
            height={211}
            className={styles.pageTwoBanner}
            unoptimized
            loading="eager"
          />
        ) : (
          <div className={styles.pageTwoPanel}>
            <Provider name={companyProfile.legalName} logoUrl={resolvedLogoUrl} />
            <div>
              <strong>Manage your connection online</strong>
              <p>View bills, make payments, manage your plan and get support through your operator&apos;s app or website.</p>
            </div>
          </div>
        )}
        <p className={styles.summaryDisclaimer}>This is only a summary statement. Input tax credit will not be available on the basis of this document.</p>
        <Footer page={2} invoiceNumber={identifiers.invoiceNumber} />
      </div>

      <div className={`${styles.page} ${styles.invoicePage}`} ref={(element) => onPageRef(2, element)} aria-label="Wi-Fi tax invoice, page 3">
        <header className={styles.header}>
          <div>
            <h2>FIXEDLINE AND Wi-Fi SERVICES</h2>
            <p className={styles.caption}>Original copy for recipient provided by {companyProfile.legalName || "Service provider"} - Tax Invoice</p>
            <p className={styles.serviceIds}>{identifiers.fixedlineNumber && <>Fixedline number: {identifiers.fixedlineNumber} / </>}Wi-Fi ID: {identifiers.wifiId || "-"}</p>
          </div>
          <Provider name={companyProfile.legalName} logoUrl={resolvedLogoUrl} />
        </header>

        <section className={styles.section}>
          <SectionTitle>{WIFI_BILL_LABELS.billingAddress}</SectionTitle>
          <div className={`${styles.sectionBody} ${styles.billingColumns}`}>
            <Customer invoice={invoice} showGstin={false} />
            <div className={styles.barcodePanel}>
              <div className={styles.billingBarcode}>
                <Code128Barcode
                  value={invoice.barcodeValue}
                  label="Billing address"
                  caption={<><span>{identifiers.invoiceNumber || "-"}</span><span>{identifiers.accountNumber || "-"}</span></>}
                />
              </div>
              <div className={styles.supplyRow}>
                <span>Ship To State Code : {customer.stateCode || "-"}</span>
                <span>Place of Supply : {customer.state || "-"}</span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <SectionTitle>{WIFI_BILL_LABELS.account}</SectionTitle>
          <div className={`${styles.sectionBody} ${styles.twoColumns}`}>
            <div>
              <Field label="Account No">{identifiers.accountNumber}</Field>
              <Field label="GST No">{customer.gstin || "Not provided"}</Field>
              <Field label={WIFI_BILL_LABELS.billPeriod}>{period}</Field>
            </div>
            <div className={styles.identityDetails}>
              <Field label="Bill No">{identifiers.invoiceNumber}</Field>
              <Field label={WIFI_BILL_LABELS.billDate}>{formatBillDate(identifiers.billDate)}</Field>
              <Field label={WIFI_BILL_LABELS.dueDate}>{formatBillDate(identifiers.dueDate)}</Field>
              <Field label="Credit limit">{formatMoney(totals.creditLimit)}</Field>
              <Field label="Security deposit">{formatMoney(totals.securityDeposit)}</Field>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <SectionTitle trailing="Charges (₹)">{WIFI_BILL_LABELS.thisMonthsCharges}</SectionTitle>
          <div className={styles.sectionBody}>
            <BillTable>
              <tbody>
                <tr><th>{WIFI_BILL_LABELS.rentalCharges}</th><td className={styles.money}>{formatMoney(netRental)}</td></tr>
                {totals.otherChargesBeforeTax > 0 && <tr><th className={styles.regular}>Other charges</th><td className={styles.money}>{formatMoney(totals.otherChargesBeforeTax)}</td></tr>}
                <tr><th className={styles.regular}>Taxes</th><td className={styles.money}>{formatMoney(totals.gstTotal)}</td></tr>
                <TotalRow><th>{WIFI_BILL_LABELS.currentCharges}</th><td className={styles.money}>{formatMoney(totals.totalCurrentCharges)}</td></TotalRow>
              </tbody>
            </BillTable>
            <p className={styles.amountWords}>Total: {amountInWords(totals.totalCurrentCharges)}</p>
          </div>
        </section>
        <p className={styles.caption}>Detailed breakup of these charges can be found on the next page.</p>

        <div className={styles.invoiceBottom}>
          <div className={styles.issuer}>
            <strong>For {companyProfile.legalName || "Service provider"}</strong>
            {resolvedSignatureUrl ? (
              <Image
                src={resolvedSignatureUrl}
                alt={`Signature of ${data.issuerSignatoryName || "the authorised signatory"}`}
                width={156}
                height={70}
                className={styles.signatureImage}
                unoptimized
                loading="eager"
              />
            ) : (
              <div className={styles.signaturePlaceholder}>Authorised Signatory</div>
            )}
            <strong>{data.issuerSignatoryName || "Authorised signatory"}</strong>
            <p>{data.issuerSignatoryTitle || "Authorised representative"}</p>
          </div>
          {paymentQrUrl && paymentLink && (
            <BillQr src={paymentQrUrl} paymentLink={paymentLink} amount={formatMoney(totals.totalPayable)} upiId={data.paymentUpiId} detailed paymentLogoUrl={resolvedPaymentLogoUrl} />
          )}
        </div>
        <Footer page={3} invoiceNumber={identifiers.invoiceNumber} />
      </div>

      <div className={`${styles.page} ${styles.detailPage}`} ref={(element) => onPageRef(3, element)} aria-label="Wi-Fi charge details, page 4">
        <header className={`${styles.header} ${styles.detailsHeader}`}>
          <Provider name={companyProfile.legalName} logoUrl={resolvedDetailLogoUrl} detail />
          <div className={styles.accountLabel}><span>Relationship No</span><strong>: &nbsp;{identifiers.accountNumber || "-"}</strong></div>
        </header>
        <h2 className={styles.detailsTitle}>YOUR CHARGES IN DETAIL</h2>

        <section className={styles.detailSection}>
          <h3>Rentals</h3>
          <BillTable variant="detail">
            <colgroup><col style={{ width: "27%" }} /><col style={{ width: "14%" }} /><col style={{ width: "14%" }} /><col style={{ width: "11%" }} /><col style={{ width: "11%" }} /><col style={{ width: "12%" }} /><col style={{ width: "11%" }} /></colgroup>
            <thead><tr><th>Description</th><th>From date</th><th>To date</th><th className={styles.money}>Rental</th><th className={styles.money}>Discount</th><th className={styles.money}>Net charges</th><th className={styles.money}>Total (₹)</th></tr></thead>
            <tbody>
              <tr><th className={styles.redText}>Plan details</th><td colSpan={5}></td><td className={styles.money}><strong>{formatMoney(netRental)}</strong></td></tr>
              <tr><td>{plan.displayName || "Wi-Fi monthly plan"}</td><td>{formatBillDate(identifiers.periodStart)}</td><td>{formatBillDate(identifiers.periodEnd)}</td><td className={styles.money}>{formatMoney(totals.rentalBeforeTax)}</td><td className={styles.money}>{formatMoney(totals.discountBeforeTax)}</td><td className={styles.money}>{formatMoney(netRental)}</td><td></td></tr>
              {totals.otherChargesBeforeTax > 0 && <tr><td>Other charges</td><td colSpan={4}>-</td><td className={styles.money}>{formatMoney(totals.otherChargesBeforeTax)}</td><td className={styles.money}>{formatMoney(totals.otherChargesBeforeTax)}</td></tr>}
            </tbody>
          </BillTable>
        </section>

        <section className={styles.detailSection}>
          <h3>{WIFI_BILL_LABELS.taxDetails}</h3>
          <BillTable variant="tax">
            <thead><tr><th>HSN</th><th className={styles.money}>Taxable value</th><th className={styles.money}>CGST rate</th><th className={styles.money}>CGST amount</th><th className={styles.money}>SGST / UTGST rate</th><th className={styles.money}>SGST / UTGST amount</th><th className={styles.money}>IGST rate</th><th className={styles.money}>IGST amount</th><th className={styles.money}>Total tax</th><th className={styles.money}>Total</th></tr></thead>
            <tbody>
              <tr><td>{plan.hsnSacCode || "-"}</td><td className={styles.money}>{formatMoney(totals.taxableAmount)}</td><td className={styles.money}>{totals.cgstRate}%</td><td className={styles.money}>{formatMoney(totals.cgst)}</td><td className={styles.money}>{totals.sgstRate}%</td><td className={styles.money}>{formatMoney(totals.sgst)}</td><td className={styles.money}>{data.taxMode === "igst" ? `${data.gstRate}%` : "0%"}</td><td className={styles.money}>{formatMoney(totals.igst)}</td><td className={styles.money}>{formatMoney(totals.gstTotal)}</td><td className={styles.money}><strong>{formatMoney(totals.gstTotal)}</strong></td></tr>
              <TotalRow><th colSpan={9}>{WIFI_BILL_LABELS.currentCharges}</th><td className={styles.money}>{formatMoney(totals.totalCurrentCharges)}</td></TotalRow>
            </tbody>
          </BillTable>
        </section>

        <section className={styles.detailSection}>
          <h3>{WIFI_BILL_LABELS.paymentsAndRefunds}</h3>
          <BillTable variant="detail">
            <colgroup><col style={{ width: "55%" }} /><col style={{ width: "18%" }} /><col style={{ width: "14%" }} /><col style={{ width: "13%" }} /></colgroup>
            <thead><tr><th>Description</th><th>Date</th><th className={styles.money}>Amount</th><th className={styles.money}>Total (₹)</th></tr></thead>
            <tbody>
              <tr><td>{totals.paymentReceived !== 0 ? data.paymentMethod || "Payment received" : "No payment recorded"}</td><td>{data.paymentDate ? formatBillDate(data.paymentDate) : "-"}</td><td className={styles.money}><DebitAmount amount={totals.totalPayable} /></td><td className={styles.money}><DebitAmount amount={totals.totalPayable} /></td></tr>
            </tbody>
          </BillTable>
        </section>

        <section className={styles.tariffBox}>
          <h3>Bill Plan Details : {plan.displayName || "Wi-Fi monthly plan"}</h3>
          <div className={styles.planBar}><span><strong>Rental:</strong> {formatMoney(totals.rentalBeforeTax)}</span><span><strong>Quota:</strong> {data.quota || "Not specified"}</span><span><strong>*Speed:</strong> {data.speed || "Not specified"}</span></div>
          <h3>Tariff Details</h3>
          <BillTable variant="tariff">
            <thead><tr><th>Voice - Call Rates</th><th>Local<br />(Rs/sec)</th><th>STD Intra Circle<br />(Rs/sec)</th><th>STD Inter Circle<br />(Rs/sec)</th><th>ISD<br />(Rs/sec)</th></tr></thead>
            <tbody>{tariffRows.map(([label, rate]) => {
              const [local, intraCircle, interCircle, isd] = tariffValues(rate);
              return <tr key={label}><td>{label}</td><td>{local}</td><td>{intraCircle}</td><td>{interCircle}</td><td>{isd}</td></tr>;
            })}</tbody>
          </BillTable>
          <p className={styles.fupNote}>*{data.fupInformation || "Post unlimited quota, speed may be revised as per the Fair Usage Policy."}</p>
        </section>

        <section className={styles.legalBox}>
          <p><strong>Payment Modes - </strong>{paymentDescription}</p>
          <p><strong>Contact Information - </strong>{data.contactInformation || [companyProfile.supportPhone, companyProfile.supportEmail].filter(Boolean).join(" | ") || "Contact the service provider for assistance."}</p>
          <p><strong>Appellate Desk - </strong>{data.appellateInformation || "Contact the operator's appellate desk for unresolved complaints."}</p>
          {!/\b1930\b/.test(data.appellateInformation) && <p><strong>Call 1930 for cyber-crime fraud reporting.</strong></p>}
          <p><strong>Corporate Coordinator Contact Information - </strong>{data.corporateCoordinatorInformation || "Contact the corporate support desk for business account queries."}</p>
          <p><strong>Charges - </strong>{data.chargesInformation || "Charges and late payment fees apply as disclosed by the operator and applicable law."}</p>
          <p><strong>Address change - </strong>{data.addressChangeInformation || "Contact support or visit the nearest operator store with address proof."}</p>
          <p><strong>Other Information - </strong>{data.otherInformation || "Tariff, tax and service terms are subject to the operator's published terms."}</p>
          {data.notes && <p><strong>Notes - </strong>{data.notes}</p>}
          <p><strong>Registered Office: </strong>{companyProfile.registeredOffice || companyProfile.address || "-"}</p>
          <p><strong>Corporate Office: </strong>{companyProfile.corporateOffice || companyProfile.address || "-"}</p>
          <p><strong>Corporate Identity Number: </strong>{companyProfile.cin || "-"}</p>
          <p><strong>Ship To State Code: </strong>{customer.stateCode || "-"} &nbsp; <strong>GST registration no: </strong>{companyProfile.gstin || "-"} under Category {companyProfile.serviceCategory || "-"} &nbsp; <strong>PAN: </strong>{companyProfile.pan || "-"}</p>
          <p><strong>HSN / SAC: </strong>{plan.hsnSacCode || "-"} - {plan.serviceDescription || companyProfile.serviceCategory || "Telecommunication service"}</p>
        </section>
        <Footer page={4} invoiceNumber={identifiers.invoiceNumber} />
      </div>
    </div>
  );
}
