import { api } from './client'

export interface ExportApprovalRecordDto {
  id: string; resource: string; resourceId?: string; reason: string; status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requesterId: string; requesterName?: string; approverId?: string; approverName?: string;
  rejectReason?: string; createdAt: string; updatedAt?: string; approvedAt?: string
}
export interface ExportApprovalQueryParams { page?: number; pageSize?: number; status?: string; requesterId?: string; startDate?: string; endDate?: string }

export const exportApprovalApi = {
  list: (params?: ExportApprovalQueryParams) => {
    const sp = new URLSearchParams()
    if (params) { Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.set(k, String(v)) }) }
    return api.get<ExportApprovalRecordDto[]>(`/export-approval?${sp.toString()}`)
  },
  request: (data: { resource: string; resourceId?: string; reason: string }) => api.post<ExportApprovalRecordDto>('/export-approval', data),
  approve: (id: string) => api.post<ExportApprovalRecordDto>(`/export-approval/${id}/approve`, {}),
  reject: (id: string, reason: string) => api.post<ExportApprovalRecordDto>(`/export-approval/${id}/reject`, { reason }),
  getStats: () => api.get<{ total: number; pending: number; approved: number; rejected: number }>('/export-approval/stats'),
}
