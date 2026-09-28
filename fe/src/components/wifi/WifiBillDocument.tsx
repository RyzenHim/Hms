import Image from "next/image";
import type { ReactNode } from "react";
import {
  amountInWords,
  calculateWifiBill,
  formatBillDate,
  formatBillMonth,
  formatMoney,
} from "@/lib/wifi-bill";
import { encodeCode128B } from "@/lib/code128";
import {
  REFERENCE_AIRTEL_DETAIL_LOGO_URL,
  REFERENCE_AIRTEL_LOGO_URL,
  REFERENCE_AIRTEL_PAGE_TWO_BANNER_URL,
  REFERENCE_AIRTEL_PAYMENT_LOGO_URL,
  REFERENCE_AIRTEL_SIGNATURE_URL,
  usesReferenceOperator,
} from "@/lib/wifi-operator";
import type { WifiBillData } from "@/types/wifi-bill";
import styles from "./WifiBillDocument.module.css";

interface WifiBillDocumentProps {
  data: WifiBillData;
  onPageRef: (index: number, element: HTMLDivElement | null) => void;
  /** Embedded images are loaded before PDF capture by the workspace. */
  logoUrl?: string;
  paymentLogoUrl?: string;
  signatureUrl?: string;
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
          width={182}
          height={58}
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

function Customer({ data, showGstin = true }: { data: WifiBillData; showGstin?: boolean }) {
  return (
    <div className={styles.customer}>
      <strong>{data.customerName || "Customer name"}</strong>
      <p className={styles.multiline}>{data.customerAddress || "Customer address"}</p>
      <p>Email address: {data.customerEmail || "-"}</p>
      <p>Registered telephone number: {data.customerPhone || "-"}</p>
      {showGstin && data.customerGstin && <p>GSTIN: {data.customerGstin}</p>}
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

function optionalPaise(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) ? amount : null;
}

function OptionalMoney({ paise, debit = false }: { paise: number | null; debit?: boolean }) {
  if (paise === null) return <>—</>;
  return <>{formatMoney((debit && paise > 0 ? -paise : paise) / 100)}</>;
}

function formatDebit(amount: number): string {
  return amount > 0 ? formatMoney(-amount) : formatMoney(0);
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
export function WifiBillDocument({ data, onPageRef, logoUrl, paymentLogoUrl, signatureUrl, paymentQrUrl, paymentLink }: WifiBillDocumentProps) {
  const referenceOperator = usesReferenceOperator(data.providerName);
  const resolvedLogoUrl = logoUrl || (referenceOperator ? REFERENCE_AIRTEL_LOGO_URL : undefined);
  const resolvedPaymentLogoUrl = paymentLogoUrl || (referenceOperator ? REFERENCE_AIRTEL_PAYMENT_LOGO_URL : undefined);
  const resolvedSignatureUrl = signatureUrl || (referenceOperator ? REFERENCE_AIRTEL_SIGNATURE_URL : undefined);
  const resolvedDetailLogoUrl = referenceOperator ? REFERENCE_AIRTEL_DETAIL_LOGO_URL : logoUrl;
  const totals = calculateWifiBill(data);
  const period = `${formatBillDate(data.periodStart)} to ${formatBillDate(data.periodEnd)}`;
  const paymentDescription = data.paymentInstructions || "Please contact your service provider for payment instructions.";
  const paymentTotal = totals.paymentReceived + totals.paymentCoupon + totals.credits;
  const netRental = totals.rentalBeforeTax - totals.discountBeforeTax;
  const hasLargeAmounts = Math.max(
    totals.rentalBeforeTax,
    totals.previousBalance,
    totals.paymentReceived,
    totals.paymentCoupon,
    totals.totalCurrentCharges,
    totals.amountAfterDueDate,
  ) >= 100_000;
  const legalText = [
    data.registeredOffice,
    data.corporateOffice,
    data.contactInformation,
    data.appellateInformation,
    data.corporateCoordinatorInformation,
    data.chargesInformation,
    data.addressChangeInformation,
    data.otherInformation,
    data.hsnServiceInformation,
  ].join("");
  const hasLongContent = [data.providerAddress, data.customerAddress, data.paymentInstructions, data.notes].join("").length > 650
    || legalText.length > 2_900;
  const tariffRows = [
    ["to airtel fixedline", data.tariffAirtelFixedline],
    ["to other fixedline", data.tariffOtherFixedline],
    ["to airtel mobile", data.tariffAirtelMobile],
    ["to other mobile", data.tariffOtherMobile],
    ["to fixedline CUG", data.tariffFixedlineCug],
    ["to WLL", data.tariffWll],
  ];
  const historyRows = ([1, 2, 3] as const).map((offset) => {
    const read = (suffix: "PreviousDues" | "Payments" | "PaymentCoupon" | "Credits" | "CurrentCharges") =>
      optionalPaise(data[`history${offset}${suffix}`]);
    const previousDues = read("PreviousDues");
    const payments = read("Payments");
    const paymentCoupon = read("PaymentCoupon");
    const credits = read("Credits");
    const currentCharges = read("CurrentCharges");
    const hasValues = [previousDues, payments, paymentCoupon, credits, currentCharges].some((value) => value !== null);
    return {
      offset,
      previousDues,
      payments,
      paymentCoupon,
      credits,
      currentCharges,
      payable: hasValues
        ? Math.max(0, (previousDues || 0) - (payments || 0) - (paymentCoupon || 0) - (credits || 0) + (currentCharges || 0))
        : null,
    };
  });

  return (
    <div className={[styles.document, hasLargeAmounts && styles.largeAmounts, hasLongContent && styles.compact].filter(Boolean).join(" ")}>
      <div className={`${styles.page} ${styles.statementPage}`} ref={(element) => onPageRef(0, element)} aria-label="Wi-Fi statement, page 1">
        <header className={styles.header}>
          <h2 className={styles.redHeading}>POSTPAID Wi-Fi MONTHLY STATEMENT</h2>
          <Provider name={data.providerName} logoUrl={resolvedLogoUrl} />
        </header>

        <div className={styles.statementOverview}>
          <div>
            <Customer data={data} showGstin={false} />
            <div className={styles.planSummary}>
              <strong>Your plan: {data.planName || "Wi-Fi monthly plan"}{data.planName && !/monthly rental/i.test(data.planName) ? " (Monthly Rental)" : ""}</strong>
              <p>Number of connections: {data.connections || "1"}</p>
              <p>Statement date: {formatBillDate(data.billDate)}</p>
              <p>Statement period: {period}</p>
            </div>
          </div>
          <aside className={styles.paymentBox}>
            <div className={styles.payableHeader}>
              <div><span>Total amount payable</span><strong>{formatMoney(totals.totalPayable)}</strong></div>
              <div><span>Due date</span><strong>{formatBillDate(data.dueDate)}</strong></div>
            </div>
            <div className={`${styles.paymentInstructions}${paymentQrUrl ? ` ${styles.withPaymentQr}` : ""}`}>
              <div className={styles.paymentCta}>
                <strong>Pay via<br />Airtel Thanks App</strong>
                <a href="https://www.airtel.in/pay" data-pdf-link="https://www.airtel.in/pay" className={styles.paymentPortalLink}>www.airtel.in/pay</a>
              </div>
              {paymentQrUrl && paymentLink && (
                <BillQr src={paymentQrUrl} paymentLink={paymentLink} amount={formatMoney(totals.totalPayable)} upiId={data.paymentUpiId} statement paymentLogoUrl={resolvedPaymentLogoUrl} />
              )}
            </div>
          </aside>
        </div>

        <div className={styles.balanceStrip}>
          {[
            { label: "Last bill amount", value: formatMoney(totals.previousBalance) },
            { label: "Payment made", value: formatDebit(totals.paymentReceived) },
            { label: "Payment coupon", value: formatDebit(totals.paymentCoupon) },
            { label: "Credits", value: formatDebit(totals.credits) },
            { label: "This month's charges", value: formatMoney(totals.totalCurrentCharges) },
            { label: "Amount payable", value: formatMoney(totals.totalPayable) },
            { label: "Amount after due date", value: formatMoney(totals.amountAfterDueDate) },
          ].map(({ label, value }) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
        </div>

        <section className={styles.section}>
          <SectionTitle>This Month&apos;s Charges Summary</SectionTitle>
          <div className={styles.sectionBody}>
            <table className={styles.table}>
              <colgroup><col style={{ width: "32%" }} /><col style={{ width: "14%" }} /><col style={{ width: "18%" }} /><col style={{ width: "18%" }} /><col style={{ width: "18%" }} /></colgroup>
              <thead><tr><th>Services</th><th className={styles.center}>No. of connections</th><th className={styles.money}>Plan charges</th><th className={styles.money}>Other charges</th><th className={styles.money}>Total</th></tr></thead>
              <tbody>
                <tr><th>Wi-Fi{data.wifiId && <span className={styles.regular}> - {data.wifiId}</span>}</th><td className={styles.center}>{data.connections || "1"}</td><td className={styles.money}>{formatMoney(totals.rentalBeforeTax)}</td><td className={styles.money}>{formatMoney(totals.otherChargesBeforeTax)}</td><td className={styles.money}>{formatMoney(totals.rentalBeforeTax + totals.otherChargesBeforeTax)}</td></tr>
                <tr><th>Plan discount</th><td className={styles.center}>-</td><td className={styles.money}>{formatDebit(totals.discountBeforeTax)}</td><td className={styles.money}>-</td><td className={styles.money}>{formatDebit(totals.discountBeforeTax)}</td></tr>
                <tr><th>Revised charges</th><td className={styles.center}>-</td><td className={styles.money}>-</td><td className={styles.money}>-</td><td className={styles.money}>-</td></tr>
                <tr><th>Taxes (GST)</th><td className={styles.center}>-</td><td className={styles.money}>-</td><td className={styles.money}>{formatMoney(totals.gstTotal)}</td><td className={styles.money}>{formatMoney(totals.gstTotal)}</td></tr>
                <tr className={styles.rule}><th colSpan={4}>This month&apos;s charges</th><td className={styles.money}>{formatMoney(totals.totalCurrentCharges)}</td></tr>
                <tr><th colSpan={4}>Last bill amount</th><td className={styles.money}>{formatMoney(totals.previousBalance)}</td></tr>
                <tr><th colSpan={4}>Last payment made, payment coupon and credits</th><td className={styles.money}>{formatDebit(paymentTotal)}</td></tr>
                <tr className={styles.grandTotal}><th colSpan={4}>TOTAL PAYABLE AMOUNT</th><td className={styles.money}>{formatMoney(totals.totalPayable)}</td></tr>
              </tbody>
            </table>
            <p className={styles.amountWords}>Total: {amountInWords(totals.totalPayable)}</p>
          </div>
        </section>

        <section className={styles.section}>
          <SectionTitle>Bills &amp; Payments Summary</SectionTitle>
          <div className={styles.sectionBody}>
            <table className={`${styles.table} ${styles.gridTable}`}>
              <thead><tr><th>Month</th><th>Previous dues<br />(A)</th><th>Payments<br />(B)</th><th>Payment coupon<br />(C)</th><th>Credits<br />(D)</th><th>This month&apos;s charges<br />(E)</th><th>Amount payable<br />(A+B+C+D+E)</th></tr></thead>
              <tbody>
                <tr><th>{formatBillMonth(data.billMonth)}</th><td>{formatMoney(totals.previousBalance)}</td><td>{formatDebit(totals.paymentReceived)}</td><td>{formatDebit(totals.paymentCoupon)}</td><td>{formatDebit(totals.credits)}</td><td>{formatMoney(totals.totalCurrentCharges)}</td><td>{formatMoney(totals.totalPayable)}</td></tr>
                {historyRows.map((row) => <tr key={row.offset}>
                  <th>{priorBillMonth(data.billMonth, row.offset)}</th>
                  <td><OptionalMoney paise={row.previousDues} /></td>
                  <td><OptionalMoney paise={row.payments} debit /></td>
                  <td><OptionalMoney paise={row.paymentCoupon} debit /></td>
                  <td><OptionalMoney paise={row.credits} debit /></td>
                  <td><OptionalMoney paise={row.currentCharges} /></td>
                  <td><OptionalMoney paise={row.payable} /></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </section>
        <Footer page={1} invoiceNumber={data.invoiceNumber} />
      </div>

      <div className={`${styles.page} ${styles.summaryPage}`} ref={(element) => onPageRef(1, element)} aria-label="Wi-Fi payments and refunds, page 2">
        <header className={styles.header}>
          <h2 className={styles.redHeading}>POSTPAID Wi-Fi MONTHLY STATEMENT</h2>
          <Provider name={data.providerName} logoUrl={resolvedLogoUrl} />
        </header>
        <section className={styles.paymentHistory}>
          <h3>Payments and refunds-details</h3>
          <strong>Last payment against this account</strong>
          <table className={`${styles.table} ${styles.paymentHistoryTable}`}>
            <thead><tr><th>Description</th><th>Date</th><th className={styles.money}>Amount paid</th></tr></thead>
            <tbody>
              <tr><td>{totals.paymentReceived > 0 ? data.paymentMethod || "Payment received" : "No payment recorded"}</td><td>{data.paymentDate ? formatBillDate(data.paymentDate) : "-"}</td><td className={styles.money}><DebitAmount amount={totals.paymentReceived} /></td></tr>
              {totals.paymentCoupon > 0 && <tr><td>Payment coupon</td><td>-</td><td className={styles.money}><DebitAmount amount={totals.paymentCoupon} /></td></tr>}
              {totals.credits > 0 && <tr><td>Account credit / refund</td><td>-</td><td className={styles.money}><DebitAmount amount={totals.credits} /></td></tr>}
              <tr className={styles.totalRow}><th colSpan={2}>Total</th><td className={styles.money}><DebitAmount amount={paymentTotal} /></td></tr>
            </tbody>
          </table>
        </section>
        {referenceOperator ? (
          <Image
            src={REFERENCE_AIRTEL_PAGE_TWO_BANNER_URL}
            alt="Airtel and Adobe Express customer offer"
            width={720}
            height={211}
            className={styles.pageTwoBanner}
            unoptimized
            loading="eager"
          />
        ) : (
          <div className={styles.pageTwoPanel}>
            <Provider name={data.providerName} logoUrl={resolvedLogoUrl} />
            <div>
              <strong>Manage your connection online</strong>
              <p>View bills, make payments, manage your plan and get support through your operator&apos;s app or website.</p>
            </div>
          </div>
        )}
        <p className={styles.summaryDisclaimer}>This is only a summary statement. Input tax credit will not be available on the basis of this document.</p>
        <Footer page={2} invoiceNumber={data.invoiceNumber} />
      </div>

      <div className={`${styles.page} ${styles.invoicePage}`} ref={(element) => onPageRef(2, element)} aria-label="Wi-Fi tax invoice, page 3">
        <header className={styles.header}>
          <div>
            <h2>FIXEDLINE AND Wi-Fi SERVICES</h2>
            <p className={styles.caption}>Original copy for recipient provided by {data.providerName || "Service provider"} - Tax Invoice</p>
            <p className={styles.serviceIds}>{data.fixedlineNumber && <>Fixedline number: {data.fixedlineNumber} / </>}Wi-Fi ID: {data.wifiId || "-"}</p>
          </div>
          <Provider name={data.providerName} logoUrl={resolvedLogoUrl} />
        </header>

        <section className={styles.section}>
          <SectionTitle>Billing Address</SectionTitle>
          <div className={`${styles.sectionBody} ${styles.billingColumns}`}>
            <Customer data={data} showGstin={false} />
            <div className={styles.barcodePanel}>
              <div className={styles.billingBarcode}>
                <Code128Barcode
                  value={data.billingBarcodeValue.trim() || data.accountNumber}
                  label="Billing address"
                  caption={<><span>{data.invoiceNumber || "-"}</span><span>{data.accountNumber || "-"}</span></>}
                />
              </div>
              <div className={styles.supplyRow}>
                <span>Ship To State Code : {data.customerStateCode || "-"}</span>
                <span>Place of Supply : {data.customerState || "-"}</span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <SectionTitle>Account</SectionTitle>
          <div className={`${styles.sectionBody} ${styles.twoColumns}`}>
            <div>
              <Field label="Account No">{data.accountNumber}</Field>
              <Field label="GST No">{data.customerGstin || "Not provided"}</Field>
              <Field label="Bill period">{period}</Field>
            </div>
            <div className={styles.identityDetails}>
              <Field label="Bill No">{data.invoiceNumber}</Field>
              <Field label="Bill date">{formatBillDate(data.billDate)}</Field>
              <Field label="Due date">{formatBillDate(data.dueDate)}</Field>
              <Field label="Credit limit">{formatMoney(Number(data.creditLimit) || 0)}</Field>
              <Field label="Security deposit">{formatMoney(Number(data.securityDeposit) || 0)}</Field>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <SectionTitle trailing="Charges (₹)">This Month&apos;s Charges</SectionTitle>
          <div className={styles.sectionBody}>
            <table className={styles.table}>
              <tbody>
                <tr><th>Rental charges</th><td className={styles.money}>{formatMoney(netRental)}</td></tr>
                {totals.otherChargesBeforeTax > 0 && <tr><th className={styles.regular}>Other charges</th><td className={styles.money}>{formatMoney(totals.otherChargesBeforeTax)}</td></tr>}
                <tr><th className={styles.regular}>Taxes</th><td className={styles.money}>{formatMoney(totals.gstTotal)}</td></tr>
                <tr className={styles.totalRow}><th>Total amount</th><td className={styles.money}>{formatMoney(totals.totalCurrentCharges)}</td></tr>
              </tbody>
            </table>
            <p className={styles.amountWords}>Total: {amountInWords(totals.totalCurrentCharges)}</p>
          </div>
        </section>
        <p className={styles.caption}>Detailed breakup of these charges can be found on the next page.</p>

        <div className={styles.invoiceBottom}>
          <div className={styles.issuer}>
            <strong>For {data.providerName || "Service provider"}</strong>
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
        <Footer page={3} invoiceNumber={data.invoiceNumber} />
      </div>

      <div className={`${styles.page} ${styles.detailPage}`} ref={(element) => onPageRef(3, element)} aria-label="Wi-Fi charge details, page 4">
        <header className={`${styles.header} ${styles.detailsHeader}`}>
          <Provider name={data.providerName} logoUrl={resolvedDetailLogoUrl} detail />
          <div className={styles.accountLabel}><span>Relationship No</span><strong>: &nbsp;{data.accountNumber || "-"}</strong></div>
        </header>
        <h2 className={styles.detailsTitle}>YOUR CHARGES IN DETAIL</h2>

        <section className={styles.detailSection}>
          <h3>Rentals</h3>
          <table className={`${styles.table} ${styles.detailTable}`}>
            <colgroup><col style={{ width: "27%" }} /><col style={{ width: "14%" }} /><col style={{ width: "14%" }} /><col style={{ width: "11%" }} /><col style={{ width: "11%" }} /><col style={{ width: "12%" }} /><col style={{ width: "11%" }} /></colgroup>
            <thead><tr><th>Description</th><th>From date</th><th>To date</th><th className={styles.money}>Rental</th><th className={styles.money}>Discount</th><th className={styles.money}>Net charges</th><th className={styles.money}>Total (₹)</th></tr></thead>
            <tbody>
              <tr><th className={styles.redText}>Plan details</th><td colSpan={5}></td><td className={styles.money}><strong>{formatMoney(netRental)}</strong></td></tr>
              <tr><td>{data.planName || "Wi-Fi monthly plan"}</td><td>{formatBillDate(data.periodStart)}</td><td>{formatBillDate(data.periodEnd)}</td><td className={styles.money}>{formatMoney(totals.rentalBeforeTax)}</td><td className={styles.money}>{formatMoney(totals.discountBeforeTax)}</td><td className={styles.money}>{formatMoney(netRental)}</td><td></td></tr>
              {totals.otherChargesBeforeTax > 0 && <tr><td>Other charges</td><td colSpan={4}>-</td><td className={styles.money}>{formatMoney(totals.otherChargesBeforeTax)}</td><td className={styles.money}>{formatMoney(totals.otherChargesBeforeTax)}</td></tr>}
            </tbody>
          </table>
        </section>

        <section className={styles.detailSection}>
          <h3>Tax Details</h3>
          <table className={`${styles.table} ${styles.detailTable} ${styles.taxTable}`}>
            <thead><tr><th>HSN</th><th className={styles.money}>Taxable value</th><th className={styles.money}>CGST rate</th><th className={styles.money}>CGST amount</th><th className={styles.money}>SGST / UTGST rate</th><th className={styles.money}>SGST / UTGST amount</th><th className={styles.money}>IGST rate</th><th className={styles.money}>IGST amount</th><th className={styles.money}>Total tax</th><th className={styles.money}>Total</th></tr></thead>
            <tbody>
              <tr><td>{data.hsnCode || "-"}</td><td className={styles.money}>{formatMoney(totals.taxableAmount)}</td><td className={styles.money}>{totals.cgstRate}%</td><td className={styles.money}>{formatMoney(totals.cgst)}</td><td className={styles.money}>{totals.sgstRate}%</td><td className={styles.money}>{formatMoney(totals.sgst)}</td><td className={styles.money}>{data.taxMode === "igst" ? `${data.gstRate}%` : "0%"}</td><td className={styles.money}>{formatMoney(totals.igst)}</td><td className={styles.money}>{formatMoney(totals.gstTotal)}</td><td className={styles.money}><strong>{formatMoney(totals.gstTotal)}</strong></td></tr>
              <tr className={styles.totalRow}><th colSpan={9}>This month&apos;s charges</th><td className={styles.money}>{formatMoney(totals.totalCurrentCharges)}</td></tr>
            </tbody>
          </table>
        </section>

        <section className={styles.detailSection}>
          <h3>Payments and refunds-details</h3>
          <table className={`${styles.table} ${styles.detailTable}`}>
            <colgroup><col style={{ width: "55%" }} /><col style={{ width: "18%" }} /><col style={{ width: "14%" }} /><col style={{ width: "13%" }} /></colgroup>
            <thead><tr><th>Description</th><th>Date</th><th className={styles.money}>Amount</th><th className={styles.money}>Total (₹)</th></tr></thead>
            <tbody>
              <tr><td>{totals.paymentReceived > 0 ? data.paymentMethod || "Payment received" : "No payment recorded"}</td><td>{data.paymentDate ? formatBillDate(data.paymentDate) : "-"}</td><td className={styles.money}><DebitAmount amount={totals.paymentReceived} /></td><td className={styles.money}>{totals.paymentCoupon === 0 && totals.credits === 0 ? <DebitAmount amount={paymentTotal} /> : ""}</td></tr>
              {totals.paymentCoupon > 0 && <tr><td>Payment coupon</td><td>-</td><td className={styles.money}><DebitAmount amount={totals.paymentCoupon} /></td><td></td></tr>}
              {totals.credits > 0 && <tr><td>Credits / refunds</td><td>-</td><td className={styles.money}><DebitAmount amount={totals.credits} /></td><td></td></tr>}
              {(totals.paymentCoupon > 0 || totals.credits > 0) && <tr className={styles.totalRow}><th colSpan={3}>Total</th><td className={styles.money}><DebitAmount amount={paymentTotal} /></td></tr>}
            </tbody>
          </table>
        </section>

        <section className={styles.tariffBox}>
          <h3>Bill Plan Details : {data.planName || "Wi-Fi monthly plan"}</h3>
          <div className={styles.planBar}><span><strong>Rental:</strong> {formatMoney(totals.rentalBeforeTax)}</span><span><strong>Quota:</strong> {data.quota || "Not specified"}</span><span><strong>*Speed:</strong> {data.speed || "Not specified"}</span></div>
          <h3>Tariff Details</h3>
          <table className={`${styles.table} ${styles.tariffTable}`}>
            <thead><tr><th>Voice - Call Rates</th><th>Local<br />(Rs/sec)</th><th>STD Intra Circle<br />(Rs/sec)</th><th>STD Inter Circle<br />(Rs/sec)</th><th>ISD<br />(Rs/sec)</th></tr></thead>
            <tbody>{tariffRows.map(([label, rate]) => {
              const [local, intraCircle, interCircle, isd] = tariffValues(rate);
              return <tr key={label}><td>{label}</td><td>{local}</td><td>{intraCircle}</td><td>{interCircle}</td><td>{isd}</td></tr>;
            })}</tbody>
          </table>
          <p className={styles.fupNote}>*{data.fupInformation || "Post unlimited quota, speed may be revised as per the Fair Usage Policy."}</p>
        </section>

        <section className={styles.legalBox}>
          <p><strong>Payment Modes - </strong>{paymentDescription}</p>
          <p><strong>Contact Information - </strong>{data.contactInformation || [data.supportPhone, data.supportEmail].filter(Boolean).join(" | ") || "Contact the service provider for assistance."}</p>
          <p><strong>Appellate Desk - </strong>{data.appellateInformation || "Contact the operator's appellate desk for unresolved complaints."}</p>
          {!/\b1930\b/.test(data.appellateInformation) && <p><strong>Call 1930 for cyber-crime fraud reporting.</strong></p>}
          <p><strong>Corporate Coordinator Contact Information - </strong>{data.corporateCoordinatorInformation || "Contact the corporate support desk for business account queries."}</p>
          <p><strong>Charges - </strong>{data.chargesInformation || "Charges and late payment fees apply as disclosed by the operator and applicable law."}</p>
          <p><strong>Address change - </strong>{data.addressChangeInformation || "Contact support or visit the nearest operator store with address proof."}</p>
          <p><strong>Other Information - </strong>{data.otherInformation || "Tariff, tax and service terms are subject to the operator's published terms."}</p>
          {data.notes && <p><strong>Notes - </strong>{data.notes}</p>}
          <p><strong>Registered Office: </strong>{data.registeredOffice || data.providerAddress || "-"}</p>
          <p><strong>Corporate Office: </strong>{data.corporateOffice || data.providerAddress || "-"}</p>
          <p><strong>Corporate Identity Number: </strong>{data.providerCin || "-"}</p>
          <p><strong>Ship To State Code: </strong>{data.customerStateCode || "-"} &nbsp; <strong>GST registration no: </strong>{data.providerGstin || "-"} under Category {data.providerServiceCategory || "-"} &nbsp; <strong>PAN: </strong>{data.providerPan || "-"}</p>
          <p><strong>HSN: </strong>{data.hsnServiceInformation || `${data.hsnCode || "-"} - Telecommunications services`}</p>
        </section>
        <Footer page={4} invoiceNumber={data.invoiceNumber} />
      </div>
    </div>
  );
}
