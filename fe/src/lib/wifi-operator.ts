import { apiErrorMessage, wifiApi } from "./api.ts";

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

// The supplied SVG wordmark and reference-PDF artwork are bundled locally so
// preview and PDF export also work when the optional cloud copy is unavailable.
export const REFERENCE_AIRTEL_LOGO_URL = "/wifi/airtel-logo.svg";
export const REFERENCE_AIRTEL_PAYMENT_LOGO_URL = "/wifi/airtel-payments-bank-logo.png";
export const REFERENCE_AIRTEL_SIGNATURE_URL = "/wifi/airtel-signature.png";
export const REFERENCE_AIRTEL_DETAIL_LOGO_URL = REFERENCE_AIRTEL_LOGO_URL;
export const REFERENCE_AIRTEL_PAGE_TWO_BANNER_URL = "/wifi/airtel-page-two-banner.jpg";

export function usesReferenceOperator(providerName: string): boolean {
  return /^(?:(?:bharti\s+)?airtel|bharti\s+hexacom)(?:\s+(?:limited|ltd\.?))?$/i.test(providerName.trim());
}

/** Only bundled operator artwork is uploaded; bill/customer data stays local. */
export async function loadWifiOperator(): Promise<WifiOperator> {
  const request = async (method: "GET" | "POST") => {
    try {
      const path = method === "POST" ? "/operator/logo" : "/operator";
      const response = method === "POST"
        ? await wifiApi.post<WifiOperator>(path)
        : await wifiApi.get<WifiOperator>(path);
      return response.data;
    } catch (error) {
      throw new Error(apiErrorMessage(error, "Unable to load the operator logo."));
    }
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
