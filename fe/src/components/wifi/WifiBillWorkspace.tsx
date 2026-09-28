"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import QRCode from "qrcode";
import { Download, Eye, FileText, LoaderCircle, Plus, Save, Wifi } from "lucide-react";
import { AppSidebar } from "../AppSidebar";
import { PdfPreviewModal } from "../PdfPreviewModal";
import { buildOptimizedPdf } from "../../lib/pdf-export";
import {
  calculateWifiBill,
  createDefaultWifiBill,
  createReferenceWifiBill,
  formatMoney,
  resolveWifiBillDates,
  validateWifiBill,
} from "../../lib/wifi-bill";
import {
  buildWifiPaymentQrPayload,
  deriveAirtelPaymentUpiId,
  getWifiPaymentQrIssue,
  isDerivedAirtelPaymentUpiId,
  syncWifiPaymentUpiId,
  withDerivedAirtelPaymentUpiId,
} from "../../lib/wifi-qr";
import {
  loadCloudImageDataUrl,
  loadWifiOperator,
  REFERENCE_AIRTEL_LOGO_URL,
  REFERENCE_AIRTEL_PAYMENT_LOGO_URL,
  REFERENCE_AIRTEL_SIGNATURE_URL,
  usesReferenceOperator,
} from "../../lib/wifi-operator";
import { getWifiSavedBill, saveWifiDraft, uploadWifiSignature, WifiApiError, wifiBillFingerprint, wifiCustomerFields, type WifiCustomer } from "../../lib/wifi-api";
import type { WifiBillData } from "../../types/wifi-bill";
import { WifiBillDocument } from "./WifiBillDocument";
import { WifiBillForm } from "./WifiBillForm";
import { WifiBillLibrary } from "./WifiBillLibrary";

const pageLabels = ["Monthly Statement", "Payments and Refunds", "Tax Invoice", "Charges in Detail"];

async function createPaymentQr(data: WifiBillData) {
  const totals = calculateWifiBill(data);
  const issue = getWifiPaymentQrIssue(data, totals);
  const paymentLink = issue ? "" : buildWifiPaymentQrPayload(data, totals);
  return {
    issue,
    paymentLink,
    qrUrl: paymentLink
      ? await QRCode.toDataURL(paymentLink, { errorCorrectionLevel: "M", margin: 4, width: 768 })
      : "",
  };
}

function billFileName(data: WifiBillData) {
  const customer = data.customerName.trim().replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 70);
  return `WiFi_Bill_${data.billMonth}_${customer || "Customer"}.pdf`;
}

function fileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read the signature image."));
    reader.readAsDataURL(file);
  });
}

function createNewWifiBill(customer?: WifiCustomer, now: Date = new Date()): WifiBillData {
  const reference = createReferenceWifiBill();
  if (!customer) return reference;
  const customerBill = resolveWifiBillDates({
    ...reference,
    ...wifiCustomerFields(customer),
    billingBarcodeValue: "",
    monthMode: "current",
  }, now);
  return { ...customerBill, paymentUpiId: syncWifiPaymentUpiId(customerBill, false) };
}

const subscribeToClient = () => () => {};

/** Read the device clock only after hydration, never the static build's date. */
export function WifiBillWorkspace() {
  const isClient = useSyncExternalStore(subscribeToClient, () => true, () => false);
  return isClient ? <WifiBillEditor /> : <div role="status" className="flex min-h-dvh items-center justify-center bg-slate-900 text-sm text-slate-300">Loading WiFi bill workspace...</div>;
}

