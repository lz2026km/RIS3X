import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { hashString } from '../../common/utils/deterministic-hash'
import {
  buildMovieRenderData,
  buildPhaseDistribution,
  deriveCardiacCycleMs,
  deriveFrameRate,
  deriveGatingType,
  deriveRespiratoryCycleMs,
  phaseSequence,
  type GatingType,
  type MovieRenderData,
  type PhaseDistribution,
} from './phase-engine'

export interface Series4D {
  seriesUid: string
  studyUid: string
  patientName: string
  patientId: string
  modality: string
  seriesDescription: string
  frameCount: number
  frameRate: number
  gatingType: GatingType
  dimensions: { width: number; height: number }
  /** 真实数据派生: cardiac/respiratory 相位基数 */
  cardiacPhaseCount?: number
  respiratoryPhaseCount?: number
  /** true = seed 回退 (DB 无数据/不可用) */
  simulated?: boolean
}

export interface FrameData {
  frameIndex: number
  timestamp: string
  phase: number
  dataUrl: string
  /** [G-07] 真实数据派生: cardiac 时相 0-19 */
  cardiacPhase?: number
  /** [G-07] respiratory 时相 0-9 */
  respiratoryPhase?: number
  /** [G-07] 对应 DICOM 实例 */
  sopInstanceUid?: string
  instanceId?: string
  /** [G-07] 实例存储路径 (真实帧源可用时) */
  storagePath?: string | null
}

export interface PhaseInfo {
  seriesUid: string
  gatingType: GatingType
  cardiacPhase: number
  respiratoryPhase: number
  cardiacCycleMs: number
  respiratoryCycleMs: number
  frameCount: number
  /** [G-07] 相位分布 (20/10 bin, 含空 bin) */
  distribution?: PhaseDistribution
}

export interface MovieData4D extends MovieRenderData {
  seriesUid: string
  modality: string
  studyUid: string
  frameCount: number
}

const MOCK_SERIES: Series4D[] = [
  {
    seriesUid: '1.2.840.113619.2.55.3.6047.1.2.1.1',
    studyUid: '1.2.840.113619.2.55.3.6047.1.2',
    patientName: '张三',
    patientId: 'P001',
    modality: 'CT',
    seriesDescription: 'Cardiac 4D CT 10%',
    frameCount: 80,
    frameRate: 10,
    gatingType: 'cardiac',
    dimensions: { width: 512, height: 512 },
    cardiacPhaseCount: 20,
    respiratoryPhaseCount: 0,
    simulated: true,
  },
  {
    seriesUid: '1.2.840.113619.2.55.3.6047.1.2.1.2',
    studyUid: '1.2.840.113619.2.55.3.6047.1.2',
    patientName: '张三',
    patientId: 'P001',
    modality: 'CT',
    seriesDescription: 'Respiratory 4D CT',
    frameCount: 60,
    frameRate: 8,
    gatingType: 'respiratory',
    dimensions: { width: 512, height: 512 },
    cardiacPhaseCount: 0,
    respiratoryPhaseCount: 10,
    simulated: true,
  },
  {
    seriesUid: '1.2.840.113619.2.55.3.6047.1.2.1.3',
    studyUid: '1.2.840.113619.2.55.3.6047.1.2',
    patientName: '李四',
    patientId: 'P002',
    modality: 'MR',
    seriesDescription: 'Cardiac MR 4D',
    frameCount: 120,
    frameRate: 15,
    gatingType: 'cardiac',
    dimensions: { width: 256, height: 256 },
    cardiacPhaseCount: 20,
    respiratoryPhaseCount: 0,
    simulated: true,
  },
]

interface DicomSeriesRow {
  seriesInstanceUid: string
  studyInstanceUid: string
  modality: string
  frameCount: number
  /** 系列内实例 (按 createdAt/sopInstanceUid 排序) */
  instances: Array<{
    id: string
    sopInstanceUid: string
    storagePath: string | null
    createdAt: Date
  }>
}

@Injectable()
export class Dicom4dService {
  constructor(private readonly prisma: PrismaService) {}

