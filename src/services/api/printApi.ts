// Print API — DICOM 胶片打印子系统
// [v3.0.6.11-81] W2-B: 后端无 print controller → MSW printHandlers (演示数据) + 页面标注
import { api, invalidateApiCacheByPrefix } from './client'

export type PrintTaskStatus = 'queued' | 'printing' | 'completed' | 'failed'

export interface PrintTaskDto {
  id: string
  filmId?: string
  patientId?: string
  patientName: string
  modality?: string
  studyType?: string
  filmSpec?: string
  copies?: number
  status: PrintTaskStatus
  printer?: string
  submitTime: string
  completeTime?: string | null
  progress?: number
  errorMsg?: string
}

export interface PrinterDto {
  id: string
  name: string
  type?: string
  status: 'online' | 'offline'
  location?: string
  filmSpec?: string
  defaultCopies?: number
  dpi?: number
}

export interface FilmUsageDay {
  date: string
  films14x17: number
  films10x12: number
  films8x10: number
  total: number
  cost: number
}

export interface DevicePrintStat {
  device: string
  printCount: number
  totalFilms: number
  cost: number
}

export interface PrintStatsDto {
  filmUsage: FilmUsageDay[]
  devicePrint: DevicePrintStat[]
  costReport: Array<{ date: string; filmCost: number; paperCost: number; inkCost: number; total: number }>
}

export const printApi = {
  listQueue: () =>
    api.get<PrintTaskDto[]>('/print/queue'),

  listHistory: () =>
    api.get<PrintTaskDto[]>('/print/history'),

  listPrinters: () =>
    api.get<PrinterDto[]>('/print/printers'),

  getStats: () =>
    api.get<PrintStatsDto>('/print/stats'),

  createJob: async (data: Partial<PrintTaskDto>) => {
    const res = await api.post<PrintTaskDto>('/print/jobs', data)
    await invalidateApiCacheByPrefix('/print')
    return res
  },

  cancelJob: async (id: string) => {
    const res = await api.post<{ ok: boolean }>(`/print/jobs/${id}/cancel`)
    await invalidateApiCacheByPrefix('/print')
    return res
  },

  retryJob: async (id: string) => {
    const res = await api.post<{ ok: boolean }>(`/print/jobs/${id}/retry`)
    await invalidateApiCacheByPrefix('/print')
    return res
  },
}

export default printApi
