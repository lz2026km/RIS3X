import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

// ============================================================
// [G005 Wave1A] Print — DICOM 胶片打印模块 (进程内存 + 确定性 seed)
// 覆盖: jobs CRUD / queues / printers (Device 派生) / cancel / retry / reprint / stats
// 与前端 printApi (PrintManagementPage / DicomPrintPage) 契约对齐
// ============================================================

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

export interface PrintJobInput {
  patientName?: string
  patientId?: string
  modality?: string
  examType?: string
  studyDesc?: string
  studyType?: string
  filmSpec?: string
  copies?: number
  printer?: string
  filmId?: string
}

const SEED_PRINTERS: PrinterDto[] = [
  { id: 'P001', name: '柯尼卡 DICOM 打印机 1', type: 'network', status: 'online', location: 'CT检查室1', filmSpec: '14x17', defaultCopies: 1, dpi: 300 },
  { id: 'P002', name: '柯尼卡 DICOM 打印机 2', type: 'network', status: 'online', location: 'MR检查室', filmSpec: '14x17', defaultCopies: 1, dpi: 300 },
  { id: 'P003', name: '富士 DICOM 打印机', type: 'network', status: 'online', location: 'DR检查室', filmSpec: '10x12', defaultCopies: 1, dpi: 600 },
  { id: 'P004', name: '本地报告打印机', type: 'local', status: 'online', location: '登记台', filmSpec: 'A4', defaultCopies: 2, dpi: 600 },
  { id: 'P005', name: '激光报告打印机', type: 'local', status: 'offline', location: '诊断室1', filmSpec: 'A4', defaultCopies: 1, dpi: 1200 },
]

function seedJobs(): PrintTaskDto[] {
  const now = new Date()
  const isoAt = (offsetMin: number) => new Date(now.getTime() - offsetMin * 60000).toISOString().replace('T', ' ').slice(0, 19)
  return [
    { id: 'DPT001', filmId: 'FLM20260808001', patientId: 'P20260808001', patientName: '李建国', modality: 'CT', studyType: '胸部CT平扫', filmSpec: '14x17', copies: 1, status: 'completed', printer: '柯尼卡 #1', submitTime: isoAt(180), completeTime: isoAt(175), progress: 100 },
    { id: 'DPT002', filmId: 'FLM20260808002', patientId: 'P20260808002', patientName: '王秀英', modality: 'MR', studyType: '头颅MR平扫', filmSpec: '14x17', copies: 2, status: 'printing', printer: '柯尼卡 #2', submitTime: isoAt(12), completeTime: null, progress: 45 },
    { id: 'DPT003', filmId: 'FLM20260808003', patientId: 'P20260808003', patientName: '张德发', modality: 'DR', studyType: '腰椎正侧位', filmSpec: '10x12', copies: 1, status: 'queued', printer: '富士', submitTime: isoAt(6), completeTime: null, progress: 0 },
    { id: 'DPT004', filmId: 'FLM20260808004', patientId: 'P20260808004', patientName: '赵秀英', modality: 'CT', studyType: '腹部CT增强', filmSpec: '14x17', copies: 1, status: 'completed', printer: '柯尼卡 #1', submitTime: isoAt(300), completeTime: isoAt(295), progress: 100 },
    { id: 'DPT005', filmId: 'FLM20260808005', patientId: 'P20260808005', patientName: '孙伟东', modality: 'CT', studyType: '胸部CT平扫', filmSpec: '14x17', copies: 1, status: 'failed', printer: '柯尼卡 #1', submitTime: isoAt(400), completeTime: isoAt(395), progress: 30, errorMsg: '打印机缺纸' },
  ]
}

const memJobs: PrintTaskDto[] = []

// [G005 Wave2A P0] 自定义打印机内存存储 (POST/PUT/DELETE /print/printers)
const memPrinters: PrinterDto[] = []

function filmSpecDefault(modality?: string): string {
  if (modality === 'DR' || modality === 'MG') return '10x12'
  if (modality === 'US') return '8x10'
  return '14x17'
}

function costReportFor(filmUsage: FilmUsageDay[]): PrintStatsDto['costReport'] {
  return filmUsage.slice(-7).map((d) => ({
    date: `2026-${d.date.replace('-', '-')}`,
    filmCost: d.cost,
    paperCost: Math.round(d.total * 0.5),
    inkCost: Math.round(d.total * 1.4),
    total: Math.round(d.cost + d.total * 1.9),
  }))
}

