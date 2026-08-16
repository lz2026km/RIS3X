import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

// ===== [G005 v3.0.6.11-101 Wave 2A] 影像对比 (imaging-compare) =====
// 孤儿模块模式: 数据从现有 dicom 表 (Patient/Exam/DicomInstance) 派生,
// DB 不可用/无数据时回退确定性 seed; 会话为内存态, controller 可无 DB 启动。
// 差异指标为纯函数 (computeDifferenceMetrics / generatePixelMatrix),
// 由 spec 直接验证计算正确性。

export type CompareGroupType = 'multi-timepoint' | 'multi-series' | 'multi-modality'

export interface CompareSeriesInfo {
  seriesInstanceUid: string
  studyInstanceUid: string
  modality: string
  seriesDescription: string
  instanceCount: number
  studyDate: string
}

export interface PatientStudyDto {
  studyInstanceUid: string
  accessionNumber: string
  studyDate: string
  modality: string
  bodyPart: string
  series: CompareSeriesInfo[]
}

export interface PatientListItem {
  patientId: string
  name: string
  gender: string
  studyCount: number
  lastStudyDate: string
}

export interface CompareSessionSeriesGroup {
  seriesInstanceUid: string
  label: string
  modality: string
}

export interface SyncState {
  panZoom: boolean
  wwwl: boolean
  frame: boolean
}

export interface CompareSessionDto {
  id: string
  patientId: string
  patientName: string
  name: string
  groupType: CompareGroupType
  seriesGroups: CompareSessionSeriesGroup[]
  sync: SyncState
  createdAt: string
  updatedAt: string
}

export interface HistogramBin {
  bin: number
  value: number
  countA: number
  countB: number
}

export interface DifferenceMetrics {
  seriesA: string
  seriesB: string
  sliceIndex: number
  width: number
  height: number
  pixelCount: number
  meanA: number
  meanB: number
  meanDiff: number
  varianceA: number
  varianceB: number
  varianceDiff: number
  stdDevA: number
  stdDevB: number
  histogramDiff: number
  hotRegionRatio: number
  threshold: number
  changedPixelCount: number
  source: 'derived' | 'seed'
  histogram: HistogramBin[]
}

// ===== 确定性 hash (FNV-1a): 同一 uid 每次返回同一像素/指标 =====
export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

const MODALITY_SEED_BASE: Record<string, number> = {
  CT: 240,
  PT: 120,
  MR: 380,
  DR: 210,
  US: 140,
  XA: 260,
}

const MODALITY_LABEL: Record<string, string> = {
  CT: 'CT 平扫',
  PT: 'PET 全身',
  MR: 'MR 序列',
  DR: 'DR 胸片',
  US: '超声',
  XA: '血管造影',
}

/** 由 series uid + modality 确定性生成 size×size 像素矩阵 (0..4095) */
export function generatePixelMatrix(seedKey: string, size: number, modality: string): number[][] {
  const base = MODALITY_SEED_BASE[modality] ?? 200
  const data: number[][] = []
  const cy = size / 2
  const cx = size / 2
  const radial = 28 + hashString(`${seedKey}:r`) * 26
  const wobble = 3 + hashString(`${seedKey}:w`) * 4
  for (let y = 0; y < size; y++) {
    const row: number[] = []
    for (let x = 0; x < size; x++) {
      const dx = x - cx
      const dy = y - cy
      const d = Math.sqrt(dx * dx + dy * dy)
      const a = Math.atan2(dy, dx)
      let v = base + Math.sin(d * (0.02 + hashString(`${seedKey}:f`) * 0.012)) * 90
      v += Math.cos(a * wobble) * 34
      v += Math.sin(x * 0.05 + hashString(`${seedKey}:p`) * 3 + y * 0.03) * 26
      if (modality === 'PT') {
        v += 260 * Math.exp(-(d * d) / (2 * radial * radial))
      }
      if (modality === 'MR') {
        v += 120 * Math.sin(d * 0.03) * Math.cos(a * 2)
      }
      row.push(Math.max(0, Math.min(4095, Math.round(v))))
    }
    data.push(row)
  }
  return data
}

