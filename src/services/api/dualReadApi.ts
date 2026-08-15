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
    | "pending"
    | "reader1_done"
    | "reader2_done"
    | "both_done"
    | "arbitrated"
    | "completed";
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

// [G-21 Wave3C] 双阅 → 报告自动关联
export interface DualReadReportLink {
  reportId: string;
  examId: string | null;
  state: string;
  impression: string;
  created: boolean;
}

export interface DualReadCompleteResult {
  assignment: DualReadAssignment;
  report: DualReadReportLink | null;
  created: boolean;
}

export interface DualReadReportLinkQuery {
  linked: boolean;
  report?: DualReadReportLink;
}

export const dualReadApi = {
  listAssignments: () => api.get<DualReadAssignment[]>("/dual-read/list"),

  createAssignment: (data: CreateDualReadDto) =>
    api.post<DualReadAssignment>("/dual-read/assign", data),

  arbitrate: (id: string, data: ArbitrateDto) =>
    api.post<DualReadAssignment>(`/dual-read/arbitrate/${id}`, data),

  // [Wave1B P2] 无 id 变体: POST /dual-read/arbitrate (id 由 body 携带, 后端已对齐)
  arbitrateNoId: (data: ArbitrateDto & { id: string }) =>
    api.post<DualReadAssignment>("/dual-read/arbitrate", data),

  submitReader: (id: string, data: SubmitDualReadDto) =>
    api.post<DualReadAssignment>(`/dual-read/${id}/reader`, data),

  getDiscrepancyStats: () => api.get<DualReadStats>("/dual-read/discrepancy"),

  // [G-21 Wave3C] 双阅完成 → 自动创建/关联报告, 双阅结论写入报告 impression
  complete: (id: string) =>
    api.post<DualReadCompleteResult>(`/dual-read/${id}/complete`),

  // [G-21 Wave3C] 关联报告信息查询
  getReportLink: (id: string) =>
    api.get<DualReadReportLinkQuery>(`/dual-read/${id}/report-link`),
};
