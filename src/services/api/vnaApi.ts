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
}
