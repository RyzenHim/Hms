export interface WifiOperator {
  id: string;
  name: string;
  logoUrl: string | null;
  logoPublicId: string | null;
  paymentLogoUrl: string | null;
  paymentLogoPublicId: string | null;
  signatureUrl: string | null;
  signaturePublicId: string | null;
}

// Exact artwork extracted from the supplied reference PDF. These same-origin
// copies keep PDF export reliable when the optional cloud copy is unavailable.
export const REFERENCE_AIRTEL_LOGO_URL = "/wifi/airtel-logo.png";
export const REFERENCE_AIRTEL_PAYMENT_LOGO_URL = "/wifi/airtel-payments-bank-logo.png";
export const REFERENCE_AIRTEL_SIGNATURE_URL = "/wifi/airtel-signature.png";
export const REFERENCE_AIRTEL_DETAIL_LOGO_URL = "/wifi/airtel-page-four-logo.jpg";
export const REFERENCE_AIRTEL_PAGE_TWO_BANNER_URL = "/wifi/airtel-page-two-banner.jpg";

const apiBaseUrl = () =>
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/$/, "");

export function usesReferenceOperator(providerName: string): boolean {
  return /^(?:(?:bharti\s+)?airtel|bharti\s+hexacom)(?:\s+(?:limited|ltd\.?))?$/i.test(providerName.trim());
}

/** Only the extracted operator artwork is uploaded; bill/customer data stays local. */
export async function loadWifiOperator(): Promise<WifiOperator> {
  const request = async (method: "GET" | "POST") => {
    const response = await fetch(`${apiBaseUrl()}/api/wifi/operator${method === "POST" ? "/logo" : ""}`, {
      method,
      signal: AbortSignal.timeout(30_000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Unable to load the operator logo.");
    return result as WifiOperator;
  };
  const existing = await request("GET");
  const operator = existing.logoUrl && existing.paymentLogoUrl && existing.signatureUrl
    ? existing
    : await request("POST");
  if (!operator.logoUrl || !operator.paymentLogoUrl || !operator.signatureUrl) {
    throw new Error("The operator artwork has not been uploaded yet.");
  }
  return operator;
}

/** Embed a CORS-safe copy of a cloud image so PDF capture cannot omit it. */
export async function loadCloudImageDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { mode: "cors", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error("Unable to download the image from cloud storage.");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("Cloud storage returned an invalid image.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to prepare the image for the PDF."));
    reader.readAsDataURL(blob);
  });
}
