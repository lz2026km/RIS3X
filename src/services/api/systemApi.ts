import { api } from './client'

export interface AuditLogDto {
  id: string
  userId: string
  action: string
  resource: string
  details?: string
  ip?: string
  createdAt: string
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
