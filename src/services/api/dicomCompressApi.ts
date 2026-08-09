import { api, invalidateApiCache } from './client'

// DICOM Compress (DICOM 压缩真实化) API
// Backend: /api/v1/dicom/compress/*

export interface DicomCompressTask {
  id: string
  fileId: string
  transferSyntax: string
  status: 'pending' | 'processing' | 'done' | 'failed'
  progress: number
  originalSize: number
  compressedSize: number | null
  ratio?: number
  modality?: string
  algorithmName?: string
  lossless?: boolean
  simulated?: boolean
  elapsedMs?: number
  quality?: number
  error?: string
  createdAt: string
  updatedAt: string
}

export interface DicomCompressDto {
  fileId: string
  algorithm: 'jpeg' | 'jpeg2000' | 'jpegls' | 'rle' | 'lossless-jpeg'
  quality?: number
  lossless?: boolean
  dataBase64?: string
}

export interface DicomCompressBatchDto {
  fileIds: string[]
  algorithm: 'jpeg' | 'jpeg2000' | 'jpegls' | 'rle' | 'lossless-jpeg'
  quality?: number
  lossless?: boolean
}

export interface CompressInstance {
  fileId: string
  fileName: string
  sopInstanceUid: string
  modality: string
  seriesDescription: string
  patientName: string
  rows: number
  columns: number
  sizeBytes: number
}

export interface RatioAgg {
  algorithm: string
  algorithmName: string
  modality: string
  count: number
  avgRatio: number
  avgOriginalSize: number
  avgCompressedSize: number
  savedBytes: number
}

export interface CompressRatioStats {
  totalTasks: number
  totalSavedBytes: number
  avgRatio: number
  byAlgorithm: RatioAgg[]
  byModality: RatioAgg[]
}

export interface DicomCompressStats {
  totalTasks: number
  completedTasks: number
  failedTasks: number
  totalSavedBytes: number
  avgRatio: number
  algorithmDistribution: { algorithm: string; algorithmName: string; count: number }[]
}

// 传输语法 UID 快捷别名 (与后端 SUPPORTED_SYNTAXES 对应)
export const COMPRESS_SYNTAXES = {
  jpeg2000Lossless: '1.2.840.10008.1.2.4.90',
  jpeg2000Lossy: '1.2.840.10008.1.2.4.91',
  rle: '1.2.840.10008.1.2.5',
  jpeglsLossless: '1.2.840.10008.1.2.4.80',
  jpeglsLossy: '1.2.840.10008.1.2.4.81',
  jpegBaseline: '1.2.840.10008.1.2.4.50',
} as const

export interface CompressRatioDto {
  instanceId: string
  sopClass: string
  sopClassName: string
  originalSize: number
  compressedSize: number
  ratio: number
  transferSyntax: string
  modality?: string
  real: boolean
}

export const dicomCompressApi = {
  listInstances: () => api.get<CompressInstance[]>('/dicom/compress/instances'),

  // [G005 Wave1A P0] 单实例真实压缩比 (后端 GET /dicom/compress/ratio/:instanceId, JPEG2000 无损预测)
  getRatio: (instanceId: string) =>
    api.get<CompressRatioDto>(`/dicom/compress/ratio/${encodeURIComponent(instanceId)}`),

  getSyntaxes: () =>
    api.get<Array<{ uid: string; name: string; lossy: boolean }>>('/dicom/compress/syntaxes'),

  listTasks: (params?: { status?: string; algorithm?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.algorithm) qs.set('algorithm', params.algorithm)
    if (params?.page !== undefined) qs.set('page', String(params.page))
    if (params?.pageSize !== undefined) qs.set('pageSize', String(params.pageSize))
    return api.get<DicomCompressTask[]>(`/dicom/compress/tasks?${qs.toString()}`)
  },

  getTask: (id: string) =>
    api.get<DicomCompressTask>(`/dicom/compress/tasks/${id}`),

  getStatus: (id: string) =>
    api.get<DicomCompressTask>(`/dicom/compress/status/${id}`),

  compress: async (data: { fileId: string; transferSyntax: string; quality?: number; dataBase64?: string }) => {
    const res = await api.post<DicomCompressTask>('/dicom/compress', data)
    await invalidateApiCache('/dicom/compress/tasks')
    return res
  },

  batchCompress: async (data: { fileIds: string[]; transferSyntax: string; quality?: number }) => {
    const res = await api.post<DicomCompressTask[]>('/dicom/compress/batch', data)
    await invalidateApiCache('/dicom/compress/tasks')
    return res
  },

  decompress: async (fileId: string) => {
    const res = await api.post<DicomCompressTask>('/dicom/compress/decompress', { fileId })
    await invalidateApiCache('/dicom/compress/tasks')
    return res
  },

  getRatios: () => api.get<CompressRatioStats>('/dicom/compress/ratios'),

  getStats: () => api.get<DicomCompressStats>('/dicom/compress/stats'),

  cancelTask: async (id: string) => {
    const res = await api.post<DicomCompressTask>(`/dicom/compress/tasks/${id}/cancel`, {})
    await invalidateApiCache(`/dicom/compress/tasks/${id}`)
    return res
  },

  deleteTask: async (id: string) => {
    const res = await api.delete(`/dicom/compress/tasks/${id}`)
    await invalidateApiCache('/dicom/compress/tasks')
    return res
  },
}
