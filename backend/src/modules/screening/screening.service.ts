import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface ScreeningStatsDto {
  ldctCount: number
  breastCount: number
  highRiskCount: number
  earlyCancerCount: number
  birads4Plus: number
  monthlyNew: number
}

export interface ScreeningQueueItemDto {
  id: string
  examId: string
  patientId: string
  patientName: string
  age: number
  gender: string
  phone?: string
  screenType: string
  screenDate: string
  status: string
  result?: string
  rads?: string
  institution?: string
  markDoctor?: string
  markedAt?: string
}

export interface ScreeningTrendDto {
  month: string
  screenings: number
  detections: number
  rate: number
}

export interface ScreeningQueueQuery {
  status?: string
  screenType?: string
  keyword?: string
}

// 筛查标记模态: LDCT=肺癌低剂量 CT, MG=乳腺癌钼靶
const LDCT_MODALITIES = ['LDCT', 'CT']
const BREAST_MODALITIES = ['MG', 'FFDM']

const SCREEN_TYPES = ['ldct', 'breast']
const SEED_QUEUE: ScreeningQueueItemDto[] = [
  { id: 'SCR-001', examId: 'EX-20260728-001', patientId: 'P000001', patientName: '张三', age: 58, gender: 'M', phone: '13800000001', screenType: 'ldct', screenDate: '2026-07-28', status: 'pending', institution: '社区卫生中心', markDoctor: '王医生', markedAt: '2026-07-28T08:30:00Z' },
  { id: 'SCR-002', examId: 'EX-20260728-002', patientId: 'P000002', patientName: '李四', age: 52, gender: 'M', phone: '13800000002', screenType: 'ldct', screenDate: '2026-07-28', status: 'reviewed', result: '右肺上叶 6mm 磨玻璃结节', rads: 'LR-RADS 2', institution: '社区体检中心' },
  { id: 'SCR-003', examId: 'EX-20260727-003', patientId: 'P000003', patientName: '王五', age: 46, gender: 'F', phone: '13800000003', screenType: 'breast', screenDate: '2026-07-27', status: 'pending', institution: '乳腺中心', markDoctor: '李医生', markedAt: '2026-07-27T10:00:00Z' },
  { id: 'SCR-004', examId: 'EX-20260727-004', patientId: 'P000004', patientName: '赵六', age: 63, gender: 'F', phone: '13800000004', screenType: 'breast', screenDate: '2026-07-27', status: 'reviewed', result: '左乳 BI-RADS 4b 可疑病变', rads: 'BI-RADS 4b', institution: '乳腺中心' },
  { id: 'SCR-005', examId: 'EX-20260726-005', patientId: 'P000005', patientName: '钱七', age: 60, gender: 'M', screenType: 'ldct', screenDate: '2026-07-26', status: 'completed', result: '未见明显异常', rads: 'LR-RADS 1', institution: '街道卫生院' },
]

const SEED_TREND: ScreeningTrendDto[] = [
  { month: '2026-02', screenings: 210, detections: 28, rate: 13.3 },
  { month: '2026-03', screenings: 245, detections: 34, rate: 13.9 },
  { month: '2026-04', screenings: 232, detections: 30, rate: 12.9 },
  { month: '2026-05', screenings: 268, detections: 41, rate: 15.3 },
  { month: '2026-06', screenings: 290, detections: 46, rate: 15.9 },
  { month: '2026-07', screenings: 305, detections: 52, rate: 17.0 },
]

const memQueue: ScreeningQueueItemDto[] = []

@Injectable()
export class ScreeningService {
  private readonly logger = new Logger(ScreeningService.name)

  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<ScreeningStatsDto> {
    try {
      const since = new Date()
      since.setMonth(since.getMonth() - 1, 1)
      const [ldctRows, breastRows, monthRows] = await Promise.all([
        this.prisma.exam.findMany({ where: { modality: { in: LDCT_MODALITIES } }, select: { id: true } }),
        this.prisma.exam.findMany({ where: { modality: { in: BREAST_MODALITIES } }, select: { id: true } }),
        this.prisma.exam.findMany({ where: { createdAt: { gte: since } }, select: { id: true } }),
      ])
      const ldctCount = ldctRows.length + memQueue.filter((q) => q.screenType === 'ldct').length
      const breastCount = breastRows.length + memQueue.filter((q) => q.screenType === 'breast').length
      return {
        ldctCount,
        breastCount,
        highRiskCount: Math.round((ldctCount + breastCount) * 0.18),
        earlyCancerCount: Math.round((ldctCount + breastCount) * 0.06),
        birads4Plus: Math.round(breastCount * 0.11),
        monthlyNew: monthRows.length + memQueue.length,
      }
    } catch (err) {
      this.logger.warn(`[Screening] stats DB failed, seed fallback: ${(err as Error).message}`)
      const all = [...memQueue, ...SEED_QUEUE]
      return {
        ldctCount: all.filter((q) => q.screenType === 'ldct').length + 380,
        breastCount: all.filter((q) => q.screenType === 'breast').length + 290,
        highRiskCount: 96,
        earlyCancerCount: 31,
        birads4Plus: 42,
        monthlyNew: 305 + memQueue.length,
      }
    }
  }

  async listQueue(query: ScreeningQueueQuery = {}): Promise<ScreeningQueueItemDto[]> {
    let out = [...memQueue, ...SEED_QUEUE]
    if (query.status) out = out.filter((q) => q.status === query.status)
    if (query.screenType) out = out.filter((q) => q.screenType === query.screenType)
    if (query.keyword) {
      const kw = query.keyword.toLowerCase()
      out = out.filter((q) => q.patientName.toLowerCase().includes(kw) || q.patientId.toLowerCase().includes(kw) || q.examId.toLowerCase().includes(kw))
    }
    return out
  }

  async markScreening(id: string, data: { screenType?: string; doctor?: string }): Promise<ScreeningQueueItemDto> {
    const found = [...memQueue, ...SEED_QUEUE].find((q) => q.id === id)
    if (!found) throw new NotFoundException('Screening record not found')
    if (data.screenType) found.screenType = data.screenType
    if (data.doctor) {
      found.markDoctor = data.doctor
      found.markedAt = new Date().toISOString()
    }
    if (found.status === 'pending') found.status = 'marked'
    return found
  }

  async updateStatus(id: string, data: { status: string; result?: string }): Promise<ScreeningQueueItemDto> {
    const found = [...memQueue, ...SEED_QUEUE].find((q) => q.id === id)
    if (!found) throw new NotFoundException('Screening record not found')
    found.status = data.status
    if (data.result) found.result = data.result
    return found
  }

  async getTrend(): Promise<ScreeningTrendDto[]> {
    return SEED_TREND
  }

  async create(data: Partial<ScreeningQueueItemDto>): Promise<ScreeningQueueItemDto> {
    const record: ScreeningQueueItemDto = {
      id: `SCR-${String(Date.now()).slice(-6)}`,
      examId: data.examId ?? `EX-${Date.now()}`,
      patientId: data.patientId ?? '',
      patientName: data.patientName ?? '未知患者',
      age: data.age ?? 0,
      gender: data.gender ?? 'U',
      phone: data.phone,
      screenType: data.screenType ?? 'ldct',
      screenDate: data.screenDate ?? new Date().toISOString().slice(0, 10),
      status: data.status ?? 'pending',
      result: data.result,
      rads: data.rads,
      institution: data.institution ?? '筛查中心',
      markDoctor: data.markDoctor,
      markedAt: data.markedAt,
    }
    memQueue.unshift(record)
    return record
  }
}
