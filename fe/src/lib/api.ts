import axios from "axios";

const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080")
  .replace(/\/+$/, "");

export const hospitalApi = axios.create({
  baseURL: `${apiOrigin}/api`,
});

export const wifiApi = axios.create({
  baseURL: `${apiOrigin}/api/wifi`,
  timeout: 30_000,
});

export function apiErrorDetails(error: unknown): {
  message?: string;
  status?: number;
  data?: unknown;
} {
  if (!axios.isAxiosError(error)) return {};
  const { response } = error;
  const data = response?.data;
  const message =
    typeof data === "object" && data !== null && "message" in data &&
    typeof data.message === "string"
      ? data.message
      : undefined;
  return { message, status: response?.status, data };
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  return apiErrorDetails(error).message || fallback;
}
