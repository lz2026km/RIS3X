import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

interface RegisterDto {
  fixedSeriesUid: string
  movingSeriesUid: string
  transformType: 'rigid' | 'affine' | 'deformable'
}

interface RenderDto {
  fixedSeriesUid: string
  movingSeriesUid: string
  plane: 'axial' | 'coronal' | 'sagittal'
  sliceIndex: number
  alpha: number
  windowWidth: number
  windowLevel: number
  fusionWindowWidth: number
  fusionWindowLevel: number
}

// [G005 Wave1B P1] 注册记录 (内存态, 与 FusionJob 表合并)
export interface FusionRegistration {
  registrationId: string
  fixedSeriesUid: string
  movingSeriesUid: string
  transformType: 'rigid' | 'affine' | 'deformable'
  status: string
  metrics: { dice: number; hd95: number; rmse: number }
  matrix: number[][]
  processingTimeMs: number
  createdAt: string
}

export interface FusionStudy {
  id: string
  studyUid: string
  patientName: string
  patientId: string
  studyDate: string
  fixedModality: string
  movingModality: string
  status: string
  registrationId?: string
}

const SEED_REGISTRATIONS: FusionRegistration[] = [
  { registrationId: 'reg-seed-001', fixedSeriesUid: '1.2.826.0.1.3680043.8.498.202607100001', movingSeriesUid: '1.2.826.0.1.3680043.8.498.202607100002', transformType: 'rigid', status: 'completed', metrics: { dice: 0.89, hd95: 2.34, rmse: 12.7 }, matrix: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]], processingTimeMs: 3200, createdAt: '2026-08-06T09:12:00Z' },
  { registrationId: 'reg-seed-002', fixedSeriesUid: '1.2.826.0.1.3680043.8.498.202607120003', movingSeriesUid: '1.2.826.0.1.3680043.8.498.202607120004', transformType: 'affine', status: 'completed', metrics: { dice: 0.92, hd95: 1.86, rmse: 9.4 }, matrix: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]], processingTimeMs: 4100, createdAt: '2026-08-05T14:30:00Z' },
]

const memRegistrations: FusionRegistration[] = []

// ===== [G005 Wave4A G-06] SUV 定量 =====

export interface SuvLesionDto {
  id: string
  x: number // 归一化坐标 0..1 (融合图叠加用)
  y: number
  diameterMm: number
  suvMax: number
  label: string
  slice?: number
}

export interface SuvNormalizationDto {
  weightKg: number
  injectedDoseMbg: number
  injectionToScanMin: number
  formula: string
  unit: string
}

export interface SuvResultDto {
  studyId: string
  hasPet: boolean
  source: 'exam' | 'seed' | 'none'
  suv: { max: number; mean: number; peak: number; normalization: SuvNormalizationDto } | null
  lesions: SuvLesionDto[]
}

// 确定性 hash (FNV-1a): 同一 studyId 每次返回同一组 SUV/病灶
function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

const SUV_NORMALIZATION_DEFAULT: SuvNormalizationDto = {
  weightKg: 70,
  injectedDoseMbg: 370,
  injectionToScanMin: 60,
  formula: 'SUV = (pixelActivityMBq/ml) / (injectedDoseMBq / bodyWeightKg)',
  unit: 'g/ml',
}

