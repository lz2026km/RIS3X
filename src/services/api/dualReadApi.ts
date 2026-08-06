import { api } from "./client";

// Dual Read (双阅片) API
// [v3.0.6.11-50] 路径统一: 前端 /dual-read/assignments/* → 后端 /dual-read/* (modules/dual-read.controller)
//   后端实际端点: assign / arbitrate/:id / list / discrepancy

export interface DualReadAssignment {
  id: string;
  studyId: string;
  patientName: string;
  patientId: string;
  modality: string;
  reader1Id: string;
  reader1Name: string;
  reader2Id: string;
  reader2Name: string;
  report1?: string;
  report2?: string;
  status:
    "pending" | "reader1_done" | "reader2_done" | "both_done" | "arbitrated";
  discrepancyScore?: number;
  arbitrationReport?: string;
  arbitratorId?: string;
  arbitratorName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDualReadDto {
  studyId: string;
  patientName: string;
  patientId: string;
  modality: string;
}

export interface SubmitDualReadDto {
  report: string;
  readerNumber: 1 | 2;
}

export interface ArbitrateDto {
  arbitratorId: string;
  arbitratorName: string;
  report: string;
}

export interface DualReadStats {
  totalAssignments: number;
  pendingCount: number;
  bothDoneCount: number;
  arbitratedCount: number;
  avgDiscrepancy: number;
}

export const dualReadApi = {
  listAssignments: () => api.get<DualReadAssignment[]>("/dual-read/list"),

  createAssignment: (data: CreateDualReadDto) =>
    api.post<DualReadAssignment>("/dual-read/assign", data),

  arbitrate: (id: string, data: ArbitrateDto) =>
    api.post<DualReadAssignment>(`/dual-read/arbitrate/${id}`, data),

  submitReader: (id: string, data: SubmitDualReadDto) =>
    api.post<DualReadAssignment>(`/dual-read/${id}/reader`, data),

  getDiscrepancyStats: () => api.get<DualReadStats>("/dual-read/discrepancy"),
};