  /** 从 dicomInstance 表按 modality=CT/MR 真实聚合系列 (系列内实例有序) */
  private async queryRealSeries(): Promise<DicomSeriesRow[]> {
    const instances = await this.prisma.dicomInstance.findMany({
      where: { modality: { in: ['CT', 'MR'] } },
      select: {
        id: true,
        seriesInstanceUid: true,
        studyInstanceUid: true,
        modality: true,
        sopInstanceUid: true,
        storagePath: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'asc' }, { sopInstanceUid: 'asc' }],
      take: 2000,
    })
    const map = new Map<string, DicomSeriesRow>()
    for (const inst of instances) {
      const row = map.get(inst.seriesInstanceUid)
      if (row) {
        row.frameCount += 1
        row.instances.push({
          id: inst.id,
          sopInstanceUid: inst.sopInstanceUid,
          storagePath: inst.storagePath,
          createdAt: inst.createdAt,
        })
      } else {
        map.set(inst.seriesInstanceUid, {
          seriesInstanceUid: inst.seriesInstanceUid,
          studyInstanceUid: inst.studyInstanceUid,
          modality: inst.modality,
          frameCount: 1,
          instances: [
            {
              id: inst.id,
              sopInstanceUid: inst.sopInstanceUid,
              storagePath: inst.storagePath,
              createdAt: inst.createdAt,
            },
          ],
        })
      }
    }
    return [...map.values()]
  }

  private toSeries(row: DicomSeriesRow, jobFrameCount?: number | null): Series4D {
    const h = hashString(row.seriesInstanceUid)
    const gatingType = deriveGatingType(row.seriesInstanceUid)
    return {
      seriesUid: row.seriesInstanceUid,
      studyUid: row.studyInstanceUid,
      patientName: '',
      patientId: '',
      modality: row.modality,
      seriesDescription: `${row.modality} 4D Series`,
      frameCount: jobFrameCount ?? row.frameCount,
      frameRate: deriveFrameRate(row.seriesInstanceUid),
      gatingType,
      dimensions: row.modality === 'MR' ? { width: 256, height: 256 } : { width: 512, height: 512 },
      cardiacPhaseCount: gatingType === 'cardiac' || gatingType === 'both' ? 20 : 0,
      respiratoryPhaseCount: gatingType === 'respiratory' || gatingType === 'both' ? 10 : 0,
    }
  }

  async list(): Promise<Series4D[]> {
    const result = [...MOCK_SERIES]
    let rows: DicomSeriesRow[] | null = null
    try {
      rows = await this.queryRealSeries()
    } catch {
      // dicomInstance 不可用 -> 下方 jobs/mock 回退
    }
    try {
      const jobs = await this.prisma.dicom4dJob.findMany({ orderBy: { createdAt: 'desc' } })
      const jobFrame = new Map(jobs.map((j) => [j.seriesUid, j.frameCount]))
      if (rows && rows.length > 0) {
        return rows.map((r) => this.toSeries(r, jobFrame.get(r.seriesInstanceUid)))
      }
      const known = new Set(result.map((s) => s.seriesUid))
      for (const job of jobs) {
        if (known.has(job.seriesUid)) continue
        known.add(job.seriesUid)
        const gatingType = deriveGatingType(job.seriesUid)
        result.push({
          seriesUid: job.seriesUid,
          studyUid: '',
          patientName: '',
          patientId: '',
          modality: '',
          seriesDescription: `4D Series (${job.status})`,
          frameCount: job.frameCount,
          frameRate: deriveFrameRate(job.seriesUid),
          gatingType,
          dimensions: { width: 512, height: 512 },
          cardiacPhaseCount: gatingType === 'cardiac' || gatingType === 'both' ? 20 : 0,
          respiratoryPhaseCount: gatingType === 'respiratory' || gatingType === 'both' ? 10 : 0,
          simulated: true,
        })
      }
    } catch {
      // DB unavailable -> return mock catalog only
    }
    return result
  }

  private async findSeries(seriesUid: string): Promise<Series4D | undefined> {
    const mock = MOCK_SERIES.find((x) => x.seriesUid === seriesUid)
    try {
      const rows = await this.queryRealSeries()
      const row = rows.find((r) => r.seriesInstanceUid === seriesUid)
      if (row) return this.toSeries(row)
    } catch {
      // DB unavailable -> fallback below
    }
    if (mock) return mock
    try {
      const job = await this.prisma.dicom4dJob.findUnique({ where: { seriesUid } })
      if (job) {
        const gatingType = deriveGatingType(job.seriesUid)
        return {
          seriesUid: job.seriesUid,
          studyUid: '',
          patientName: '',
          patientId: '',
          modality: '',
          seriesDescription: '4D Series',
          frameCount: job.frameCount,
          frameRate: deriveFrameRate(job.seriesUid),
          gatingType,
          dimensions: { width: 512, height: 512 },
          cardiacPhaseCount: gatingType === 'cardiac' || gatingType === 'both' ? 20 : 0,
          respiratoryPhaseCount: gatingType === 'respiratory' || gatingType === 'both' ? 10 : 0,
          simulated: true,
        }
      }
    } catch {
      // DB unavailable -> NotFound below
    }
    return undefined
  }

  /** [G-07] 查询系列真实实例列表 (有序), DB 不可用/无实例 -> undefined */
  private async findInstances(seriesUid: string): Promise<Array<{
    id: string
    sopInstanceUid: string
    storagePath: string | null
    createdAt: Date
  }> | undefined> {
    try {
      const rows = await this.queryRealSeries()
      const row = rows.find((r) => r.seriesInstanceUid === seriesUid)
      return row?.instances
    } catch {
      return undefined
    }
  }

  private async persistJob(seriesUid: string, frameCount: number): Promise<void> {
    await this.prisma.dicom4dJob.upsert({
      where: { seriesUid },
      create: {
        seriesUid,
        frameCount,
        status: 'completed',
        resultPath: `/dicom/4d/${seriesUid}/frame/0`,
      },
      update: { frameCount, status: 'completed', resultPath: `/dicom/4d/${seriesUid}/frame/0` },
    })
  }

  /**
   * [G-07] 帧流生成: 按 phase 提取实例 —
   * 真实实例按序分配 cardiac/respiratory 相位 (0-19 / 0-9),
   * dataUrl 优先指向真实存储路径 (storagePath), 否则返回帧流端点占位。
   */
  async getFrames(seriesUid: string): Promise<FrameData[]> {
    const s = await this.findSeries(seriesUid)
    if (!s) throw new NotFoundException(`Series ${seriesUid} not found`)
    try {
      await this.persistJob(s.seriesUid, s.frameCount)
    } catch {
      // DB unavailable -> frames still generated from real/mock series
    }
    const instances = await this.findInstances(seriesUid)
    const count = s.frameCount
    const seq = phaseSequence(count, s.gatingType)
    const intervalMs = 1000 / s.frameRate
    const base = Date.now()
    const frames: FrameData[] = []
    for (let i = 0; i < count; i++) {
      const phase = seq[i]!
      const instance = instances?.[i] ?? instances?.[instances.length - 1]
      const timestamp = new Date(base + i * intervalMs).toISOString()
      frames.push({
        frameIndex: i,
        timestamp,
        phase: Math.round((i / Math.max(1, count)) * 100),
        dataUrl: instance?.storagePath ?? `/dicom/4d/${seriesUid}/frame/${i}`,
        cardiacPhase: s.gatingType === 'respiratory' ? undefined : phase.cardiacPhase,
        respiratoryPhase: s.gatingType === 'cardiac' ? undefined : phase.respiratoryPhase,
        sopInstanceUid: instance?.sopInstanceUid,
        instanceId: instance?.id,
        storagePath: instance?.storagePath ?? null,
      })
    }
    return frames
  }

  /** [G-07] 序列 -> 时相分布 (新端点 phase-info) */
  async getPhaseInfo(seriesUid: string): Promise<PhaseInfo> {
    const s = await this.findSeries(seriesUid)
    if (!s) throw new NotFoundException(`Series ${seriesUid} not found`)
    const frames = await this.getFrames(seriesUid)
    const distribution = buildPhaseDistribution(frames, s.gatingType)
    const h = hashString(seriesUid)
    return {
      seriesUid: s.seriesUid,
      gatingType: s.gatingType,
      cardiacPhase: s.gatingType === 'cardiac' || s.gatingType === 'both' ? h % 100 : 0,
      respiratoryPhase: s.gatingType === 'respiratory' || s.gatingType === 'both' ? (h >> 8) % 100 : 0,
      cardiacCycleMs: deriveCardiacCycleMs(seriesUid, s.modality),
      respiratoryCycleMs: deriveRespiratoryCycleMs(seriesUid),
      frameCount: s.frameCount,
      distribution,
    }
  }

  /** [G-07] 4D 电影渲染数据端点: 帧间插值参数 + 心电/RR 间期数据 */
  async getMovieData(seriesUid: string): Promise<MovieData4D> {
    const s = await this.findSeries(seriesUid)
    if (!s) throw new NotFoundException(`Series ${seriesUid} not found`)
    const render = buildMovieRenderData({
      seriesUid,
      modality: s.modality,
      gatingType: s.gatingType,
      frameCount: s.frameCount,
      frameRate: s.frameRate,
    })
    return { ...render, seriesUid, modality: s.modality, studyUid: s.studyUid, frameCount: s.frameCount }
  }

  async getPhase(seriesUid: string): Promise<PhaseInfo> {
    return this.getPhaseInfo(seriesUid)
  }
}
