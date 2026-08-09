// Print API — DICOM 胶片打印子系统
// [G005 Wave1B] 后端已实现 print.controller (jobs/queues/history/printers/stats + cancel/retry/reprint),
// 数据由 Prisma/内存队列支撑; MSW printHandlers 仅作 mock 模式演示兜底。
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
  aet?: string
  host?: string
  port?: number
  mediumTypes?: string[]
  filmsPerHour?: number
}

export interface PrinterInput {
  name: string
  type?: string
  status?: 'online' | 'offline'
  location?: string
  filmSpec?: string
  defaultCopies?: number
  dpi?: number
  aet?: string
  host?: string
  port?: number
  mediumTypes?: string[]
  filmsPerHour?: number
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
  // [G005 Wave1A P0] 打印任务列表 (后端 GET /print/jobs?status=)
  listJobs: (status?: PrintTaskStatus) =>
    api.get<PrintTaskDto[]>(`/print/jobs${status ? `?status=${encodeURIComponent(status)}` : ''}`),

  // [G005 Wave1A P0] 打印任务详情 (后端 GET /print/jobs/:id)
  getJob: (id: string) =>
    api.get<PrintTaskDto>(`/print/jobs/${encodeURIComponent(id)}`),

  // [G005 Wave1A P0] 打印队列 (后端 GET /print/queues, 排队中/打印中)
  listQueues: () =>
    api.get<PrintTaskDto[]>('/print/queues'),

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

  // [G005 Wave1A P0] 重新打印 (后端 POST /print/jobs/:id/reprint, 新建任务)
  reprintJob: async (id: string) => {
    const res = await api.post<PrintTaskDto>(`/print/jobs/${id}/reprint`)
    await invalidateApiCacheByPrefix('/print')
    return res
  },

  // [G005 Wave2A P0] 打印机 CRUD (后端 POST/PUT/DELETE /print/printers)
  createPrinter: async (data: PrinterInput) => {
    const res = await api.post<PrinterDto>('/print/printers', data)
    await invalidateApiCacheByPrefix('/print')
    return res
  },

  updatePrinter: async (id: string, data: Partial<PrinterInput>) => {
    const res = await api.put<PrinterDto>(`/print/printers/${encodeURIComponent(id)}`, data)
    await invalidateApiCacheByPrefix('/print')
    return res
  },

  deletePrinter: async (id: string) => {
    const res = await api.delete<{ ok: boolean }>(`/print/printers/${encodeURIComponent(id)}`)
    await invalidateApiCacheByPrefix('/print')
    return res
  },
}

export default printApi
