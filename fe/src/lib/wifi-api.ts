import type { WifiBillData, WifiBillErrors } from "../types/wifi-bill";
import { apiErrorDetails, hospitalApi, wifiApi } from "./api.ts";

export interface WifiCustomerSummary {
  id: string;
  name: string;
  accountNumber: string;
  updatedAt: string;
}

export interface WifiCustomer extends WifiCustomerSummary {
  addressLine1: string;
  city: string;
  postalCode: string;
  email: string;
  phone: string;
  gstin: string;
  state: string;
  stateCode: string;
  wifiId: string;
  fixedlineNumber: string;
  paymentUpiId: string;
  createdAt: string;
}

export interface WifiSavedBillSummary {
  id: string;
  customerId: string;
  invoiceNumber: string;
  billMonth: string;
  version: number;
  updatedAt: string;
}

export interface WifiSavedBill extends Omit<WifiSavedBillSummary, "invoiceNumber" | "billMonth"> {
  data: WifiBillData;
  createdAt: string;
}

export interface WifiBillingContext {
  customer: WifiCustomer;
  selectedBill: WifiSavedBill | null;
  previousBill: WifiSavedBill | null;
  monthlyRecords: WifiSavedBill[];
}

export interface WifiSignatureUpload {
  url: string;
  publicId: string;
  width: number;
  height: number;
  existing: boolean;
}

export class WifiApiError extends Error {
  status: number;
  errors: WifiBillErrors;
  constructor(message: string, status: number, errors: WifiBillErrors = {}) {
    super(message);
    this.name = "WifiApiError";
    this.status = status;
    this.errors = errors;
  }
}

async function request<T>(path: string, method: "GET" | "POST" | "PUT" = "GET", data?: unknown): Promise<T> {
  try {
    const response = await wifiApi.request<T>({ url: path, method, data });
    return response.data;
  } catch (error) {
    const details = apiErrorDetails(error);
    const body = details.data as { errors?: WifiBillErrors } | undefined;
    throw new WifiApiError(
      details.message || "Unable to access saved WiFi bills.",
      details.status ?? 0,
      body?.errors,
    );
  }
}

export const listWifiCustomers = () => request<{ customers: WifiCustomerSummary[] }>("/customers");
export const getWifiCustomer = (id: string) => request<{ customer: WifiCustomer; bills: WifiSavedBillSummary[] }>(`/customers/${encodeURIComponent(id)}`);
export const getWifiSavedBill = (id: string) => request<{ bill: WifiSavedBill }>(`/bills/${encodeURIComponent(id)}`);
export const getWifiBillingContext = (customerId: string, billMonth: string) =>
  request<WifiBillingContext>(`/customers/${encodeURIComponent(customerId)}/billing-context/${encodeURIComponent(billMonth)}`);

export async function uploadWifiSignature(dataUrl: string): Promise<WifiSignatureUpload> {
  let result: Partial<WifiSignatureUpload>;
  try {
    result = (await hospitalApi.post<Partial<WifiSignatureUpload>>(
      "/uploads/images",
      { dataUrl, assetType: "wifi-signature" },
      { timeout: 30_000 },
    )).data;
  } catch (error) {
    const details = apiErrorDetails(error);
    throw new WifiApiError(
      details.message || "Unable to upload the signature image.",
      details.status ?? 0,
    );
  }
  if (!result.url || !result.publicId) {
    throw new WifiApiError("Cloud storage returned an incomplete signature reference.", 502);
  }
  return result as WifiSignatureUpload;
}

export const saveWifiDraft = (data: WifiBillData, customerId: string | null, existing: { id: string; version: number } | null, clientDraftId: string) =>
  request<{ bill: WifiSavedBill; customer: WifiCustomer }>(
    existing ? `/bills/${encodeURIComponent(existing.id)}` : "/bills",
    existing ? "PUT" : "POST",
    existing ? { data, version: existing.version } : { data, clientDraftId, ...(customerId ? { customerId } : {}) },
  );

const numericFields = new Set([
  "connections", "rentalAmount", "discount", "otherCharges", "gstRate",
  "previousBalance", "paymentReceived", "paymentCoupon", "credits", "statementCurrentCharges",
  "creditLimit", "securityDeposit", "lateFee",
  "history1PreviousDues", "history1Payments", "history1PaymentCoupon", "history1Credits", "history1CurrentCharges",
  "history2PreviousDues", "history2Payments", "history2PaymentCoupon", "history2Credits", "history2CurrentCharges",
  "history3PreviousDues", "history3Payments", "history3PaymentCoupon", "history3Credits", "history3CurrentCharges",
]);

/** Compare editable strings to normalized DB decimals without false dirty states. */
export function wifiBillFingerprint(data: WifiBillData): string {
  return JSON.stringify(Object.entries(data).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => {
    const trimmed = value.trim();
    return [key, numericFields.has(key) && /^-?\d+(?:\.\d{1,2})?$/.test(trimmed) ? String(Number(trimmed)) : trimmed];
  }));
}

export function wifiCustomerFields(customer: WifiCustomer): Partial<WifiBillData> {
  return {
    customerName: customer.name,
    customerAddressLine1: customer.addressLine1,
    customerCity: customer.city,
    customerPostalCode: customer.postalCode,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    customerGstin: customer.gstin,
    customerState: customer.state,
    customerStateCode: customer.stateCode,
    accountNumber: customer.accountNumber,
    wifiId: customer.wifiId,
    fixedlineNumber: customer.fixedlineNumber,
    paymentUpiId: customer.paymentUpiId || "",
  };
}
