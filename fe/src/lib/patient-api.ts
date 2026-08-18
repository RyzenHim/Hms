import { stripImageFields } from "./report-utils";
import type { PatientListItem, ReportData } from "../types/report";

export interface SavedPatient {
  _id: string;
  patientDetails: Partial<ReportData>;
  stampConfiguration?: string | null;
}

type ApiResult<T> = T & { message?: string };

const apiBaseUrl = () =>
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/$/, "");

const readResponse = async <T>(response: Response): Promise<ApiResult<T>> => {
  const result = (await response.json().catch(() => ({}))) as ApiResult<T>;
  if (!response.ok) throw new Error(result.message || "The patient request failed.");
  return result;
};

export const listPatients = async (): Promise<PatientListItem[]> => {
  const response = await fetch(`${apiBaseUrl()}/api/patients`);
  const result = await readResponse<{ patients?: PatientListItem[] }>(response);
  return result.patients || [];
};

export const getPatient = async (patientId: string): Promise<SavedPatient> => {
  const response = await fetch(`${apiBaseUrl()}/api/patients/${patientId}`);
  const result = await readResponse<{ patient?: SavedPatient }>(response);
  if (!result.patient) throw new Error("Patient details were not returned.");
  return result.patient;
};

export const savePatient = async (
  patientDetails: ReportData,
  patientId: string | null,
): Promise<{ id: string; message: string }> => {
  const { dischargeSummaryStamps, ...reportDetails } = patientDetails;
  const response = await fetch(
    patientId
      ? `${apiBaseUrl()}/api/patients/${patientId}`
      : `${apiBaseUrl()}/api/patients`,
    {
      method: patientId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientDetails: stripImageFields(reportDetails),
        stampConfiguration: { stamps: dischargeSummaryStamps },
      }),
    },
  );
  const result = await readResponse<{
    patient?: { id?: string; _id?: string };
  }>(response);
  const id = result.patient?.id || result.patient?._id || patientId;
  if (!id) throw new Error("The saved patient identifier was not returned.");
  return { id, message: result.message || "Patient details saved successfully." };
};

export const removePatient = async (patientId: string): Promise<void> => {
  const response = await fetch(`${apiBaseUrl()}/api/patients/${patientId}`, {
    method: "DELETE",
  });
  await readResponse<Record<string, never>>(response);
};
