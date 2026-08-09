import { api } from './client'

export interface AuditLogDto {
  id: string
  userId: string
  action: string
  resource: string
  details?: string
  ip?: string
  createdAt: string
  // [W2-C] 详情 Drawer 补充字段 (后端 AuditLog / MSW 均有返回)
  username?: string
  userRole?: string
  resourceId?: string
  status?: 'SUCCESS' | 'FAILURE' | 'DENIED'
  userAgent?: string
}

export interface AuditListParams {
  page?: number
  pageSize?: number
  userId?: string
  action?: string
  resource?: string
  startDate?: string
  endDate?: string
}

export interface AuditStatsDto {
  total: number
  last24h: number
}

export interface AuditListResponse {
  items: AuditLogDto[]
  total: number
  page: number
  pageSize: number
}

export interface BackupDto {
  id: string
  type: string
  status: string
  filePath?: string
  sizeBytes?: number
  createdBy: string
  createdAt: string
}

export interface BackupListParams {
  page?: number
  pageSize?: number
  type?: string
}

// [W3-B] 临床配置持久化 (7 模块: gradingScales/aiModels/imagingDevices/kpiThresholds/reportTemplates/findingsLexicon/iolFormulas)
export interface ClinicalConfigDto {
  modules: Record<string, unknown> | null
  updatedAt: string | null
}

export const clinicalConfigApi = {
  get: () => api.get<ClinicalConfigDto>('/system/clinical-config'),

  saveAll: (modules: Record<string, unknown>) =>
    api.put<ClinicalConfigDto>('/system/clinical-config', { modules }),

  saveModule: (key: string, module: unknown) =>
    api.put<{ module: unknown; updatedAt: string }>(`/system/clinical-config/${encodeURIComponent(key)}`, { module }),
}

export const auditApi = {
  list: (params?: AuditListParams) => {
    const query = new URLSearchParams()
    if (params?.page != null) query.set('page', String(params.page))
    if (params?.pageSize != null) query.set('pageSize', String(params.pageSize))
    if (params?.userId) query.set('userId', params.userId)
    if (params?.action) query.set('action', params.action)
    if (params?.resource) query.set('resource', params.resource)
    if (params?.startDate) query.set('startDate', params.startDate)
    if (params?.endDate) query.set('endDate', params.endDate)
    const qs = query.toString()
    return api.get<AuditListResponse>(`/audit${qs ? '?' + qs : ''}`)
  },

  stats: () =>
    api.get<AuditStatsDto>('/audit/stats'),

  // [W2-C] 审计记录详情 (AuditPage Drawer)
  getById: (id: string) =>
    api.get<AuditLogDto>(`/audit/${encodeURIComponent(id)}`),

  // 导出 CSV（后端 GET /audit/export 返回 text/csv，需按 blob 下载）
  // [W1-B] 去重: 与 services/api/auditApi.ts 的 auditApi.export 为同一后端端点(重复封装)。
  // 保留本方法供 AuditPage 使用(import 兼容), 实现委托给 auditApi.export, 避免双实现漂移。
  async exportCsv(params?: AuditListParams): Promise<Blob> {
    const { auditApi: auditExportApi } = await import('./auditApi')
    return auditExportApi.export((params ?? {}) as Parameters<typeof auditExportApi.export>[0])
  },
}

export const backupApi = {
  create: (type: string) =>
    api.post<BackupDto>(`/backup?type=${type}`),

  list: (params?: BackupListParams) => {
    const query = new URLSearchParams()
    if (params?.page != null) query.set('page', String(params.page))
    if (params?.pageSize != null) query.set('pageSize', String(params.pageSize))
    if (params?.type) query.set('type', params.type)
    const qs = query.toString()
    return api.get<BackupDto[]>(`/backup${qs ? '?' + qs : ''}`)
  },

  download: (id: string) =>
    api.get<Blob>(`/backup/${id}/download`),

  restore: (id: string) =>
    api.post<void>(`/backup/${id}/restore`),
}