function statsSeed(): PrintStatsDto {
  const filmUsage: FilmUsageDay[] = ['08-02', '08-03', '08-04', '08-05', '08-06', '08-07', '08-08'].map((date, i) => {
    const films14x17 = 38 + i * 4
    const films10x12 = 18 + i * 3
    const films8x10 = 6 + i
    const total = films14x17 + films10x12 + films8x10
    return { date, films14x17, films10x12, films8x10, total, cost: Math.round(total * 12.5 * 10) / 10 }
  })
  return {
    filmUsage,
    devicePrint: [
      { device: 'CT-1', printCount: 156, totalFilms: 312, cost: 3900 },
      { device: 'CT-2', printCount: 142, totalFilms: 284, cost: 3550 },
      { device: 'MR-1', printCount: 98, totalFilms: 392, cost: 4900 },
      { device: 'DR-1', printCount: 210, totalFilms: 210, cost: 2625 },
      { device: 'DR-2', printCount: 185, totalFilms: 185, cost: 2312.5 },
    ],
    costReport: costReportFor(filmUsage),
  }
}

@Injectable()
export class PrintService {
  private readonly logger = new Logger(PrintService.name)

  constructor(private readonly prisma: PrismaService) {}

  // GET /print/jobs — 全部任务 (可筛选)
  listJobs(status?: string): PrintTaskDto[] {
    const all = [...memJobs, ...seedJobs()]
    return status ? all.filter((j) => j.status === status) : all
  }

  // GET /print/jobs/:id
  getJob(id: string): PrintTaskDto {
    const found = this.listJobs().find((j) => j.id === id)
    if (!found) throw new NotFoundException(`打印任务 ${id} 不存在`)
    return found
  }

  // POST /print/jobs — 创建打印任务
  createJob(input: PrintJobInput): PrintTaskDto {
    const seq = seedJobs().length + memJobs.length + 1
    const job: PrintTaskDto = {
      id: `DPT${String(seq).padStart(3, '0')}`,
      filmId: input.filmId ?? `FLM${String(Date.now()).slice(0, 8)}${String(seq).padStart(3, '0')}`,
      patientId: input.patientId ?? `P${Date.now()}`,
      patientName: input.patientName ?? '未知患者',
      modality: input.modality ?? input.examType ?? 'CT',
      studyType: input.studyDesc ?? input.studyType ?? '胶片打印',
      filmSpec: input.filmSpec ?? filmSpecDefault(input.modality ?? input.examType),
      copies: input.copies ?? 1,
      status: 'queued',
      printer: input.printer ?? '柯尼卡 #1',
      submitTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
      completeTime: null,
      progress: 0,
    }
    memJobs.unshift(job)
    return job
  }

  // GET /print/queues — 进行中/排队队列
  listQueue(): PrintTaskDto[] {
    return this.listJobs().filter((j) => j.status === 'queued' || j.status === 'printing')
  }

  // GET /print/history — 已完成/失败历史
  listHistory(): PrintTaskDto[] {
    return this.listJobs().filter((j) => j.status === 'completed' || j.status === 'failed')
  }

  // POST /print/jobs/:id/cancel
  cancelJob(id: string): { ok: boolean; id: string } {
    const idx = memJobs.findIndex((j) => j.id === id)
    if (idx >= 0) memJobs.splice(idx, 1)
    else void this.getJob(id) // 校验 seed 任务存在 (不存在则抛 404)
    return { ok: true, id }
  }

  // POST /print/jobs/:id/retry
  retryJob(id: string): { ok: boolean; id: string } {
    const job = this.getJob(id)
    const mem = memJobs.find((j) => j.id === id)
    if (mem) {
      mem.status = 'queued'
      mem.progress = 0
      mem.errorMsg = undefined
      mem.submitTime = new Date().toISOString().replace('T', ' ').slice(0, 19)
    } else {
      Object.assign(job, { status: 'queued' as const, progress: 0, errorMsg: undefined })
    }
    return { ok: true, id }
  }

  // POST /print/jobs/:id/reprint — 重新打印 (新建任务)
  reprintJob(id: string): PrintTaskDto {
    const job = this.getJob(id)
    return this.createJob({
      patientName: job.patientName,
      patientId: job.patientId,
      modality: job.modality,
      studyType: job.studyType,
      filmSpec: job.filmSpec,
      copies: job.copies,
      printer: job.printer,
      filmId: job.filmId,
    })
  }