const HIST_BINS = 64

function buildHistogram(pixels: number[][], min: number, max: number): number[] {
  const range = max - min || 1
  const bins = new Array<number>(HIST_BINS).fill(0)
  for (const row of pixels) {
    for (const v of row) {
      const idx = Math.min(HIST_BINS - 1, Math.max(0, Math.floor(((v - min) / range) * HIST_BINS)))
      bins[idx] += 1
    }
  }
  return bins
}

/**
 * 影像级差异指标: 均值/方差/直方图差异 (归一化 L1/2, 0..1) + 像素差热区占比。
 * 纯函数: 输入相同像素矩阵 → 输出确定, spec 可直接断言正确性。
 */
export function computeDifferenceMetrics(
  pixelsA: number[][],
  pixelsB: number[][],
  threshold = 24,
): Pick<DifferenceMetrics, 'meanA' | 'meanB' | 'meanDiff' | 'varianceA' | 'varianceB' | 'varianceDiff' | 'stdDevA' | 'stdDevB' | 'histogramDiff' | 'hotRegionRatio' | 'threshold' | 'pixelCount' | 'changedPixelCount' | 'histogram'> {
  if (pixelsA.length === 0 || pixelsA.length !== pixelsB.length) {
    throw new BadRequestException('pixel matrices must be non-empty and same height')
  }
  const height = pixelsA.length
  const width = pixelsA[0]!.length
  if (pixelsB.some((row) => row.length !== width)) {
    throw new BadRequestException('pixel matrices must have same width')
  }
  const pixelCount = width * height
  let sumA = 0
  let sumB = 0
  let min = Infinity
  let max = -Infinity
  const flatA = new Float64Array(pixelCount)
  const flatB = new Float64Array(pixelCount)
  let i = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const va = pixelsA[y]![x]!
      const vb = pixelsB[y]![x]!
      flatA[i] = va
      flatB[i] = vb
      sumA += va
      sumB += vb
      if (va < min) min = va
      if (va > max) max = va
      if (vb < min) min = vb
      if (vb > max) max = vb
      i += 1
    }
  }
  const meanA = sumA / pixelCount
  const meanB = sumB / pixelCount
  let sqA = 0
  let sqB = 0
  let hot = 0
  for (i = 0; i < pixelCount; i++) {
    const da = flatA[i]! - meanA
    const db = flatB[i]! - meanB
    sqA += da * da
    sqB += db * db
    if (Math.abs(flatA[i]! - flatB[i]!) > threshold) hot += 1
  }
  const varianceA = sqA / pixelCount
  const varianceB = sqB / pixelCount
  const histA = buildHistogram(pixelsA, min, max)
  const histB = buildHistogram(pixelsB, min, max)
  let histDiff = 0
  for (let b = 0; b < HIST_BINS; b++) {
    histDiff += Math.abs(histA[b]! / pixelCount - histB[b]! / pixelCount)
  }
  // 归一化 L1 距离 (0..1): 完全一致 → 0, 完全不相交 → 2, 除以 2 → 0..1
  const histogramDiff = Math.round((histDiff / 2) * 10000) / 10000
  const hotRegionRatio = hot / pixelCount
  return {
    meanA: Math.round(meanA * 100) / 100,
    meanB: Math.round(meanB * 100) / 100,
    meanDiff: Math.round((meanA - meanB) * 100) / 100,
    varianceA: Math.round(varianceA * 100) / 100,
    varianceB: Math.round(varianceB * 100) / 100,
    varianceDiff: Math.round((varianceA - varianceB) * 100) / 100,
    stdDevA: Math.round(Math.sqrt(varianceA) * 100) / 100,
    stdDevB: Math.round(Math.sqrt(varianceB) * 100) / 100,
    histogramDiff,
    hotRegionRatio: Math.round(hotRegionRatio * 10000) / 10000,
    threshold,
    pixelCount,
    changedPixelCount: hot,
    histogram: Array.from({ length: HIST_BINS }, (_, b) => ({
      bin: b,
      value: Math.round((min + ((b + 0.5) / HIST_BINS) * (max - min)) * 10) / 10,
      countA: histA[b]!,
      countB: histB[b]!,
    })),
  }
}

