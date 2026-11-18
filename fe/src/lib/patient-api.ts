import type { PatientListItem, ReportData, Stamp } from "../types/report";
import { apiErrorMessage, hospitalApi } from "./api.ts";

export interface SavedPatient {
  _id: string;
  patientDetails: Partial<ReportData>;
  stampConfiguration?: string | null;
}

type ApiResult<T> = T & { message?: string };

const request = async <T>(action: () => Promise<{ data: ApiResult<T> }>) => {
  try {
    return (await action()).data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, "The patient request failed."));
  }
};

export const listPatients = async (): Promise<PatientListItem[]> => {
  const result = await request(() =>
    hospitalApi.get<ApiResult<{ patients?: PatientListItem[] }>>("/patients"),
  );
  return result.patients || [];
};

export const getPatient = async (patientId: string): Promise<SavedPatient> => {
  const result = await request(() =>
    hospitalApi.get<ApiResult<{ patient?: SavedPatient }>>(`/patients/${patientId}`),
  );
  if (!result.patient) throw new Error("Patient details were not returned.");
  return result.patient;
};

export const uploadDocumentImage = async (
  dataUrl: string,
  assetType: string,
): Promise<{ url: string; publicId: string }> => {
  const result = await request(() =>
    hospitalApi.post<ApiResult<{ url?: string; publicId?: string }>>(
      "/uploads/images",
      { dataUrl, assetType },
    ),
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
  await request(() =>
    hospitalApi.delete<ApiResult<Record<string, never>>>("/uploads/images", {
      data: { imageUrl, publicId, patientId },
    }),
  );
};

export const savePatient = async (
  patientDetails: ReportData,
  patientId: string | null,
): Promise<{ id: string; message: string }> => {
  const { dischargeSummaryStamps, ...reportDetails } = patientDetails;
  const payload = {
    patientDetails: reportDetails,
    stampConfiguration: { stamps: dischargeSummaryStamps },
  };
  const result = await request(() =>
    patientId
      ? hospitalApi.put<ApiResult<{
          patient?: { id?: string; _id?: string };
        }>>(`/patients/${patientId}`, payload)
      : hospitalApi.post<ApiResult<{
          patient?: { id?: string; _id?: string };
        }>>("/patients", payload),
  );
  const id = result.patient?.id || result.patient?._id || patientId;
  if (!id) throw new Error("The saved patient identifier was not returned.");
  return { id, message: result.message || "Patient details saved successfully." };
};

export const saveStampConfiguration = async (
  patientId: string,
  stamps: Stamp[],
): Promise<{ stamps: Stamp[]; message: string; placementCount: number }> => {
  const result = await request(() =>
    hospitalApi.put<ApiResult<{
      stamps?: Stamp[];
      placementCount?: number;
    }>>(`/patients/${patientId}/stamps`, { stamps }),
  );
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
  await request(() =>
    hospitalApi.delete<ApiResult<Record<string, never>>>(`/patients/${patientId}`),
  );
};