  // GET /print/printers — Device 表派生胶片打印机 + seed 报告打印机
  async listPrinters(): Promise<PrinterDto[]> {
    const merged: PrinterDto[] = memPrinters.map((p) => ({ ...p }))
    try {
      const devices = await this.prisma.device.findMany({
        select: { id: true, name: true, modality: true, location: true, state: true },
        take: 20,
      })
      if (devices.length === 0) return [...merged, ...SEED_PRINTERS.map((p) => ({ ...p }))]
      const filmPrinters: PrinterDto[] = devices.slice(0, 5).map((d, i) => ({
        id: `FP-${i + 1}`,
        name: `${d.name} 胶片打印机`,
        type: 'network',
        status: d.state === 'IDLE' || d.state === 'IN_USE' ? 'online' : 'offline',
        location: d.location ?? d.modality,
        filmSpec: filmSpecDefault(d.modality),
        defaultCopies: 1,
        dpi: 300,
      }))
      return [...merged, ...filmPrinters, ...SEED_PRINTERS]
    } catch (err) {
      this.logger.warn(`[Print] printers DB query failed, fallback to seed: ${(err as Error).message}`)
      return [...merged, ...SEED_PRINTERS.map((p) => ({ ...p }))]
    }
  }

  // [G005 Wave2A P0] POST /print/printers — 新增打印机 (内存存储)
  createPrinter(input: PrinterInput): PrinterDto {
    const seq = memPrinters.length + 1
    const printer: PrinterDto = {
      id: `PRT${String(seq).padStart(3, '0')}`,
      name: input.name,
      type: input.type ?? 'network',
      status: input.status ?? 'online',
      location: input.location ?? '',
      filmSpec: input.filmSpec ?? '14x17',
      defaultCopies: input.defaultCopies ?? 1,
      dpi: input.dpi ?? 300,
      aet: input.aet,
      host: input.host,
      port: input.port,
      mediumTypes: input.mediumTypes,
      filmsPerHour: input.filmsPerHour,
    }
    memPrinters.push(printer)
    return printer
  }

  // [G005 Wave2A P0] PUT /print/printers/:id — 更新打印机 (自定义内存 + seed 覆盖)
  async updatePrinter(id: string, input: Partial<PrinterInput>): Promise<PrinterDto> {
    const memIdx = memPrinters.findIndex((p) => p.id === id)
    if (memIdx >= 0) {
      memPrinters[memIdx] = { ...memPrinters[memIdx], ...input, id }
      return memPrinters[memIdx]
    }
    const list = await this.listPrinters()
    const found = list.find((p) => p.id === id)
    if (!found) throw new NotFoundException(`打印机 ${id} 不存在`)
    const updated: PrinterDto = { ...found, ...input, id }
    const seedIdx = SEED_PRINTERS.findIndex((p) => p.id === id)
    if (seedIdx >= 0) Object.assign(SEED_PRINTERS[seedIdx], updated)
    return updated
  }

  // [G005 Wave2A P0] DELETE /print/printers/:id — 删除打印机 (仅自定义内存; seed/派生仅内存内移除)
  async deletePrinter(id: string): Promise<{ ok: boolean; id: string }> {
    const memIdx = memPrinters.findIndex((p) => p.id === id)
    if (memIdx >= 0) memPrinters.splice(memIdx, 1)
    else {
      const seedIdx = SEED_PRINTERS.findIndex((p) => p.id === id)
      if (seedIdx < 0) {
        const list = await this.listPrinters()
        if (!list.some((p) => p.id === id)) throw new NotFoundException(`打印机 ${id} 不存在`)
      } else {
        SEED_PRINTERS.splice(seedIdx, 1)
      }
    }
    return { ok: true, id }
  }

  // GET /print/stats — 胶片用量/设备打印量/成本 (确定性)
  getStats(): PrintStatsDto {
    const daily = this.listJobs().filter((j) => j.status === 'completed')
    if (daily.length === 0) return statsSeed()
    const byDevice = new Map<string, { printCount: number; totalFilms: number; cost: number }>()
    for (const j of daily) {
      const key = j.printer ?? '未指定'
      const entry = byDevice.get(key) ?? { printCount: 0, totalFilms: 0, cost: 0 }
      entry.printCount += 1
      const films = j.copies ?? 1
      entry.totalFilms += films
      entry.cost += films * 12.5
      byDevice.set(key, entry)
    }
    const devicePrint = Array.from(byDevice.entries()).map(([device, v]) => ({
      device,
      printCount: v.printCount,
      totalFilms: v.totalFilms,
      cost: Math.round(v.cost * 10) / 10,
    }))
    const base = statsSeed()
    const filmUsage = base.filmUsage
    const costReport = costReportFor(filmUsage)
    return { filmUsage, devicePrint: devicePrint.length > 0 ? devicePrint : base.devicePrint, costReport }
  }
}