// ===== 种子数据: 患者/检查/序列 (DB 空时回退, 确定性) =====
interface SeedPatient {
  patientId: string
  name: string
  gender: string
  studies: {
    studyInstanceUid: string
    accessionNumber: string
    studyDate: string
    modality: string
    bodyPart: string
    series: CompareSeriesInfo[]
  }[]
}

const SEED_PATIENTS: SeedPatient[] = [
  {
    patientId: 'P100001',
    name: '张伟',
    gender: 'MALE',
    studies: [
      {
        studyInstanceUid: '1.2.826.0.1.3680043.8.498.202601010001',
        accessionNumber: 'AC-20260101-001',
        studyDate: '2026-01-01',
        modality: 'CT',
        bodyPart: '胸部',
        series: [
          { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202601010001.1', studyInstanceUid: '1.2.826.0.1.3680043.8.498.202601010001', modality: 'CT', seriesDescription: 'Chest CT 平扫 (2026-01)', instanceCount: 128, studyDate: '2026-01-01' },
          { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202601010001.2', studyInstanceUid: '1.2.826.0.1.3680043.8.498.202601010001', modality: 'CT', seriesDescription: 'Chest CT 增强', instanceCount: 128, studyDate: '2026-01-01' },
        ],
      },
      {
        studyInstanceUid: '1.2.826.0.1.3680043.8.498.202602100002',
        accessionNumber: 'AC-20260210-002',
        studyDate: '2026-02-10',
        modality: 'CT',
        bodyPart: '胸部',
        series: [
          { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202602100002.1', studyInstanceUid: '1.2.826.0.1.3680043.8.498.202602100002', modality: 'CT', seriesDescription: 'Chest CT 随访 (2026-02)', instanceCount: 128, studyDate: '2026-02-10' },
        ],
      },
      {
        studyInstanceUid: '1.2.826.0.1.3680043.8.498.202603200003',
        accessionNumber: 'AC-20260320-003',
        studyDate: '2026-03-20',
        modality: 'CT',
        bodyPart: '胸部',
        series: [
          { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202603200003.1', studyInstanceUid: '1.2.826.0.1.3680043.8.498.202603200003', modality: 'CT', seriesDescription: 'Chest CT 随访 (2026-03)', instanceCount: 128, studyDate: '2026-03-20' },
        ],
      },
    ],
  },
  {
    patientId: 'P100002',
    name: '李娜',
    gender: 'FEMALE',
    studies: [
      {
        studyInstanceUid: '1.2.826.0.1.3680043.8.498.202601150004',
        accessionNumber: 'AC-20260115-004',
        studyDate: '2026-01-15',
        modality: 'PT',
        bodyPart: '全身',
        series: [
          { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202601150004.1', studyInstanceUid: '1.2.826.0.1.3680043.8.498.202601150004', modality: 'PT', seriesDescription: 'PET 全身显像', instanceCount: 256, studyDate: '2026-01-15' },
        ],
      },
      {
        studyInstanceUid: '1.2.826.0.1.3680043.8.498.202601150005',
        accessionNumber: 'AC-20260115-005',
        studyDate: '2026-01-15',
        modality: 'CT',
        bodyPart: '全身',
        series: [
          { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202601150005.1', studyInstanceUid: '1.2.826.0.1.3680043.8.498.202601150005', modality: 'CT', seriesDescription: '定位像 CT', instanceCount: 256, studyDate: '2026-01-15' },
        ],
      },
      {
        studyInstanceUid: '1.2.826.0.1.3680043.8.498.202604050006',
        accessionNumber: 'AC-20260405-006',
        studyDate: '2026-04-05',
        modality: 'PT',
        bodyPart: '全身',
        series: [
          { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202604050006.1', studyInstanceUid: '1.2.826.0.1.3680043.8.498.202604050006', modality: 'PT', seriesDescription: 'PET 随访显像', instanceCount: 256, studyDate: '2026-04-05' },
        ],
      },
    ],
  },
  {
    patientId: 'P100003',
    name: '王强',
    gender: 'MALE',
    studies: [
      {
        studyInstanceUid: '1.2.826.0.1.3680043.8.498.202602200007',
        accessionNumber: 'AC-20260220-007',
        studyDate: '2026-02-20',
        modality: 'MR',
        bodyPart: '头部',
        series: [
          { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202602200007.1', studyInstanceUid: '1.2.826.0.1.3680043.8.498.202602200007', modality: 'MR', seriesDescription: '头颅 T1', instanceCount: 160, studyDate: '2026-02-20' },
          { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202602200007.2', studyInstanceUid: '1.2.826.0.1.3680043.8.498.202602200007', modality: 'MR', seriesDescription: '头颅 T2', instanceCount: 160, studyDate: '2026-02-20' },
          { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202602200007.3', studyInstanceUid: '1.2.826.0.1.3680043.8.498.202602200007', modality: 'MR', seriesDescription: '头颅 DWI', instanceCount: 160, studyDate: '2026-02-20' },
        ],
      },
    ],
  },
]

const memSessions: CompareSessionDto[] = []

const SEED_SESSIONS: CompareSessionDto[] = [
  {
    id: 'cmp-seed-001',
    patientId: 'P100001',
    patientName: '张伟',
    name: '胸部 CT 三次随访对比',
    groupType: 'multi-timepoint',
    seriesGroups: [
      { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202601010001.1', label: '基线 (2026-01)', modality: 'CT' },
      { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202602100002.1', label: '随访 1 (2026-02)', modality: 'CT' },
      { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202603200003.1', label: '随访 2 (2026-03)', modality: 'CT' },
    ],
    sync: { panZoom: true, wwwl: true, frame: true },
    createdAt: '2026-08-06T09:12:00Z',
    updatedAt: '2026-08-06T09:12:00Z',
  },
  {
    id: 'cmp-seed-002',
    patientId: 'P100002',
    patientName: '李娜',
    name: 'PET-CT 多模态并排',
    groupType: 'multi-modality',
    seriesGroups: [
      { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202601150004.1', label: 'PET 基线', modality: 'PT' },
      { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202601150005.1', label: 'CT 定位像', modality: 'CT' },
      { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202604050006.1', label: 'PET 随访', modality: 'PT' },
    ],
    sync: { panZoom: true, wwwl: false, frame: true },
    createdAt: '2026-08-05T14:30:00Z',
    updatedAt: '2026-08-05T14:30:00Z',
  },
  {
    id: 'cmp-seed-003',
    patientId: 'P100003',
    patientName: '王强',
    name: '头颅 MR 多序列对比',
    groupType: 'multi-series',
    seriesGroups: [
      { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202602200007.1', label: 'T1', modality: 'MR' },
      { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202602200007.2', label: 'T2', modality: 'MR' },
      { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202602200007.3', label: 'DWI', modality: 'MR' },
      { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202602200007.1', label: 'T1 增强', modality: 'MR' },
    ],
    sync: { panZoom: false, wwwl: true, frame: true },
    createdAt: '2026-08-04T08:00:00Z',
    updatedAt: '2026-08-04T08:00:00Z',
  },
]

function isSeedSession(id: string): boolean {
  return SEED_SESSIONS.some((s) => s.id === id)
}

@Injectable()
export class ImagingCompareService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== 患者列表 (Patient + Exam 聚合, seed 回退) =====
  async listPatients(keyword?: string): Promise<PatientListItem[]> {
    const result: PatientListItem[] = []
    try {
      const patients = await this.prisma.patient.findMany({
        where: keyword ? { OR: [{ name: { contains: keyword } }, { id: { contains: keyword } }] } : undefined,
        select: { id: true, name: true, gender: true },
        take: 50,
      })
      for (const p of patients) {
        let studyCount = 0
        let lastStudyDate = ''
        try {
          const exams = await this.prisma.exam.findMany({
            where: { patientId: p.id },
            select: { completedAt: true },
            take: 100,
          })
          studyCount = exams.length
          const dates = exams
            .map((e) => e.completedAt)
            .filter((d): d is Date => d !== null)
            .sort((a, b) => b.getTime() - a.getTime())
          if (dates.length > 0) lastStudyDate = dates[0]!.toISOString().slice(0, 10)
        } catch {
          // DB 部分不可用 → 保留基础信息
        }
        result.push({ patientId: p.id, name: p.name, gender: p.gender, studyCount, lastStudyDate })
      }
    } catch {
      // DB 不可用 → 空, 走 seed
    }
    if (result.length === 0) {
      return SEED_PATIENTS.filter((p) => !keyword || p.name.includes(keyword) || p.patientId.includes(keyword)).map((p) => ({
        patientId: p.patientId,
        name: p.name,
        gender: p.gender,
        studyCount: p.studies.length,
        lastStudyDate: p.studies.map((s) => s.studyDate).sort().at(-1) ?? '',
      }))
    }
    return result
  }

  // ===== 同患者检查列表 (按 patientId 聚合检查/序列) =====
  async getPatientStudies(patientId: string): Promise<{ patientId: string; studies: PatientStudyDto[]; source: 'db' | 'seed' }> {
    const studies: PatientStudyDto[] = []
    try {
      const instances = await this.prisma.dicomInstance.findMany({
        where: { studyInstanceUid: { contains: '' } },
        select: { studyInstanceUid: true, seriesInstanceUid: true, sopInstanceUid: true, modality: true },
      })
      const byStudy = new Map<string, Map<string, { modality: string; count: number }>>()
      for (const inst of instances) {
        const seriesMap = byStudy.get(inst.studyInstanceUid) ?? new Map<string, { modality: string; count: number }>()
        const entry = seriesMap.get(inst.seriesInstanceUid)
        if (entry) entry.count += 1
        else seriesMap.set(inst.seriesInstanceUid, { modality: inst.modality, count: 1 })
        byStudy.set(inst.studyInstanceUid, seriesMap)
      }
      for (const [studyUid, seriesMap] of byStudy) {
        const study: PatientStudyDto = {
          studyInstanceUid: studyUid,
          accessionNumber: studyUid.slice(-12),
          studyDate: '',
          modality: Array.from(seriesMap.values())[0]?.modality ?? '',
          bodyPart: '全身',
          series: Array.from(seriesMap.entries()).map(([seriesUid, s]) => ({
            seriesInstanceUid: seriesUid,
            studyInstanceUid: studyUid,
            modality: s.modality,
            seriesDescription: `${MODALITY_LABEL[s.modality] ?? s.modality} (${studyUid.slice(-6)})`,
            instanceCount: s.count,
            studyDate: '',
          })),
        }
        studies.push(study)
      }
    } catch {
      // DB 不可用 → seed
    }
    if (studies.length > 0) {
      return { patientId, studies, source: 'db' }
    }
    const seed = SEED_PATIENTS.find((p) => p.patientId === patientId)
    if (seed) {
      return { patientId, studies: seed.studies.map((s) => ({ ...s, series: s.series })), source: 'seed' }
    }
    return { patientId, studies: [], source: 'seed' }
  }

  // ===== 会话 CRUD (内存态) =====
  listSessions(patientId?: string): CompareSessionDto[] {
    const all = [...memSessions, ...SEED_SESSIONS]
    return patientId ? all.filter((s) => s.patientId === patientId) : all
  }

  getSession(id: string): CompareSessionDto {
    const found = [...memSessions, ...SEED_SESSIONS].find((s) => s.id === id)
    if (!found) throw new NotFoundException(`Compare session ${id} not found`)
    return found
  }

  createSession(dto: { patientId: string; name?: string; seriesGroups: { seriesInstanceUid: string; label?: string; modality?: string }[] }): CompareSessionDto {
    if (dto.seriesGroups.length < 2 || dto.seriesGroups.length > 4) {
      throw new BadRequestException('对比会话需要 2-4 个序列分组')
    }
    const uids = new Set<string>()
    for (const g of dto.seriesGroups) {
      if (!g.seriesInstanceUid || uids.has(g.seriesInstanceUid)) {
        throw new BadRequestException('序列分组必须唯一且非空')
      }
      uids.add(g.seriesInstanceUid)
    }
    const patient = SEED_PATIENTS.find((p) => p.patientId === dto.patientId)
    const modalities = dto.seriesGroups.map((g) => g.modality ?? '')
    const uniqueModalities = new Set(modalities.filter(Boolean))
    const groupType: CompareGroupType =
      uniqueModalities.size > 1 ? 'multi-modality' : dto.seriesGroups.length >= 3 ? 'multi-timepoint' : 'multi-series'
    const now = new Date().toISOString()
    const session: CompareSessionDto = {
      id: `cmp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      patientId: dto.patientId,
      patientName: patient?.name ?? '未知患者',
      name: dto.name?.trim() || '影像对比会话',
      groupType,
      seriesGroups: dto.seriesGroups.map((g, i) => ({
        seriesInstanceUid: g.seriesInstanceUid,
        label: g.label?.trim() || `序列 ${i + 1}`,
        modality: g.modality ?? '',
      })),
      sync: { panZoom: true, wwwl: true, frame: true },
      createdAt: now,
      updatedAt: now,
    }
    memSessions.unshift(session)
    return session
  }

  deleteSession(id: string): { ok: boolean } {
    if (isSeedSession(id)) return { ok: true }
    const idx = memSessions.findIndex((s) => s.id === id)
    if (idx === -1) throw new NotFoundException(`Compare session ${id} not found`)
    memSessions.splice(idx, 1)
    return { ok: true }
  }

  // ===== 同步状态 (会话级开关: 平移/缩放/窗宽窗位/翻页联动) =====
  getSyncState(id: string): { sessionId: string; sync: SyncState } {
    const session = this.getSession(id)
    return { sessionId: id, sync: session.sync }
  }

  updateSyncState(id: string, patch: Partial<SyncState>): CompareSessionDto {
    const session = this.getSession(id)
    if (isSeedSession(id)) {
      // seed 会话: 仅返回合并后的状态 (不修改种子)
      return { ...session, sync: { ...session.sync, ...patch } }
    }
    session.sync = { ...session.sync, ...patch }
    session.updatedAt = new Date().toISOString()
    return session
  }

  // ===== 影像级差异指标 (确定性像素 + 纯函数) =====
  computeDifference(
    sessionId: string,
    seriesA: string,
    seriesB: string,
    sliceIndex = 0,
    threshold = 24,
  ): DifferenceMetrics {
    const session = this.getSession(sessionId)
    const ids = new Set(session.seriesGroups.map((g) => g.seriesInstanceUid))
    if (!ids.has(seriesA) || !ids.has(seriesB)) {
      throw new BadRequestException('序列必须属于该对比会话')
    }
    const modalityA = session.seriesGroups.find((g) => g.seriesInstanceUid === seriesA)?.modality ?? 'CT'
    const modalityB = session.seriesGroups.find((g) => g.seriesInstanceUid === seriesB)?.modality ?? 'CT'
    const size = 128
    const pixelsA = generatePixelMatrix(`${seriesA}:s${sliceIndex}`, size, modalityA)
    const pixelsB = generatePixelMatrix(`${seriesB}:s${sliceIndex}`, size, modalityB)
    const stats = computeDifferenceMetrics(pixelsA, pixelsB, threshold)
    return {
      seriesA,
      seriesB,
      sliceIndex,
      width: size,
      height: size,
      source: 'derived',
      ...stats,
    }
  }
}
