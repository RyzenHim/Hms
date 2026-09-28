import type { PatientListItem, ReportData, Stamp } from "../types/report";

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

export const uploadDocumentImage = async (
  dataUrl: string,
  assetType: string,
): Promise<{ url: string; publicId: string }> => {
  const response = await fetch(`${apiBaseUrl()}/api/uploads/images`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl, assetType }),
  });
  const result = await readResponse<{ url?: string; publicId?: string }>(
    response,
  );
  if (!result.url || !result.publicId) {
    throw new Error("Cloudinary did not return an image URL.");
  }
  return { url: result.url, publicId: result.publicId };
};

export const deleteDocumentImage = async ({
  imageUrl,
  publicId,
  patientId,
}: {
  imageUrl: string;
  publicId?: string;
  patientId?: string | null;
}): Promise<void> => {
  const response = await fetch(`${apiBaseUrl()}/api/uploads/images`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl, publicId, patientId }),
  });
  await readResponse<Record<string, never>>(response);
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
        patientDetails: reportDetails,
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

export const saveStampConfiguration = async (
  patientId: string,
  stamps: Stamp[],
): Promise<{ stamps: Stamp[]; message: string; placementCount: number }> => {
  const response = await fetch(
    `${apiBaseUrl()}/api/patients/${patientId}/stamps`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stamps }),
    },
  );
  const result = await readResponse<{
    stamps?: Stamp[];
    placementCount?: number;
  }>(response);
  if (!Array.isArray(result.stamps)) {
    throw new Error("Saved stamp settings were not returned.");
  }
  return {
    stamps: result.stamps,
    message: result.message || "Stamp settings saved successfully.",
    placementCount: result.placementCount ?? 0,
  };
};

export const removePatient = async (patientId: string): Promise<void> => {
  const response = await fetch(`${apiBaseUrl()}/api/patients/${patientId}`, {
    method: "DELETE",
  });
  await readResponse<Record<string, never>>(response);
};
