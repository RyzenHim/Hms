"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import QRCode from "qrcode";
import { Download, Eye, FileText, LoaderCircle, Plus, Save, Wifi } from "lucide-react";
import { AppSidebar } from "../AppSidebar";
import { PdfPreviewModal } from "../PdfPreviewModal";
import { PdfExportDialog } from "../PdfExportDialog";
import {
  applyPlanBasedLastPayment,
  calculateWifiBill,
  createDefaultWifiBill,
  createReferenceWifiBill,
  formatMoney,
  getBillingDates,
  resolveWifiBillDates,
  validateWifiBill,
  WIFI_INTERNET_SERVICE,
  REFERENCE_ACCOUNT_NUMBER,
} from "../../lib/wifi-bill";
import { createWifiInvoice } from "../../lib/wifi-invoice";
import { encodeCode128B } from "../../lib/code128";
import { assertWifiInvoiceReadyForExport, decodeQrModuleMatrix } from "../../lib/wifi-export-validation";
import { type PdfPageToRender } from "../../lib/pdf-export";
import { serializeVectorWifiBillPdf } from "../../lib/wifi-vector-pdf";
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
  REFERENCE_AIRTEL_DETAIL_LOGO_URL,
  REFERENCE_AIRTEL_LOGO_URL,
  REFERENCE_AIRTEL_PAYMENT_LOGO_URL,
  REFERENCE_AIRTEL_PAGE_TWO_BANNER_URL,
  REFERENCE_AIRTEL_SIGNATURE_URL,
  usesReferenceOperator,
} from "../../lib/wifi-operator";
import { getWifiBillingContext, getWifiSavedBill, saveWifiDraft, uploadWifiSignature, WifiApiError, wifiBillFingerprint, wifiCustomerFields, type WifiBillingContext, type WifiCustomer, type WifiSavedBill } from "../../lib/wifi-api";
import type { WifiBillData } from "../../types/wifi-bill";
import type { WifiInvoice } from "../../types/wifi-bill";
import { WifiBillDocument } from "./WifiBillDocument";
import { WifiBillForm } from "./WifiBillForm";
import { WifiBillLibrary } from "./WifiBillLibrary";

async function createPaymentQr(invoice: WifiInvoice) {
  const issue = getWifiPaymentQrIssue(invoice);
  const paymentLink = issue ? "" : buildWifiPaymentQrPayload(invoice);
  const qr = paymentLink ? QRCode.create(paymentLink, { errorCorrectionLevel: "M" }) : null;
  return {
    issue,
    paymentLink,
    decodedQrPayload: qr ? decodeQrModuleMatrix(qr.modules) : "",
    qrUrl: paymentLink
      ? await QRCode.toDataURL(paymentLink, { errorCorrectionLevel: "M", margin: 4, width: 768 })
      : "",
  };
}

async function embeddedImage(url: string): Promise<string> {
  if (!url || url.startsWith("data:")) return url;
  return loadCloudImageDataUrl(url);
}

function billFileName(invoice: WifiInvoice) {
  const customer = invoice.customer.name.replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 70);
  return `WiFi_Bill_${invoice.identifiers.billMonth}_${customer || "Customer"}.pdf`;
}

function fileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read the signature image."));
    reader.readAsDataURL(file);
  });
}

function clearedOlderHistory(): Partial<WifiBillData> {
  return {
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
  };
}

