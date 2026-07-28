import { api, invalidateApiCache } from './client'

// DICOM Compress (DICOM 压缩) API
// Backend: /api/v1/dicom/compress/*

export interface DicomCompressTask {
  id: string
  studyInstanceUid: string
  patientName: string
  modality: string
  originalSize: number
  compressedSize?: number
  compressionRatio?: number
  algorithm: 'jpeg' | 'jpeg2000' | 'jpegls' | 'rle' | 'lossless-jpeg'
  quality?: number
  status: 'queued' | 'processing' | 'completed' | 'failed'
  error?: string
  createdAt: string
  completedAt?: string
}

export interface DicomCompressDto {
  studyInstanceUid: string
  algorithm: 'jpeg' | 'jpeg2000' | 'jpegls' | 'rle' | 'lossless-jpeg'
  quality?: number
  lossless?: boolean
}

export interface DicomCompressBatchDto {
  studyInstanceUids: string[]
  algorithm: 'jpeg' | 'jpeg2000' | 'jpegls' | 'rle' | 'lossless-jpeg'
  quality?: number
  lossless?: boolean
}

export interface DicomCompressStats {
  totalCompressed: number
  totalSavedBytes: number
  avgCompressionRatio: number
  algorithmDistribution: { algorithm: string; count: number }[]
  dailyStats: { date: string; count: number; savedBytes: number }[]
}

export const dicomCompressApi = {
  listTasks: (params?: { status?: string; algorithm?: string; page?: number; pageSize?: number }) =>
    api.get<DicomCompressTask[]>(`/dicom/compress/tasks?${new URLSearchParams(params ?? {}).toString()}`),

  getTask: (id: string) =>
    api.get<DicomCompressTask>(`/dicom/compress/tasks/${id}`),

  compress: async (data: DicomCompressDto) => {
    const res = await api.post<DicomCompressTask>('/dicom/compress', data)
    await invalidateApiCache('/dicom/compress/tasks')
    return res
  },

  batchCompress: async (data: DicomCompressBatchDto) => {
    const res = await api.post<DicomCompressTask[]>('/dicom/compress/batch', data)
    await invalidateApiCache('/dicom/compress/tasks')
    return res
  },

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

  getStats: () =>
    api.get<DicomCompressStats>('/dicom/compress/stats'),
}
