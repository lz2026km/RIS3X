import { api, invalidateApiCache, invalidateApiCacheByPrefix } from "./client";

export interface RadPathCreateDto {
  reportId: string;
  pathologyId: string;
  radFinding: string;
  pathResult: string;
  consistency: "concordant" | "discordant" | "pending";
  notes?: string;
}

export interface RadPathUpdateConsistencyDto {
  id: string;
  consistency: "concordant" | "discordant" | "pending";
  notes?: string;
}

export interface RadPathRecord {
  id: string;
  reportId: string;
  pathologyId: string;
  radFinding: string;
  pathResult: string;
  consistency: "concordant" | "discordant" | "pending";
  notes?: string;
  createdAt: string;
  report: {
    id: string;
    findings: string;
    conclusion: string;
    signedAt?: string;
    patient: { name: string; gender: string; birthDate?: string };
    exam?: { modality: string; bodyPart: string; accessionNumber: string };
  };
}

export interface RadPathStats {
  total: number;
  concordant: number;
  discordant: number;
  pending: number;
  positiveConsistency: number;
  trend: Array<{ month: string; rate: number }>;
}

export const radpathApi = {
  create: async (dto: RadPathCreateDto) => {
    const res = await api.post<RadPathRecord>("/radpath/create", dto);
    await invalidateApiCacheByPrefix("/radpath");
    return res;
  },

  findByReport: (reportId: string) =>
    api.get<RadPathRecord>(`/radpath/report/${encodeURIComponent(reportId)}`),

  findByPathology: (pathId: string) =>
    api.get<RadPathRecord>(`/radpath/pathology/${encodeURIComponent(pathId)}`),

  getRecords: () => api.get<RadPathRecord[]>("/radpath/records"),

  matchReport: async (reportId: string, pathologyId: string) => {
    const res = await api.post<RadPathRecord>("/radpath/create", {
      reportId,
      pathologyId,
      radFinding: "",
      pathResult: "",
      consistency: "pending" as const,
    });
    await invalidateApiCacheByPrefix("/radpath");
    return res;
  },

  updateConsistency: async (dto: RadPathUpdateConsistencyDto) => {
    const res = await api.put<RadPathRecord>("/radpath/consistency", dto);
    await invalidateApiCache("/radpath/consistency");
    await invalidateApiCacheByPrefix("/radpath");
    return res;
  },

  getStats: () => api.get<RadPathStats>("/radpath/stats"),
};