function WifiBillEditor() {
  const [data, setData] = useState<WifiBillData>(() => createNewWifiBill());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<keyof WifiBillData, string>>>({});
  const [exportError, setExportError] = useState("");
  const [operation, setOperation] = useState<"preview" | "download" | null>(null);
  const [preview, setPreview] = useState<{ url: string; fileName: string } | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState(REFERENCE_AIRTEL_LOGO_URL);
  const [paymentLogoDataUrl, setPaymentLogoDataUrl] = useState(REFERENCE_AIRTEL_PAYMENT_LOGO_URL);
  const [defaultSignatureDataUrl, setDefaultSignatureDataUrl] = useState(REFERENCE_AIRTEL_SIGNATURE_URL);
  const [signatureUploading, setSignatureUploading] = useState(false);
  const [signatureError, setSignatureError] = useState("");
  const [signatureAssetState, setSignatureAssetState] = useState<{ source: string; dataUrl: string; error: string } | null>(null);
  const [logoError, setLogoError] = useState("");
  const [logoLoading, setLogoLoading] = useState(true);
  const [paymentQrUrl, setPaymentQrUrl] = useState("");
  const [paymentLink, setPaymentLink] = useState("");
  const [qrError, setQrError] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [savedBill, setSavedBill] = useState<{ id: string; version: number } | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState(() => wifiBillFingerprint(data));
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingBill, setLoadingBill] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveConflict, setSaveConflict] = useState(false);
  const [libraryRevision, setLibraryRevision] = useState(0);
  const saveInProgress = useRef(false);
  const clientDraftId = useRef<string | null>(null);
  const paymentUpiOverridden = useRef(false);
  const logoPromise = useRef<Promise<{ logoUrl: string; paymentLogoUrl: string; signatureUrl: string }> | null>(null);
  const pagesRef = useRef<(HTMLDivElement | null)[]>([]);
  const exportInProgress = useRef(false);
  const mounted = useRef(true);
  const totals = calculateWifiBill(data);
  const referenceOperator = usesReferenceOperator(data.providerName);
  const hasUnsavedChanges = wifiBillFingerprint(data) !== savedSnapshot;
  const signatureSource = data.issuerSignatureUrl.trim();
  const signatureDataUrl = signatureSource
    ? (signatureAssetState?.source === signatureSource && signatureAssetState.dataUrl) || defaultSignatureDataUrl
    : defaultSignatureDataUrl;
  const signatureRenderError = signatureAssetState?.source === signatureSource
    ? signatureAssetState.error
    : "";
  const signatureLoading = Boolean(
    signatureSource &&
    signatureAssetState?.source !== signatureSource,
  );
  const busy = !!operation || saving || loadingBill || signatureUploading || signatureLoading;

  const ensureLogo = useCallback(() => {
    if (!logoPromise.current) {
      setLogoLoading(true);
      setLogoError("");
      logoPromise.current = loadWifiOperator()
        .then(async (operator) => {
          const [logoUrl, paymentLogoUrl, signatureUrl] = await Promise.all([
            loadCloudImageDataUrl(operator.logoUrl!),
            loadCloudImageDataUrl(operator.paymentLogoUrl!),
            loadCloudImageDataUrl(operator.signatureUrl!),
          ]);
          return { logoUrl, paymentLogoUrl, signatureUrl };
        })
        .then((assets) => {
          if (mounted.current) {
            setLogoDataUrl(assets.logoUrl);
            setPaymentLogoDataUrl(assets.paymentLogoUrl);
            setDefaultSignatureDataUrl(assets.signatureUrl);
          }
          return assets;
        })
        .catch((error: unknown) => {
          logoPromise.current = null;
          if (mounted.current) setLogoError(error instanceof Error ? error.message : "Unable to load the operator logo.");
          throw error;
        })
        .finally(() => { if (mounted.current) setLogoLoading(false); });
    }
    return logoPromise.current;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview.url); };
  }, [preview]);

  useEffect(() => {
    if (!hasUnsavedChanges && !saving) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasUnsavedChanges, saving]);

  useEffect(() => { void ensureLogo().catch(() => {}); }, [ensureLogo]);

  useEffect(() => {
    const source = data.issuerSignatureUrl.trim();
    if (!source || signatureAssetState?.source === source) return;

    let active = true;
    loadCloudImageDataUrl(source)
      .then((embedded) => {
        if (active) setSignatureAssetState({ source, dataUrl: embedded, error: "" });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setSignatureAssetState({
          source,
          dataUrl: "",
          error: error instanceof Error ? error.message : "Unable to load the saved signature.",
        });
      });
    return () => { active = false; };
  }, [data.issuerSignatureUrl, signatureAssetState]);

  useEffect(() => {
    const refreshMonth = () => {
      if (exportInProgress.current) return;
      setData((current) => {
        if (current.monthMode !== "current") return current;
        const next = resolveWifiBillDates(current);
        return next.billMonth === current.billMonth ? current : next;
      });
    };
    refreshMonth();
    window.addEventListener("focus", refreshMonth);
    const timer = window.setInterval(refreshMonth, 60_000);
    return () => { window.removeEventListener("focus", refreshMonth); window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    let active = true;
    createPaymentQr(data).then(({ qrUrl, paymentLink: link, issue }) => {
      if (active) { setPaymentQrUrl(qrUrl); setPaymentLink(link); setQrError(issue); }
    }).catch(() => {
      if (active) {
        setPaymentQrUrl("");
        setPaymentLink("");
        setQrError("Unable to generate the payment QR. Check the payment details.");
      }
    });
    return () => { active = false; };
  }, [data]);

  const handleChange = <K extends keyof WifiBillData>(field: K, value: WifiBillData[K]) => {
    if (field === "paymentUpiId") {
      const automaticUpiId = usesReferenceOperator(data.providerName)
        ? deriveAirtelPaymentUpiId(data.accountNumber)
        : "";
      paymentUpiOverridden.current = value.trim() !== automaticUpiId;
    }
    setData((current) => {
      let next = { ...current, [field]: value };
      if ((field === "accountNumber" || field === "providerName") && !paymentUpiOverridden.current) {
        next = { ...next, paymentUpiId: syncWifiPaymentUpiId(next, false) };
      }
      return field === "billMonth" || field === "monthMode" ? resolveWifiBillDates(next) : next;
    });
    setErrors({});
    setExportError("");
  };

  const handleSignatureFileChange = async (file: File) => {
    if (signatureUploading || exportInProgress.current || saveInProgress.current) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setSignatureError("Choose a PNG, JPEG or WebP signature image.");
      return;
    }
    if (!file.size || file.size > 2 * 1024 * 1024) {
      setSignatureError("Choose a signature image no larger than 2 MB.");
      return;
    }

    setSignatureUploading(true);
    setSignatureError("");
    try {
      const upload = await uploadWifiSignature(await fileAsDataUrl(file));
      const embedded = await loadCloudImageDataUrl(upload.url);
      if (!mounted.current) return;
      setSignatureAssetState({ source: upload.url, dataUrl: embedded, error: "" });
      setData((current) => ({
        ...current,
        issuerSignatureUrl: upload.url,
        issuerSignaturePublicId: upload.publicId,
      }));
      setErrors((current) => {
        const next = { ...current };
        delete next.issuerSignatureUrl;
        delete next.issuerSignaturePublicId;
        return next;
      });
      setExportError("");
    } catch (error) {
      if (mounted.current) {
        setSignatureError(error instanceof Error ? error.message : "Unable to upload the signature image.");
      }
    } finally {
      if (mounted.current) setSignatureUploading(false);
    }
  };

  const resetSignature = () => {
    setData((current) => ({
      ...current,
      issuerSignatureUrl: "",
      issuerSignaturePublicId: "",
    }));
    setSignatureError("");
    setErrors((current) => {
      const next = { ...current };
      delete next.issuerSignatureUrl;
      delete next.issuerSignaturePublicId;
      return next;
    });
    setExportError("");
  };

  const saveDraft = async () => {
    if (saveInProgress.current || exportInProgress.current || loadingBill || signatureUploading || signatureLoading) return;
    const snapshot = resolveWifiBillDates(data);
    if (!snapshot.customerName.trim()) {
      setErrors({ customerName: "Enter a customer name to save this draft." });
      document.getElementById("wifi-customerName")?.focus();
      return;
    }
    saveInProgress.current = true;
    setSaving(true);
    setSaveError("");
    setSaveConflict(false);
    setErrors({});
    setData(snapshot);
    try {
      clientDraftId.current ??= crypto.randomUUID();
      const result = await saveWifiDraft(snapshot, customerId, savedBill, clientDraftId.current);
      if (!mounted.current) return;
      setSavedBill({ id: result.bill.id, version: result.bill.version });
      setCustomerId(result.bill.customerId);
      // Preserve edits made while this request was in flight; only this snapshot was saved.
      setSavedSnapshot(wifiBillFingerprint(result.bill.data));
      setLastSavedAt(result.bill.updatedAt);
      setLibraryRevision((current) => current + 1);
    } catch (error) {
      if (!mounted.current) return;
      setSaveError(error instanceof Error ? error.message : "Unable to save this draft.");
      if (error instanceof WifiApiError) {
        setErrors(error.errors);
        setSaveConflict(error.status === 409);
      }
    } finally {
      saveInProgress.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const confirmReplaceDraft = () => !hasUnsavedChanges || window.confirm("You have unsaved changes. Discard them and continue?");

  const openSavedBill = async (id: string) => {
    if (busy || !confirmReplaceDraft()) return;
    setLoadingBill(true);
    setSaveError("");
    try {
      const { bill } = await getWifiSavedBill(id);
      if (!mounted.current) return;
      // Reopened bills retain their saved month even when the device month changes.
      const restored = withDerivedAirtelPaymentUpiId({ ...createDefaultWifiBill(), ...bill.data, monthMode: "custom" as const });
      paymentUpiOverridden.current = Boolean(restored.paymentUpiId.trim()) && !isDerivedAirtelPaymentUpiId(restored);
      setData(restored);
      setSavedSnapshot(wifiBillFingerprint(restored));
      setSavedBill({ id: bill.id, version: bill.version });
      setCustomerId(bill.customerId);
      setLastSavedAt(bill.updatedAt);
      setErrors({});
      setSaveConflict(false);
      setExportError("");
      setPreview(null);
    } catch (error) {
      if (mounted.current) setSaveError(error instanceof Error ? error.message : "Unable to open the saved bill.");
    } finally { if (mounted.current) setLoadingBill(false); }
  };

  const exportBill = async (mode: "preview" | "download") => {
    if (exportInProgress.current || saveInProgress.current || loadingBill || signatureUploading || signatureLoading) return;
    const exportData = resolveWifiBillDates(data);
    flushSync(() => setData(exportData));
    const validationErrors = validateWifiBill(exportData);
    setErrors(validationErrors);
    setExportError("");
    const firstInvalidField = Object.keys(validationErrors)[0];
    if (firstInvalidField) {
      requestAnimationFrame(() => {
        const field = document.getElementById(`wifi-${firstInvalidField}`);
        const section = field?.closest("details");
        if (section) section.open = true;
        field?.focus();
        field?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    if (exportData.issuerSignatureUrl && signatureRenderError) {
      setExportError("The saved signature could not be loaded from cloud storage. Choose it again or use the PDF signature before generating the bill.");
      return;
    }

    exportInProgress.current = true;
    setOperation(mode);
    try {
      const [payment, logos] = await Promise.all([
        createPaymentQr(exportData),
        usesReferenceOperator(exportData.providerName)
          ? ensureLogo().catch(() => ({
              logoUrl: REFERENCE_AIRTEL_LOGO_URL,
              paymentLogoUrl: REFERENCE_AIRTEL_PAYMENT_LOGO_URL,
              signatureUrl: REFERENCE_AIRTEL_SIGNATURE_URL,
            }))
          : Promise.resolve({ logoUrl: "", paymentLogoUrl: "", signatureUrl: "" }),
      ]);
      if (!mounted.current) return;
      if (payment.issue) throw new Error(payment.issue);
      flushSync(() => {
        setPaymentQrUrl(payment.qrUrl);
        setPaymentLink(payment.paymentLink);
        if (logos.logoUrl) setLogoDataUrl(logos.logoUrl);
        if (logos.paymentLogoUrl) setPaymentLogoDataUrl(logos.paymentLogoUrl);
        if (logos.signatureUrl) setDefaultSignatureDataUrl(logos.signatureUrl);
      });
      await document.fonts.ready;
      await Promise.all(pagesRef.current.flatMap((page) => Array.from(page?.querySelectorAll("img") ?? [])).map(async (image) => {
        await image.decode();
        if (!image.naturalWidth) throw new Error("A bill image did not load. Please retry.");
      }));
      const pages = pageLabels.map((label, index) => {
        const element = pagesRef.current[index];
        if (!element) throw new Error("The bill preview is still loading. Please try again.");
        const footer = element.querySelector("footer");
        const footerTop = footer?.getBoundingClientRect().top ?? Infinity;
        const overlapsFooter = Array.from(element.children).some(
          (child) => child !== footer && child.getBoundingClientRect().bottom > footerTop,
        );
        if (overlapsFooter || element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth) {
          throw new Error(`${label} contains more content than fits on one page. Shorten the address, payment instructions, or notes and try again.`);
        }
        return { element, label };
      });
      const pdf = await buildOptimizedPdf(pages);
      pdf.setProperties({
        title: `WiFi bill - ${exportData.billMonth} - ${exportData.invoiceNumber}`,
        subject: `Account ${exportData.accountNumber}; period ${exportData.periodStart} to ${exportData.periodEnd}; due ${exportData.dueDate}`,
        author: exportData.providerName,
        keywords: `WiFi, invoice, ${exportData.billMonth}, ${exportData.invoiceNumber}`,
      });
      if (!mounted.current) return;
      const fileName = billFileName(exportData);
      if (mode === "download") {
        pdf.save(fileName);
      } else {
        setPreview({ url: URL.createObjectURL(pdf.output("blob")), fileName });
      }
    } catch (error) {
      if (mounted.current) setExportError(error instanceof Error ? error.message : "Unable to generate the bill. Please try again.");
    } finally {
      exportInProgress.current = false;
      if (mounted.current) setOperation(null);
    }
  };

  const resetBill = (customer?: WifiCustomer) => {
    if (busy || !confirmReplaceDraft()) return;
    const next = createNewWifiBill(customer);
    paymentUpiOverridden.current = false;
    setData(next);
    setSavedSnapshot(wifiBillFingerprint(next));
    clientDraftId.current = null;
    setSavedBill(null);
    setCustomerId(customer?.id || null);
    setLastSavedAt("");
    setSaveError("");
    setSaveConflict(false);
    setErrors({});
    setExportError("");
    setPreview(null);
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-900 font-sans text-slate-100">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-slate-950 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-sky-500/15 p-2.5 text-sky-400"><Wifi className="h-6 w-6" /></div>
          <div>
            <h1 className="text-lg font-bold">WiFi Bill Generator</h1>
            <p className="text-xs text-slate-400">Monthly statements, invoices & GST breakdowns</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => resetBill()} disabled={busy} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"><Plus className="h-4 w-4" />New bill</button>
          <button type="button" onClick={() => void saveDraft()} disabled={busy || (!!savedBill && !hasUnsavedChanges)} className="flex items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-500/20 disabled:opacity-50">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? "Saving..." : "Save draft"}</button>
          <button type="button" onClick={() => void exportBill("preview")} disabled={busy} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50">
            {operation === "preview" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}{operation === "preview" ? "Preparing..." : "Preview PDF"}
          </button>
          <button type="button" onClick={() => void exportBill("download")} disabled={busy} className="flex items-center gap-2 rounded-lg bg-sky-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-sky-300 disabled:opacity-50">
            {operation === "download" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{operation === "download" ? "Generating..." : "Download PDF"}
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AppSidebar workspace="wifi" isCollapsed={isSidebarCollapsed} onToggleCollapsed={() => setIsSidebarCollapsed((current) => !current)} />
        <main className="flex min-w-0 flex-1 flex-col overflow-auto xl:flex-row xl:overflow-hidden">
          <section aria-label="Bill details" className="w-full shrink-0 border-b border-slate-800 bg-slate-900/70 xl:w-[430px] xl:overflow-y-auto xl:border-r xl:border-b-0">
            <WifiBillLibrary key={`${customerId || "new"}-${libraryRevision}`} customerId={customerId} billId={savedBill?.id || null} revision={libraryRevision} disabled={busy} onOpenBill={(id) => void openSavedBill(id)} onNewBill={resetBill} />
            <div className="border-b border-slate-800 px-5 py-5">
              <h2 className="text-sm font-bold">Build your monthly bill</h2>
              <p className="mt-1.5 text-xs leading-5 text-slate-400">The visible values from the supplied August bill are prefilled. Edit any field or switch to the current month; the four-page bill updates as you type.</p>
              <p role="status" className={`mt-3 text-xs ${hasUnsavedChanges ? "text-amber-300" : "text-slate-400"}`}>
                {loadingBill ? "Opening saved bill..." : saving ? "Saving your draft..." : hasUnsavedChanges ? "Unsaved changes" : lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleString()}` : "New draft · save at any time after entering a customer name"}
              </p>
              {saveError && <div role="alert" className="mt-3 rounded-lg bg-red-950/50 p-3 text-xs text-red-300">{saveError}{saveConflict && savedBill && <button type="button" onClick={() => void openSavedBill(savedBill.id)} disabled={busy} className="mt-2 block text-sky-300 underline">Reload saved version</button>}</div>}
              <div aria-live="polite" className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-slate-700/70 bg-slate-950/70 p-3">
                <div><p className="text-[10px] text-slate-400">Taxable value</p><p className="mt-1 text-sm font-semibold">{formatMoney(totals.taxableAmount)}</p></div>
                <div><p className="text-[10px] text-slate-400">GST</p><p className="mt-1 text-sm font-semibold">{formatMoney(totals.gstTotal)}</p></div>
                <div><p className="text-[10px] text-sky-300">Amount payable</p><p className="mt-1 text-sm font-bold text-sky-300">{formatMoney(totals.totalPayable)}</p></div>
              </div>
              <div aria-live="polite" className="mt-2 rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-[10px] text-slate-400">Amount after due date</p><p className="mt-0.5 text-sm font-bold text-amber-200">{formatMoney(totals.amountAfterDueDate)}</p></div>
                  <div className="w-36">
                    <label htmlFor="wifi-lateFee" className="block text-[10px] font-medium text-slate-300">Late fee (₹)</label>
                    <input
                      id="wifi-lateFee"
                      name="lateFee"
                      type="number"
                      min={0}
                      max={9_999_999.99}
                      step={0.01}
                      value={data.lateFee.trim() ? data.lateFee : totals.lateFee.toFixed(2)}
                      onChange={(event) => handleChange("lateFee", event.target.value)}
                      disabled={busy}
                      aria-describedby="wifi-lateFee-summary-hint"
                      className="mt-1 w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-right text-xs text-slate-100 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 disabled:opacity-50"
                    />
                  </div>
                </div>
                <div id="wifi-lateFee-summary-hint" className="mt-1.5 flex items-center justify-between gap-3 text-[10px] leading-4 text-slate-400">
                  <span>18% GST: {formatMoney(totals.lateFeeGst)}</span>
                  {data.lateFee.trim() ? <button type="button" onClick={() => handleChange("lateFee", "")} disabled={busy} className="font-semibold text-sky-300 underline underline-offset-2 disabled:opacity-50">Use automatic policy</button> : <span className="text-emerald-300">Automatic policy</span>}
                </div>
              </div>
              {totals.creditBalance > 0 && <p className="mt-2 text-xs text-emerald-300">Credit balance: {formatMoney(totals.creditBalance)}</p>}
              {referenceOperator && <div className="mt-3 text-xs text-slate-400" aria-live="polite">
                {logoLoading ? "Loading cloud copies of the operator artwork..." : logoError ? <><span className="text-amber-300">Using the Airtel artwork bundled from the reference PDF.</span><button type="button" disabled={!!operation} onClick={() => void ensureLogo().catch(() => {})} className="ml-2 text-sky-300 underline">Retry cloud</button></> : "Airtel logos and signature from the reference PDF · stored in cloud"}
              </div>}
              {qrError && <p role="alert" className="mt-3 text-xs text-red-300">{qrError}</p>}
              {paymentLink && <a href={paymentLink} className="mt-3 inline-flex text-xs font-semibold text-emerald-300 underline underline-offset-2">Open payment link · {formatMoney(totals.totalPayable)} prefilled</a>}
              {Object.keys(errors).length > 0 && <p role="alert" className="mt-3 rounded-lg bg-red-950/50 p-3 text-xs text-red-300">Please correct the highlighted fields before generating your bill.</p>}
              {exportError && <p role="alert" className="mt-3 rounded-lg bg-red-950/50 p-3 text-xs text-red-300">{exportError}</p>}
            </div>
            <form className="p-5" noValidate onSubmit={(event) => { event.preventDefault(); void exportBill("download"); }}>
              <WifiBillForm
                data={data}
                errors={errors}
                onChange={handleChange}
                signaturePreviewUrl={signatureDataUrl}
                signatureUploading={signatureUploading}
                signatureError={signatureError || signatureRenderError}
                onSignatureFileChange={(file) => void handleSignatureFileChange(file)}
                onResetSignature={resetSignature}
                disabled={!!operation || loadingBill}
              />
            </form>
          </section>
          <section aria-label="Live bill preview" className="min-w-0 flex-1 bg-slate-800/40 xl:overflow-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-700 bg-slate-900/95 px-5 py-3 backdrop-blur">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300"><FileText className="h-4 w-4 text-sky-400" />Live preview</div>
              <span className="text-[10px] text-slate-400">4 A4 pages · Scroll to review</span>
            </div>
            <div className="overflow-x-auto p-4 sm:p-6">
              <WifiBillDocument data={data} logoUrl={referenceOperator ? logoDataUrl : undefined} paymentLogoUrl={referenceOperator ? paymentLogoDataUrl : undefined} signatureUrl={signatureDataUrl} paymentQrUrl={paymentQrUrl} paymentLink={paymentLink} onPageRef={(index, element) => { pagesRef.current[index] = element; }} />
            </div>
          </section>
        </main>
      </div>
      {preview && <PdfPreviewModal url={preview.url} fileName={preview.fileName} onClose={() => setPreview(null)} />}
    </div>
  );
}
