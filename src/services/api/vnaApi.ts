import { api, API_BASE } from './client'
import { getToken } from '../../utils/auth'

// G005 VNA 厂商中立归档 API (对标 Agfa / Sectra / GE Datalogue)
// Backend: /vna/* (NestJS), mock: /api/v1/vna/* (MSW)

export type VnaObjectType = 'document' | 'image'

export interface VnaObject {
  id: string
  patientId: string | null
  studyUid: string | null
  objectType: VnaObjectType
  name: string
  description: string
  mimeType: string
  size: number
  storagePath: string | null
  wormLocked: boolean
  createdAt: string
  storageSource: 'database' | 'memory'
  // [G-26] ILM 分层 (默认 hot)
  tier?: VnaLifecycleTier
}

// [G-26] ILM 影像生命周期 (VNA 分层存储: hot/warm/cold)
export type VnaLifecycleTier = 'hot' | 'warm' | 'cold'

export interface LifecyclePolicy {
  id: string
  tier: VnaLifecycleTier
  retentionDays: number
  description: string
  objectCount: number
  createdAt: string
  storageSource: 'memory'
}

export interface LifecycleEvent {
  id: string
  objectId: string
  objectName: string
  fromTier: VnaLifecycleTier
  toTier: VnaLifecycleTier | null
  action: 'migrate' | 'expire' | 'policy-applied'
  reason?: string
  createdAt: string
  storageSource: 'memory'
}

export const TIER_LABEL: Record<VnaLifecycleTier, string> = {
  hot: '热层 (SSD 在线)',
  warm: '温层 (近线 HDD)',
  cold: '冷层 (冷归档)',
}

export interface VnaStudy {
  studyUid: string
  patientId: string | null
  modality: string
  studyDescription: string
  instanceCount: number
  seriesCount: number
  createdAt: string
  storageSource: 'database' | 'memory'
}

export interface VnaStats {
  totalObjects: number
  totalSizeBytes: number
  dicomCount: number
  nonDicomCount: number
  wormLockedCount: number
  studyCount: number
  storageSource: 'database' | 'memory'
}

export interface PatientArchive {
  patientId: string
  studies: VnaStudy[]
  objects: VnaObject[]
  totalSizeBytes: number
}

export interface ListObjectsParams {
  type?: VnaObjectType | ''
  patientId?: string
  search?: string
}

// ================= [W10E-3] 扩展端点类型 (总览/趋势/分层/校验/重复分析) =================

export interface VnaOverview {
  totalObjects: number
  totalSizeBytes: number
  dicomCount: number
  nonDicomCount: number
  wormLockedCount: number
  studyCount: number
  byTier: Array<{ tier: VnaLifecycleTier; count: number; sizeBytes: number; percent: number }>
  last30dNewObjects: number
  growthRate: number
  storageSource: 'database' | 'memory'
  seeded: boolean
}

export interface VnaStorageTrendPoint {
  date: string
  label: string
  newObjects: number
  addedBytes: number
  totalSizeBytes: number
  seeded: boolean
}

export interface VnaTierStat {
  tier: VnaLifecycleTier
  tierZh: string
  count: number
  sizeBytes: number
  percent: number
  documents: number
  images: number
}

export interface VnaVerification {
  object: VnaObject
  verifiedAt: string
  checksum: string
  sizeBytes: number
  expectedSizeBytes: number
  sizeMatch: boolean
  status: 'integrity-ok' | 'size-mismatch' | 'content-missing'
}

export interface DuplicateGroup {
  name: string
  size: number
  count: number
  wastedBytes: number
  objectIds: string[]
  createdAt: string
}

export interface DuplicateAnalysis {
  totalDuplicates: number
  wastedBytes: number
  groups: DuplicateGroup[]
  seeded: boolean
}

export const vnaApi = {
  getObjects: (params: ListObjectsParams = {}) => {
    const qs = new URLSearchParams()
    if (params.type) qs.set('type', params.type)
    if (params.patientId) qs.set('patientId', params.patientId)
    if (params.search) qs.set('search', params.search)
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return api.get<VnaObject[]>(`/vna/objects${suffix}`)
  },

  getObject: (id: string) => api.get<VnaObject>(`/vna/objects/${id}`),

  createObject: (form: FormData) =>
    api.post<VnaObject>('/vna/objects', form),

  deleteObject: (id: string) => api.delete<{ deleted: boolean }>(`/vna/objects/${id}`),

  wormLock: (id: string) => api.post<VnaObject>(`/vna/objects/${id}/worm-lock`),

  getPatientArchive: (patientId: string) =>
    api.get<PatientArchive>(`/vna/patients/${encodeURIComponent(patientId)}`),

  getStats: () => api.get<VnaStats>('/vna/stats'),

  getStudies: () => api.get<VnaStudy[]>('/vna/studies'),

  /**
   * 下载/预览归档对象内容 (二进制)。mock/real 双模式均通过 fetch 获取 blob,
   * 由调用方生成 objectURL 触发下载或内嵌预览。
   */
  async downloadObject(id: string): Promise<Blob | null> {
    try {
      const token = getToken()
      const res = await fetch(`${API_BASE}/vna/objects/${id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!res.ok) return null
      return await res.blob()
    } catch {
      return null
    }
  },

  // ─────────────────────── [G-26] ILM 影像生命周期 ───────────────────────

  getLifecyclePolicies: () => api.get<LifecyclePolicy[]>('/vna/lifecycle-policies'),

  createLifecyclePolicy: (data: { tier: VnaLifecycleTier; retentionDays: number; description?: string }) =>
    api.post<LifecyclePolicy>('/vna/lifecycle-policies', data),

  updateLifecyclePolicy: (id: string, data: Partial<{ tier: VnaLifecycleTier; retentionDays: number; description?: string }>) =>
    api.post<LifecyclePolicy>(`/vna/lifecycle-policies/${id}`, data),

  deleteLifecyclePolicy: (id: string) => api.delete<{ deleted: boolean }>(`/vna/lifecycle-policies/${id}`),

  migrateObject: (id: string, targetTier: VnaLifecycleTier, reason?: string) =>
    api.post<{ object: VnaObject; event: LifecycleEvent }>(`/vna/objects/${id}/migrate`, { targetTier, reason }),

  getLifecycleEvents: (limit = 100) =>
    api.get<LifecycleEvent[]>(`/vna/lifecycle-events?limit=${limit}`),

  // ================= [W10E-3] 扩展端点 (backend vna.controller) =================

  // GET /vna/overview — 归档总览 (对象数/容量/分层分布/近30日增长率)
  getOverview: () => api.get<VnaOverview>('/vna/overview'),

  // GET /vna/storage-trend?days= — 存储增长趋势 (默认 30 日, 累计容量)
  getStorageTrend: (days = 30) =>
    api.get<VnaStorageTrendPoint[]>(`/vna/storage-trend?days=${days}`),

  // GET /vna/by-tier — 分层统计 (hot/warm/cold: 数量/容量/类型)
  getByTier: () => api.get<VnaTierStat[]>('/vna/by-tier'),

  // POST /vna/objects/:id/verify — 对象完整性校验 (SHA-256 摘要 + 尺寸比对)
  verifyObject: (id: string) => api.post<VnaVerification>(`/vna/objects/${id}/verify`, {}),

  // GET /vna/duplicate-analysis — 重复对象分析 (按 名称+尺寸 分组, 计算浪费容量)
  getDuplicateAnalysis: () => api.get<DuplicateAnalysis>('/vna/duplicate-analysis'),
}