function inputAmount(value: number): string {
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function prepareCanonicalBill(data: WifiBillData): WifiBillData {
  const canonical = applyPlanBasedLastPayment(withDerivedAirtelPaymentUpiId({
    ...data,
    hsnSacCode: WIFI_INTERNET_SERVICE.hsnSacCode,
    hsnServiceDescription: WIFI_INTERNET_SERVICE.description,
  }));
  return {
    ...canonical,
    statementCurrentCharges: inputAmount(calculateWifiBill(canonical).totalCurrentCharges),
  };
}

function priorMonthHistory(bill: WifiSavedBill | null): Partial<WifiBillData> {
  if (!bill) return clearedOlderHistory();
  return {
    ...clearedOlderHistory(),
    // The previous bill establishes that the row exists. Its financial values
    // are rebuilt from the current plan and GST by prepareCanonicalBill, so no
    // stored financial value leaks into the displayed row.
    history1PreviousDues: "0",
    history1Payments: "0",
    history1PaymentCoupon: "0",
    history1Credits: "0",
    history1CurrentCharges: "0",
  };
}

function billFromContext(current: WifiBillData, context: WifiBillingContext, billMonth: string): WifiBillData {
  if (context.selectedBill) {
    return prepareCanonicalBill({
      ...createDefaultWifiBill(),
      ...context.selectedBill.data,
      ...wifiCustomerFields(context.customer),
      monthMode: current.monthMode,
      ...getBillingDates(billMonth),
      ...priorMonthHistory(context.previousBill),
    });
  }

  const previous = context.previousBill?.data;
  return prepareCanonicalBill({
    ...current,
    ...wifiCustomerFields(context.customer),
    ...getBillingDates(billMonth),
    invoiceNumber: "",
    statementCurrentCharges: "",
    paymentDate: previous?.dueDate || "",
    paymentMethod: previous?.paymentMethod || "Payment received",
    ...priorMonthHistory(context.previousBill),
  });
}

function createNewWifiBill(customer?: WifiCustomer, now: Date = new Date()): WifiBillData {
  const reference = createReferenceWifiBill();
  if (!customer) return reference;
  const customerBill = resolveWifiBillDates({
    ...reference,
    ...clearedOlderHistory(),
    ...wifiCustomerFields(customer),
    monthMode: "current",
    invoiceNumber: "",
    statementCurrentCharges: "",
    paymentDate: "",
    paymentMethod: "",
  }, now);
  return prepareCanonicalBill({ ...customerBill, paymentUpiId: syncWifiPaymentUpiId(customerBill, false) });
}

function applyReferenceMonthContext(data: WifiBillData): WifiBillData {
  if (data.accountNumber.trim() !== REFERENCE_ACCOUNT_NUMBER) return data;
  try {
    const stored = createReferenceWifiBill(data.billMonth);
    return {
      ...data,
      invoiceNumber: stored.invoiceNumber,
      paymentDate: stored.paymentDate,
      paymentMethod: stored.paymentMethod,
      statementCurrentCharges: stored.statementCurrentCharges,
      history1PreviousDues: stored.history1PreviousDues,
      history1Payments: stored.history1Payments,
      history1PaymentCoupon: stored.history1PaymentCoupon,
      history1Credits: stored.history1Credits,
      history1CurrentCharges: stored.history1CurrentCharges,
      history2PreviousDues: stored.history2PreviousDues,
      history2Payments: stored.history2Payments,
      history2PaymentCoupon: stored.history2PaymentCoupon,
      history2Credits: stored.history2Credits,
      history2CurrentCharges: stored.history2CurrentCharges,
      history3PreviousDues: stored.history3PreviousDues,
      history3Payments: stored.history3Payments,
      history3PaymentCoupon: stored.history3PaymentCoupon,
      history3Credits: stored.history3Credits,
      history3CurrentCharges: stored.history3CurrentCharges,
    };
  } catch {
    return {
      ...data,
      invoiceNumber: "",
      paymentDate: "",
      paymentMethod: "",
      statementCurrentCharges: "",
      ...clearedOlderHistory(),
    };
  }
}

const subscribeToClient = () => () => {};

/** Read the device clock only after hydration, never the static build's date. */
function serializeWifiPdfBlob(pdf: import("jspdf").jsPDF): Blob {
  return new Blob([new Uint8Array(serializeVectorWifiBillPdf(pdf))], { type: "application/pdf" });
}

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
  const [exportRequest, setExportRequest] = useState<{ pages: PdfPageToRender[]; fileName: string; mode: "preview" | "download" } | null>(null);
  const getExportPages = useCallback(() => exportRequest?.pages ?? [], [exportRequest]);
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
  const billingContextRequest = useRef(0);
  const mounted = useRef(true);
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
  const companyPresentation = useMemo(() => ({
    logoUrl: referenceOperator ? logoDataUrl : "",
    detailLogoUrl: referenceOperator ? REFERENCE_AIRTEL_DETAIL_LOGO_URL : "",
    paymentLogoUrl: referenceOperator ? paymentLogoDataUrl : "",
    signatureUrl: signatureSource || referenceOperator ? signatureDataUrl : "",
    pageTwoBannerUrl: referenceOperator ? REFERENCE_AIRTEL_PAGE_TWO_BANNER_URL : "",
    paymentAppName: referenceOperator ? "Airtel Thanks App" : "",
    paymentPortalUrl: referenceOperator ? "https://www.airtel.in/pay" : "",
  }), [logoDataUrl, paymentLogoDataUrl, referenceOperator, signatureDataUrl, signatureSource]);
  const createdBill = useMemo(() => createWifiInvoice(data, companyPresentation), [companyPresentation, data]);
  const totals = createdBill.calculations;
  const busy = !!operation || saving || loadingBill || signatureUploading || signatureLoading;

  const ensureLogo = useCallback(() => {
    if (!logoPromise.current) {
      setLogoLoading(true);
      setLogoError("");
      logoPromise.current = loadWifiOperator()
        .then(async (operator) => {
          const [logoUrl, paymentLogoUrl, signatureUrl] = await Promise.all([
            loadCloudImageDataUrl(REFERENCE_AIRTEL_LOGO_URL),
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
    if (!customerId || !/^\d{4}-(0[1-9]|1[0-2])$/.test(data.billMonth)) return;
    const requestId = ++billingContextRequest.current;
    let active = true;
    const request = Promise.resolve().then(() => {
      if (!active || !mounted.current || billingContextRequest.current !== requestId) return null;
      setLoadingBill(true);
      setSaveError("");
      return getWifiBillingContext(customerId, data.billMonth);
    });
    void request
      .then((context) => {
        if (!context || !active || !mounted.current || billingContextRequest.current !== requestId) return;
        const restored = billFromContext(data, context, data.billMonth);
        setData(restored);
        if (context.selectedBill) {
          setSavedBill({ id: context.selectedBill.id, version: context.selectedBill.version });
          setSavedSnapshot(wifiBillFingerprint(restored));
          setLastSavedAt(context.selectedBill.updatedAt);
        } else {
          setSavedBill(null);
          setSavedSnapshot(wifiBillFingerprint(restored));
          setLastSavedAt("");
          clientDraftId.current = null;
        }
        paymentUpiOverridden.current = Boolean(restored.paymentUpiId.trim()) && !isDerivedAirtelPaymentUpiId(restored);
        setErrors({});
        setSaveConflict(false);
        setExportError("");
        setPreview(null);
      })
      .catch((error: unknown) => {
        if (active && mounted.current && billingContextRequest.current === requestId) {
          setSaveError(error instanceof Error ? error.message : "Unable to load the selected month's stored billing record.");
        }
      })
      .finally(() => {
        if (active && mounted.current && billingContextRequest.current === requestId) setLoadingBill(false);
      });
    return () => { active = false; };
    // Reload only when the account or selected month changes. Plan edits must
    // never trigger a historical-record refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, data.billMonth]);

  useEffect(() => {
    let active = true;
    createPaymentQr(createdBill).then(({ qrUrl, paymentLink: link, issue }) => {
      if (active) { setPaymentQrUrl(qrUrl); setPaymentLink(link); setQrError(issue); }
    }).catch(() => {
      if (active) {
        setPaymentQrUrl("");
        setPaymentLink("");
        setQrError("Unable to generate the payment QR. Check the payment details.");
      }
    });
    return () => { active = false; };
  }, [createdBill]);

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
      if (field === "billMonth" || field === "monthMode") {
        next = resolveWifiBillDates(next);
        if (!customerId) next = applyReferenceMonthContext(next);
      }
      return field === "rentalAmount" || field === "billMonth" || field === "monthMode"
        ? applyPlanBasedLastPayment(next)
        : next;
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
    const snapshot = prepareCanonicalBill(resolveWifiBillDates(data));
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
      const restored = prepareCanonicalBill({
        ...createDefaultWifiBill(),
        ...result.bill.data,
        ...wifiCustomerFields(result.customer),
        monthMode: snapshot.monthMode,
      });
      setData(restored);
      setSavedBill({ id: result.bill.id, version: result.bill.version });
      setCustomerId(result.bill.customerId);
      setSavedSnapshot(wifiBillFingerprint(restored));
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
      const restored = prepareCanonicalBill({ ...createDefaultWifiBill(), ...bill.data, monthMode: "custom" as const });
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
    const exportData = prepareCanonicalBill(resolveWifiBillDates(data));
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
      const logos = await (usesReferenceOperator(exportData.providerName)
          ? ensureLogo().catch(() => ({
              logoUrl: REFERENCE_AIRTEL_LOGO_URL,
              paymentLogoUrl: REFERENCE_AIRTEL_PAYMENT_LOGO_URL,
              signatureUrl: REFERENCE_AIRTEL_SIGNATURE_URL,
            }))
          : Promise.resolve({ logoUrl: "", paymentLogoUrl: "", signatureUrl: "" }));
      if (!mounted.current) return;
      const [embeddedLogo, embeddedDetailLogo, embeddedPaymentLogo, embeddedSignature, pageTwoBannerDataUrl] = await Promise.all([
        embeddedImage(logos.logoUrl),
        usesReferenceOperator(exportData.providerName)
          ? embeddedImage(REFERENCE_AIRTEL_DETAIL_LOGO_URL)
          : embeddedImage(logos.logoUrl),
        embeddedImage(logos.paymentLogoUrl),
        embeddedImage(signatureSource ? signatureDataUrl : logos.signatureUrl),
        usesReferenceOperator(exportData.providerName)
          ? embeddedImage(REFERENCE_AIRTEL_PAGE_TWO_BANNER_URL)
          : Promise.resolve(""),
      ]);
      const exportInvoice = createWifiInvoice(exportData, {
        logoUrl: embeddedLogo,
        detailLogoUrl: embeddedDetailLogo,
        paymentLogoUrl: embeddedPaymentLogo,
        signatureUrl: embeddedSignature,
        pageTwoBannerUrl: pageTwoBannerDataUrl,
        paymentAppName: usesReferenceOperator(exportData.providerName) ? "Airtel Thanks App" : "",
        paymentPortalUrl: usesReferenceOperator(exportData.providerName) ? "https://www.airtel.in/pay" : "",
      });
      const payment = await createPaymentQr(exportInvoice);
      if (payment.issue) throw new Error(payment.issue);
      assertWifiInvoiceReadyForExport(exportInvoice, {
        qrPayload: payment.paymentLink,
        decodedQrPayload: payment.decodedQrPayload,
        barcodeModules: encodeCode128B(exportInvoice.barcodeValue).modules,
      });
      flushSync(() => {
        setPaymentQrUrl(payment.qrUrl);
        setPaymentLink(payment.paymentLink);
        if (logos.logoUrl) setLogoDataUrl(logos.logoUrl);
        if (logos.paymentLogoUrl) setPaymentLogoDataUrl(logos.paymentLogoUrl);
        if (logos.signatureUrl) setDefaultSignatureDataUrl(logos.signatureUrl);
      });
      const pages = pagesRef.current.map((element, index) => {
        if (!element) throw new Error(`Wi-Fi bill preview page ${index + 1} is not ready for PDF export.`);
        return { element, label: `Wi-Fi bill page ${index + 1}` };
      });
      if (!mounted.current) return;
      setExportRequest({ pages, fileName: billFileName(exportInvoice), mode });
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
              <WifiBillDocument invoice={createdBill} paymentQrUrl={paymentQrUrl} paymentLink={paymentLink} onPageRef={(index, element) => { pagesRef.current[index] = element; }} />
            </div>
          </section>
        </main>
      </div>
      {exportRequest && <PdfExportDialog
        getPages={getExportPages}
        fileName={exportRequest.fileName}
        initialAction={exportRequest.mode}
        serialize={serializeWifiPdfBlob}
        onClose={() => setExportRequest(null)}
        onPreview={setPreview}
      />}
      {preview && <PdfPreviewModal url={preview.url} fileName={preview.fileName} onClose={() => setPreview(null)} />}
    </div>
  );
}
