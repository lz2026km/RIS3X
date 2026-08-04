import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { hashString } from '../../common/utils/deterministic-hash'

export interface Series4D {
  seriesUid: string
  studyUid: string
  patientName: string
  patientId: string
  modality: string
  seriesDescription: string
  frameCount: number
  frameRate: number
  gatingType: 'cardiac' | 'respiratory' | 'both'
  dimensions: { width: number; height: number }
  /** true = seed 回退 (DB 无数据/不可用) */
  simulated?: boolean
}

export interface FrameData {
  frameIndex: number
  timestamp: string
  phase: number
  dataUrl: string
}

export interface PhaseInfo {
  seriesUid: string
  gatingType: 'cardiac' | 'respiratory' | 'both'
  cardiacPhase: number
  respiratoryPhase: number
  cardiacCycleMs: number
  respiratoryCycleMs: number
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
    simulated: true,
  },
]

const GATING_TYPES: Array<Series4D['gatingType']> = ['cardiac', 'respiratory', 'both']

interface DicomSeriesRow {
  seriesInstanceUid: string
  studyInstanceUid: string
  modality: string
  frameCount: number
}

@Injectable()
export class Dicom4dService {
  constructor(private readonly prisma: PrismaService) {}

  /** 从 dicomInstance 表按 modality=CT/MR 真实聚合系列 (seriesInstanceUid 去重) */
  private async queryRealSeries(): Promise<DicomSeriesRow[]> {
    const instances = await this.prisma.dicomInstance.findMany({
      where: { modality: { in: ['CT', 'MR'] } },
      select: { seriesInstanceUid: true, studyInstanceUid: true, modality: true },
      orderBy: { createdAt: 'asc' },
      take: 1000,
    })
    const map = new Map<string, DicomSeriesRow>()
    for (const inst of instances) {
      const row = map.get(inst.seriesInstanceUid)
      if (row) row.frameCount += 1
      else map.set(inst.seriesInstanceUid, { ...inst, frameCount: 1 })
    }
    return [...map.values()]
  }

  private toSeries(row: DicomSeriesRow, jobFrameCount?: number | null): Series4D {
    const h = hashString(row.seriesInstanceUid)
    return {
      seriesUid: row.seriesInstanceUid,
      studyUid: row.studyInstanceUid,
      patientName: '',
      patientId: '',
      modality: row.modality,
      seriesDescription: `${row.modality} 4D Series`,
      frameCount: jobFrameCount ?? row.frameCount,
      frameRate: 8 + (h % 8), // 确定性 8-15 fps
      gatingType: GATING_TYPES[h % GATING_TYPES.length],
      dimensions: row.modality === 'MR' ? { width: 256, height: 256 } : { width: 512, height: 512 },
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
        result.push({
          seriesUid: job.seriesUid,
          studyUid: '',
          patientName: '',
          patientId: '',
          modality: '',
          seriesDescription: `4D Series (${job.status})`,
          frameCount: job.frameCount,
          frameRate: 10,
          gatingType: 'cardiac',
          dimensions: { width: 512, height: 512 },
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
        return {
          seriesUid: job.seriesUid,
          studyUid: '',
          patientName: '',
          patientId: '',
          modality: '',
          seriesDescription: '4D Series',
          frameCount: job.frameCount,
          frameRate: 10,
          gatingType: 'cardiac',
          dimensions: { width: 512, height: 512 },
          simulated: true,
        }
      }
    } catch {
      // DB unavailable -> NotFound below
    }
    return undefined
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

  async getFrames(seriesUid: string): Promise<FrameData[]> {
    const s = await this.findSeries(seriesUid)
    if (!s) throw new NotFoundException(`Series ${seriesUid} not found`)
    try {
      await this.persistJob(s.seriesUid, s.frameCount)
    } catch {
      // DB unavailable -> frames still generated from real/mock series
    }
    const frames: FrameData[] = []
    for (let i = 0; i < s.frameCount; i++) {
      const phase = i / s.frameCount
      const intervalMs = 1000 / s.frameRate
      const timestamp = new Date(Date.now() + i * intervalMs).toISOString()
      frames.push({
        frameIndex: i,
        timestamp,
        phase: Math.round(phase * 100),
        dataUrl: `/dicom/4d/${seriesUid}/frame/${i}`,
      })
    }
    return frames
  }

  async getPhase(seriesUid: string): Promise<PhaseInfo> {
    const s = await this.findSeries(seriesUid)
    if (!s) throw new NotFoundException(`Series ${seriesUid} not found`)
    const h = hashString(seriesUid)
    return {
      seriesUid: s.seriesUid,
      gatingType: s.gatingType,
      cardiacPhase: s.gatingType === 'cardiac' || s.gatingType === 'both' ? h % 100 : 0,
      respiratoryPhase: s.gatingType === 'respiratory' || s.gatingType === 'both' ? (h >> 8) % 100 : 0,
      cardiacCycleMs: 800,
      respiratoryCycleMs: 4000,
      frameCount: s.frameCount,
    }
  }
}