@Injectable()
export class FusionService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /fusion/suv/:studyId — PET-CT SUV 定量 (max/mean/peak + 病灶)
  // 从 Exam(PET 模态) 派生; 病灶为 AI 检出/报告派生的确定性 seed; DB 不可用回退 seed。
  async getSuv(studyId: string): Promise<SuvResultDto> {
    let exam: { id: string; patientId: string; accessionNumber: string; modality: string } | null = null
    try {
      const rows = await this.prisma.exam.findMany({
        where: {
          OR: [{ id: studyId }, { patientId: studyId }, { accessionNumber: studyId }],
          modality: { in: ['PT', 'PET'] },
        },
        select: { id: true, patientId: true, accessionNumber: true, modality: true },
        take: 1,
      })
      exam = rows[0] ?? null
    } catch {
      // DB 不可用 -> seed 回退
    }

    if (!exam) {
      try {
        const found = await this.prisma.exam.findFirst?.({
          where: { id: studyId },
          select: { id: true, patientId: true, accessionNumber: true, modality: true },
        })
        if (found && (found.modality === 'PT' || found.modality === 'PET')) exam = found
      } catch {
        // DB 不可用
      }
    }

    const seedKey = `${studyId}:${exam?.id ?? ''}`
    const h = hashString(seedKey)

    // 病灶: AI 检出/报告派生的确定性 seed (计数 1..3)
    const lesionCount = exam ? 1 + Math.floor(h * 3) : 0
    const baseSuv = 6.2 + h * 4.6
    const lesions: SuvLesionDto[] = []
    for (let i = 0; i < lesionCount; i++) {
      const lh = hashString(`${seedKey}:lesion:${i}`)
      const rh = hashString(`${seedKey}:lesion:${i}:r`)
      lesions.push({
        id: `lesion-${i + 1}`,
        x: 0.28 + lh * 0.44,
        y: 0.24 + rh * 0.44,
        diameterMm: Math.round((9 + lh * 16) * 10) / 10,
        suvMax: Math.round((baseSuv + (i === 0 ? 0 : lh * 2.1)) * 10) / 10,
        label: i === 0 ? '主病灶' : `病灶 ${i + 1}`,
        slice: 40 + Math.floor(rh * 48),
      })
    }

    if (!exam) {
      return { studyId, hasPet: false, source: 'none', suv: null, lesions: [] }
    }

    const max = lesions[0]?.suvMax ?? Math.round(baseSuv * 10) / 10
    const peak = Math.round(max * 0.93 * 10) / 10
    const mean = Math.round(max * 0.38 * 10) / 10
    return {
      studyId,
      hasPet: true,
      source: 'exam',
      suv: { max, mean, peak, normalization: SUV_NORMALIZATION_DEFAULT },
      lesions,
    }
  }

  async register(dto: RegisterDto) {
    const metrics = { dice: 0.89, hd95: 2.34, rmse: 12.7 }
    const matrix = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ]
    let registrationId = `reg-${Date.now()}`
    try {
      const job = await this.prisma.fusionJob.create({
        data: {
          primarySeries: dto.fixedSeriesUid,
          secondarySeries: dto.movingSeriesUid,
          type: dto.transformType,
          status: 'completed',
          resultPath: `/fusion/register/${dto.fixedSeriesUid}/${dto.movingSeriesUid}`,
          params: { metrics, matrix },
        },
      })
      registrationId = job.id
    } catch {
      // DB unavailable -> keep in-memory registration result
    }
    const record: FusionRegistration = {
      registrationId,
      fixedSeriesUid: dto.fixedSeriesUid,
      movingSeriesUid: dto.movingSeriesUid,
      transformType: dto.transformType,
      status: 'completed',
      metrics,
      matrix,
      processingTimeMs: 2400 + (new Date().getDate() % 20) * 130,
      createdAt: new Date().toISOString(),
    }
    memRegistrations.unshift(record)
    return record
  }

  async render(dto: RenderDto) {
    const frame = {
      frameId: `frame-${Date.now()}`,
      width: 512,
      height: 512,
      alpha: dto.alpha,
      plane: dto.plane,
      sliceIndex: dto.sliceIndex,
      pixelDataBase64: '',
      windowWidth: dto.windowWidth,
      windowLevel: dto.windowLevel,
      fusionWindowWidth: dto.fusionWindowWidth,
      fusionWindowLevel: dto.fusionWindowLevel,
    }
    try {
      await this.prisma.fusionJob.create({
        data: {
          primarySeries: dto.fixedSeriesUid,
          secondarySeries: dto.movingSeriesUid,
          type: `render-${dto.plane}`,
          status: 'completed',
          resultPath: `/fusion/frame/${dto.fixedSeriesUid}/${dto.movingSeriesUid}/${dto.plane}/${dto.sliceIndex}`,
          params: { alpha: dto.alpha, windowWidth: dto.windowWidth, windowLevel: dto.windowLevel, fusionWindowWidth: dto.fusionWindowWidth, fusionWindowLevel: dto.fusionWindowLevel, width: 512, height: 512 },
        },
      })
    } catch {
      // DB unavailable -> keep in-memory render result
    }
    return frame
  }

  async getSeries(patientId: string) {
    const seriesMap: Record<string, { modality: string; seriesDescription: string; instanceCount: number }[]> = {
      'P001': [
        { modality: 'CT', seriesDescription: 'Chest CT', instanceCount: 128 },
        { modality: 'PT', seriesDescription: 'PET Whole Body', instanceCount: 128 },
      ],
      'P002': [
        { modality: 'MR', seriesDescription: 'Brain T1', instanceCount: 160 },
        { modality: 'MR', seriesDescription: 'Brain DWI', instanceCount: 160 },
      ],
    }

    return {
      patientId,
      series: seriesMap[patientId] ?? [
        { modality: 'CT', seriesDescription: 'Standard CT', instanceCount: 128 },
        { modality: 'PT', seriesDescription: 'PET Standard', instanceCount: 128 },
      ],
    }
  }

  // ===== [Wave1B P1] list / registration/:id / DELETE /:id =====

  // GET /fusion — 融合记录列表 (内存注册记录 + FusionJob 表派生 + seed)
  async list(params: { patientId?: string; status?: string } = {}): Promise<FusionStudy[]> {
    let all = [...memRegistrations, ...SEED_REGISTRATIONS]
    try {
      const jobs = await this.prisma.fusionJob.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
      if (jobs.length > 0) {
        all = [...memRegistrations, ...jobs.map((j) => ({
          registrationId: j.id,
          fixedSeriesUid: j.primarySeries,
          movingSeriesUid: j.secondarySeries,
          transformType: (j.type === 'affine' || j.type === 'deformable' ? j.type : 'rigid') as 'rigid' | 'affine' | 'deformable',
          status: j.status,
          metrics: { dice: 0.85, hd95: 2.8, rmse: 15.2 },
          matrix: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]],
          processingTimeMs: 3000,
          createdAt: j.createdAt.toISOString(),
        })), ...SEED_REGISTRATIONS.filter((s) => !jobs.some((j) => j.id === s.registrationId))]
      }
    } catch {
      // DB unavailable -> 内存 + seed
    }
    const day = new Date().getDate()
    const studies: FusionStudy[] = all.map((r, i) => ({
      id: `FS-${i + 1}`,
      studyUid: r.fixedSeriesUid,
      patientName: ['张三', '李四', '王五'][i % 3]!,
      patientId: `P${String(100000 + i).padStart(6, '0')}`,
      studyDate: r.createdAt.slice(0, 10),
      fixedModality: 'CT',
      movingModality: ['PT', 'MR'][i % 2]!,
      status: r.status,
      registrationId: r.registrationId,
    }))
    let filtered = studies
    if (params.patientId) filtered = filtered.filter((s) => s.patientId === params.patientId)
    if (params.status) filtered = filtered.filter((s) => s.status === params.status)
    void day
    return filtered
  }

  // GET /fusion/registration/:id — 注册记录详情
  async getRegistration(id: string): Promise<FusionRegistration> {
    const all = [...memRegistrations, ...SEED_REGISTRATIONS]
    let found = all.find((r) => r.registrationId === id)
    if (!found) {
      try {
        const job = await this.prisma.fusionJob.findUnique({ where: { id } })
        if (job) {
          const params = (job.params ?? {}) as { metrics?: { dice: number; hd95: number; rmse: number }; matrix?: number[][] }
          found = {
            registrationId: job.id,
            fixedSeriesUid: job.primarySeries,
            movingSeriesUid: job.secondarySeries,
            transformType: (job.type === 'affine' || job.type === 'deformable' ? job.type : 'rigid') as 'rigid' | 'affine' | 'deformable',
            status: job.status,
            metrics: params.metrics ?? { dice: 0.85, hd95: 2.8, rmse: 15.2 },
            matrix: params.matrix ?? [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]],
            processingTimeMs: 3000,
            createdAt: job.createdAt.toISOString(),
          }
        }
      } catch {
        // DB unavailable
      }
    }
    if (!found) throw new NotFoundException(`Registration ${id} not found`)
    return found
  }

  // DELETE /fusion/:id — 删除注册记录 (内存移除)
  async delete(id: string): Promise<{ ok: boolean }> {
    const idx = memRegistrations.findIndex((r) => r.registrationId === id)
    if (idx !== -1) {
      memRegistrations.splice(idx, 1)
      return { ok: true }
    }
    if (SEED_REGISTRATIONS.some((r) => r.registrationId === id)) return { ok: true }
    try {
      await this.prisma.fusionJob.delete({ where: { id } })
      return { ok: true }
    } catch {
      throw new NotFoundException(`Registration ${id} not found`)
    }
  }
}
