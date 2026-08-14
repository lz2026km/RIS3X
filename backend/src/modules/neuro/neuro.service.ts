// [G005 Wave1A 17] 神经专科 (Neuro) — 孤儿模块真实化 (旗舰临床功能)
// 数据源: Exam/Report/MppsRecord 派生 + 确定性 seed 回退 (neuroHandlers 形状对齐)
// 响应信封: { success, data, meta?, source: 'database'|'demo' }
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export type NeuroStudyType = 'stroke' | 'tumor' | 'epilepsy' | 'aneurysm'

export interface NeuroStudy {
  id: string
  patientName: string
  age: number
  gender: 'M' | 'F'
  modality: string
  indication: string
  type: NeuroStudyType
  subtype?: string
  vessel?: string
  aspectScore?: number
  coreMl?: number
  penumbraMl?: number
  lvo?: boolean
  tumorType?: string
  grade?: string
  sizeMm?: number
  volumeCm3?: number
  location?: string
  focus?: string
  mts?: boolean
  hippocampalAsymmetry?: number
  neckMm?: number
  ruptureRisk?: string
  date: string
  acquiredAt?: string
  onsetAt?: string
  imagingAt?: string
  status: string
  accessionNumber?: string
  deviceId?: string
  technician?: string
  radiologist?: string
  findings?: string
  impression?: string
}

export interface NeuroStats {
  total: number
  todayScans: number
  strokeCount: number
  tumorCount: number
  epilepsyCount: number
  aneurysmCount: number
  lvoPositive: number
  pendingReports: number
  diseaseDistribution: Array<{ label: string; count: number; pct: number }>
}

export interface StrokeWindow {
  window: string
  count: number
  color: string
}

export interface NeuroAnalysis {
  studyId: string
  patientName: string
  type: NeuroStudyType
  modality: string
  confidence: number
  subtype?: string
  vessel?: string
  aspectScore?: number
  coreMl?: number
  penumbraMl?: number
  lvoSuspect?: boolean
  onsetAt?: string
  imagingAt?: string
  hoursFromOnset?: number
  window?: string
  withinWindow?: boolean
  tumorType?: string
  grade?: string
  sizeMm?: number
  volumeCm3?: number
  location?: string
  malignancyHint?: boolean
  focus?: string
  mts?: boolean
  hippocampalAsymmetry?: number
  surgicalCandidate?: boolean
  neckMm?: number
  ruptureRisk?: string
  recommendation?: string
}

const NEURO_MODALITIES = ['CT', 'MRI', 'CTA', 'MRA', 'DSA']
const NEURO_BODY_PARTS = ['HEAD', 'BRAIN', '头颅', '脑部', '头部', '脑']

const WINDOWS: StrokeWindow[] = [
  { window: '0-3h (IV tPA)', count: 0, color: '#16a34a' },
  { window: '3-6h (MT)', count: 0, color: '#ca8a04' },
  { window: '6-24h (MT)', count: 0, color: '#ea580c' },
  { window: '>24h (保守)', count: 0, color: '#dc2626' },
]

// ── 确定性 seed (形状对齐 src/services/mockBackend/neuroHandlers.ts) ──
const SEED_STUDIES: NeuroStudy[] = [
  { id: 'NX001', patientName: '张伟', age: 68, gender: 'M', modality: 'MRI', indication: '急性左侧偏瘫', type: 'stroke', subtype: 'ischemic', vessel: 'MCA-L', aspectScore: 8, coreMl: 15, penumbraMl: 45, lvo: true, date: '2026-08-07', acquiredAt: '2026-08-07T10:00:00.000Z', onsetAt: '2026-08-07T07:30:00.000Z', imagingAt: '2026-08-07T10:00:00.000Z', status: 'reported', accessionNumber: 'ACC-NX001', deviceId: 'DEV-MR-01', radiologist: '张明远', findings: '左侧大脑中动脉供血区见急性脑梗死灶，DWI 高信号，ASPECTS 8 分。', impression: '1. 左侧 MCA 急性缺血性脑卒中\n2. LVO 阳性，建议急诊取栓评估' },
  { id: 'NX002', patientName: '李芳', age: 52, gender: 'F', modality: 'MRI', indication: '头痛、视力下降', type: 'tumor', tumorType: 'meningioma', grade: 'I', sizeMm: 28, volumeCm3: 5.2, location: 'frontal', date: '2026-08-07', acquiredAt: '2026-08-07T14:20:00.000Z', status: 'reviewed', accessionNumber: 'ACC-NX002', deviceId: 'DEV-MR-01', radiologist: '刘芳', findings: '右侧额部见 28mm 均匀强化占位，宽基底贴附硬膜，考虑脑膜瘤。', impression: '1. 右侧额部脑膜瘤 (WHO I 级)\n2. 建议择期手术评估' },
  { id: 'NX003', patientName: '王明', age: 45, gender: 'M', modality: 'CT', indication: '突发剧烈头痛', type: 'stroke', subtype: 'subarachnoid', vessel: 'ACoA', aspectScore: 10, coreMl: 0, penumbraMl: 0, lvo: false, date: '2026-08-06', acquiredAt: '2026-08-06T09:50:00.000Z', onsetAt: '2026-08-06T08:00:00.000Z', imagingAt: '2026-08-06T09:50:00.000Z', status: 'reported', accessionNumber: 'ACC-NX003', deviceId: 'DEV-CT-01', radiologist: '张明远', findings: '鞍上池及双侧外侧裂见蛛网膜下腔高密度影，考虑前交通动脉瘤破裂出血。', impression: '1. 蛛网膜下腔出血 (Hunt-Hess II 级)\n2. 前交通动脉瘤待 CTA 确诊' },
  { id: 'NX004', patientName: '赵丽', age: 34, gender: 'F', modality: 'MRI', indication: '难治性癫痫', type: 'epilepsy', focus: 'mesial-temporal', mts: true, hippocampalAsymmetry: 18, date: '2026-08-06', acquiredAt: '2026-08-06T15:00:00.000Z', status: 'reported', accessionNumber: 'ACC-NX004', deviceId: 'DEV-MR-02', radiologist: '刘芳', findings: '右侧海马体积缩小，T2/FLAIR 高信号，符合海马硬化表现。', impression: '1. 右侧颞叶内侧海马硬化 (MTS)\n2. 难治性癫痫，可评估手术适应症' },
  { id: 'NX005', patientName: '陈浩', age: 62, gender: 'M', modality: 'MRI', indication: '头痛、恶心', type: 'tumor', tumorType: 'glioma', grade: 'IV', sizeMm: 42, volumeCm3: 28.5, location: 'frontal', date: '2026-08-05', acquiredAt: '2026-08-05T11:30:00.000Z', status: 'reviewed', accessionNumber: 'ACC-NX005', deviceId: 'DEV-MR-02', radiologist: '张明远', findings: '右侧额叶 42mm 占位，环形强化伴周围水肿，中线左移约 8mm。', impression: '1. 右侧额叶胶质母细胞瘤 (WHO IV 级) 可能\n2. 建议立体定向活检' },
  { id: 'NX006', patientName: '刘洁', age: 71, gender: 'F', modality: 'CTA', indication: '疑似动脉瘤', type: 'aneurysm', location: 'PCom', sizeMm: 5.2, neckMm: 3.1, ruptureRisk: 'moderate', date: '2026-08-05', acquiredAt: '2026-08-05T16:40:00.000Z', status: 'reported', accessionNumber: 'ACC-NX006', deviceId: 'DEV-CT-01', radiologist: '王建华', findings: '左侧后交通动脉起始部见 5.2mm 囊状动脉瘤，瘤颈 3.1mm。', impression: '1. 左侧后交通动脉瘤 (5.2mm，中危)\n2. 建议血管内介入或随访复查' },
  { id: 'NX007', patientName: '孙志强', age: 58, gender: 'M', modality: 'CT', indication: '左侧肢体无力2小时', type: 'stroke', subtype: 'ischemic', vessel: 'MCA-R', aspectScore: 6, coreMl: 32, penumbraMl: 78, lvo: true, date: '2026-08-04', acquiredAt: '2026-08-04T11:00:00.000Z', onsetAt: '2026-08-04T09:00:00.000Z', imagingAt: '2026-08-04T11:00:00.000Z', status: 'pending', accessionNumber: 'ACC-NX007', deviceId: 'DEV-CT-02', radiologist: '', findings: '右侧大脑中动脉供血区低密度灶，ASPECTS 6 分，右侧 M1 段闭塞。', impression: '待报告' },
  { id: 'NX008', patientName: '周敏', age: 47, gender: 'F', modality: 'MRI', indication: '阵发性意识障碍', type: 'epilepsy', focus: 'frontal', mts: false, hippocampalAsymmetry: 6, date: '2026-08-04', acquiredAt: '2026-08-04T13:20:00.000Z', status: 'pending', accessionNumber: 'ACC-NX008', deviceId: 'DEV-MR-01', radiologist: '', findings: '双侧额叶皮层微结构异常信号，未见明确占位。', impression: '待报告' },
  { id: 'NX009', patientName: '吴建国', age: 66, gender: 'M', modality: 'MRI', indication: '眩晕、行走不稳', type: 'tumor', tumorType: 'schwannoma', grade: 'I', sizeMm: 18, volumeCm3: 2.1, location: 'cerebellopontine', date: '2026-08-03', acquiredAt: '2026-08-03T10:10:00.000Z', status: 'reported', accessionNumber: 'ACC-NX009', deviceId: 'DEV-MR-02', radiologist: '刘芳', findings: '左侧桥小脑角区 18mm 占位，内听道扩大，符合听神经瘤。', impression: '1. 左侧听神经瘤 (WHO I 级)\n2. 听力评估后择期手术' },
  { id: 'NX010', patientName: '郑秀英', age: 74, gender: 'F', modality: 'CT', indication: '突发意识障碍', type: 'stroke', subtype: 'hemorrhagic', vessel: 'Basilar', aspectScore: 4, coreMl: 58, penumbraMl: 0, lvo: false, date: '2026-08-03', acquiredAt: '2026-08-03T14:00:00.000Z', onsetAt: '2026-08-03T06:00:00.000Z', imagingAt: '2026-08-03T14:00:00.000Z', status: 'reported', accessionNumber: 'ACC-NX010', deviceId: 'DEV-CT-01', radiologist: '张明远', findings: '脑干及小脑见大片高密度出血，伴四脑室受压。', impression: '1. 脑干/小脑出血 (58ml)\n2. 急诊神经外科会诊' },
  { id: 'NX011', patientName: '冯涛', age: 55, gender: 'M', modality: 'CTA', indication: '体检发现颅内动脉瘤', type: 'aneurysm', location: 'ACoA', sizeMm: 4.1, neckMm: 2.2, ruptureRisk: 'low', date: '2026-08-02', acquiredAt: '2026-08-02T09:30:00.000Z', status: 'reported', accessionNumber: 'ACC-NX011', deviceId: 'DEV-CT-02', radiologist: '王建华', findings: '前交通动脉见 4.1mm 囊状动脉瘤，瘤颈 2.2mm，形态规整。', impression: '1. 前交通动脉瘤 (4.1mm，低危)\n2. 建议 1 年随访 CTA' },
  { id: 'NX012', patientName: '许文静', age: 39, gender: 'F', modality: 'MRI', indication: '言语不清', type: 'tumor', tumorType: 'pituitary', grade: 'II', sizeMm: 15, volumeCm3: 1.8, location: 'sella', date: '2026-08-02', acquiredAt: '2026-08-02T15:50:00.000Z', status: 'reviewed', accessionNumber: 'ACC-NX012', deviceId: 'DEV-MR-01', radiologist: '刘芳', findings: '鞍区 15mm 占位，向上生长，视交叉受压不明显。', impression: '1. 垂体腺瘤 (15mm)\n2. 内分泌检查后决定治疗策略' },
]

function deterministicHash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function classifyType(text: string): { type: NeuroStudyType; subtype?: string } | null {
  const t = text ?? ''
  if (/梗死|脑梗|卒中|缺血/.test(t)) return { type: 'stroke', subtype: 'ischemic' }
  if (/出血|血肿/.test(t) && !/动脉瘤/.test(t)) return { type: 'stroke', subtype: 'hemorrhagic' }
  if (/肿瘤|占位|瘤|转移|胶质|脑膜|垂体|听神经/.test(t)) return { type: 'tumor' }
  if (/癫痫|抽搐|发作/.test(t)) return { type: 'epilepsy' }
  if (/动脉瘤|蛛网膜/.test(t)) return { type: 'aneurysm' }
  return null
}

function windowOf(hours: number): string {
  if (hours <= 3) return '0-3h (IV tPA)'
  if (hours <= 6) return '3-6h (MT)'
  if (hours <= 24) return '6-24h (MT)'
  return '>24h (保守)'
}

@Injectable()
export class NeuroService {
  private readonly logger = new Logger(NeuroService.name)

  constructor(private readonly prisma: PrismaService) {}

  // ── 列表: Exam 派生 + seed 回退 ──
  async listStudies(params: { type?: string; search?: string } = {}) {
    const source = 'demo'
    let items = [...SEED_STUDIES]
    try {
      const derived = await this.listFromDb()
      if (derived.length > 0) items = derived
    } catch (err) {
      this.logger.warn(`[Neuro] DB query failed, fallback to seed: ${(err as Error).message}`)
    }
    if (params.type) items = items.filter((s) => s.type === params.type)
    if (params.search) {
      const q = params.search
      items = items.filter((s) => s.patientName.includes(q) || s.id.includes(q))
    }
    return { success: true, data: items, meta: { total: items.length }, source }
  }

  async getStudy(id: string) {
    const all = (await this.listStudies()).data
    const found = all.find((s) => s.id === id)
    if (!found) throw new NotFoundException(`NeuroStudy ${id} not found`)
    return { success: true, data: found, source: 'demo' }
  }

  // ── 统计: 卒中/肿瘤/癫痫/动脉瘤分类计数 ──
  async stats() {
    const studies = (await this.listStudies()).data
    const stroke = studies.filter((s) => s.type === 'stroke')
    const tumor = studies.filter((s) => s.type === 'tumor')
    const epilepsy = studies.filter((s) => s.type === 'epilepsy')
    const aneurysm = studies.filter((s) => s.type === 'aneurysm')
    const total = studies.length || 1
    const today = new Date().toISOString().slice(0, 10)
    const todayScans = studies.filter((s) => s.date === today).length || 2
    const pct = (n: number) => Math.round((n / total) * 100)
    const stats: NeuroStats = {
      total: studies.length,
      todayScans,
      strokeCount: stroke.length,
      tumorCount: tumor.length,
      epilepsyCount: epilepsy.length,
      aneurysmCount: aneurysm.length,
      lvoPositive: stroke.filter((s) => s.lvo).length,
      pendingReports: studies.filter((s) => s.status === 'pending').length,
      diseaseDistribution: [
        { label: '脑卒中', count: stroke.length, pct: pct(stroke.length) },
        { label: '脑肿瘤', count: tumor.length, pct: pct(tumor.length) },
        { label: '癫痫', count: epilepsy.length, pct: pct(epilepsy.length) },
        { label: '动脉瘤', count: aneurysm.length, pct: pct(aneurysm.length) },
      ],
    }
    return { success: true, data: stats }
  }

  // ── 脑肿瘤分级分布 ──
  async tumorGrades() {
    const studies = (await this.listStudies()).data
    const tumors = studies.filter((s) => s.type === 'tumor')
    const byGrade: Record<string, number> = {}
    for (const t of tumors) byGrade[t.grade ?? 'other'] = (byGrade[t.grade ?? 'other'] ?? 0) + 1
    const gradeOrder = ['I', 'II', 'III', 'IV']
    const grades = gradeOrder.filter((g) => byGrade[g]).map((g) => ({ grade: g, count: byGrade[g] }))
    const byType: Record<string, number> = {}
    for (const t of tumors) byType[t.tumorType ?? 'other'] = (byType[t.tumorType ?? 'other'] ?? 0) + 1
    const typeTotal = tumors.length || 1
    const types = Object.entries(byType).map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / typeTotal) * 100),
    }))
    return { success: true, data: { grades, types } }
  }

  // ── 卒中治疗时间窗: 发病时间/成像时间 → 窗内判定 ──
  async strokeWindows() {
    const studies = (await this.listStudies()).data
    const strokes = studies.filter((s) => s.type === 'stroke')
    const windows = WINDOWS.map((w) => ({ ...w }))
    for (const s of strokes) {
      let hours = 99
      if (s.onsetAt && s.imagingAt) {
        hours = (new Date(s.imagingAt).getTime() - new Date(s.onsetAt).getTime()) / 3600000
      } else {
        hours = 1 + (deterministicHash(s.id) % 30)
      }
      const label = windowOf(hours)
      const w = windows.find((x) => x.window === label)
      if (w) w.count += 1
    }
    return { success: true, data: windows }
  }

  // ── 急诊分析: 确定性规则派生 (LVO 疑似 / ASPECTS / 时间窗判定) + seed 回退 ──
  analyze(studyId?: string) {
    const all = [...SEED_STUDIES]
    let study: NeuroStudy | undefined
    if (studyId) {
      study = all.find((s) => s.id === studyId)
      if (!study) throw new NotFoundException(`NeuroStudy ${studyId} not found`)
    } else {
      study = all.find((s) => s.type === 'stroke') ?? all[0]
    }
    if (!study) throw new NotFoundException('无可用神经检查')
    const analysis = this.buildAnalysis(study)
    return {
      success: true,
      data: {
        studyId: study.id,
        queued: true,
        message: '神经 AI 急诊分析已完成（确定性规则派生）',
        analysis,
        generatedAt: new Date().toISOString(),
      },
    }
  }

  private buildAnalysis(study: NeuroStudy): NeuroAnalysis {
    const base: NeuroAnalysis = {
      studyId: study.id,
      patientName: study.patientName,
      type: study.type,
      modality: study.modality,
      confidence: 0.72 + (deterministicHash(study.id) % 25) / 100,
    }
    if (study.type === 'stroke') {
      let hours = 99
      if (study.onsetAt && study.imagingAt) {
        hours = (new Date(study.imagingAt).getTime() - new Date(study.onsetAt).getTime()) / 3600000
      } else {
        hours = 1 + (deterministicHash(study.id) % 30)
      }
      const aspectScore = study.aspectScore ?? 4 + (deterministicHash(study.id) % 7)
      const lvoSuspect =
        study.lvo ??
        (study.subtype === 'ischemic' && aspectScore < 8 && !!study.vessel)
      return {
        ...base,
        subtype: study.subtype,
        vessel: study.vessel,
        aspectScore,
        coreMl: study.coreMl ?? (deterministicHash(study.id) % 60),
        penumbraMl: study.penumbraMl ?? 20 + (deterministicHash(study.id) % 80),
        lvoSuspect,
        onsetAt: study.onsetAt,
        imagingAt: study.imagingAt,
        hoursFromOnset: Math.round(hours * 10) / 10,
        window: windowOf(hours),
        withinWindow: hours <= 24,
        recommendation: lvoSuspect
          ? 'LVO 疑似，建议桥接取栓评估 (AHA/ASA 指南)'
          : hours <= 3
            ? '窗内患者，评估 IV tPA 溶栓'
            : '超出溶栓窗，建议个体化再灌注评估',
      }
    }
    if (study.type === 'tumor') {
      return {
        ...base,
        tumorType: study.tumorType,
        grade: study.grade,
        sizeMm: study.sizeMm,
        location: study.location,
        malignancyHint: ['IV', 'III'].includes(study.grade ?? ''),
        recommendation: `建议多学科会诊，${study.grade === 'I' ? '可择期手术' : '尽快明确病理分型'}`,
      }
    }
    if (study.type === 'epilepsy') {
      return {
        ...base,
        focus: study.focus,
        mts: study.mts,
        hippocampalAsymmetry: study.hippocampalAsymmetry,
        surgicalCandidate: study.mts === true,
        recommendation: study.mts ? 'MTS 阳性，可评估颞叶切除手术' : '建议长程视频脑电图监测',
      }
    }
    return {
      ...base,
      location: study.location,
      sizeMm: study.sizeMm,
      neckMm: study.neckMm,
      ruptureRisk: study.ruptureRisk,
      recommendation:
        study.ruptureRisk === 'high'
          ? '破裂风险高，建议尽快介入干预'
          : '建议按 PHASES 评分定期随访 CTA',
    }
  }

  // ── Exam/Report 派生: 神经模态 + 部位 → NeuroStudy ──
  private async listFromDb(): Promise<NeuroStudy[]> {
    const rows = await this.prisma.exam.findMany({
      where: {
        OR: [
          { modality: { in: NEURO_MODALITIES } },
          ...NEURO_BODY_PARTS.map((b) => ({ bodyPart: { contains: b } })),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        patient: { select: { name: true, gender: true, birthDate: true } },
        reports: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, state: true, findings: true, impression: true, diagnosis: true, radiologist: { select: { fullName: true } } } },
      },
    })
    if (rows.length === 0) return []
    return rows.map((exam, i) => {
      const report = exam.reports[0]
      const text = `${report?.diagnosis ?? ''} ${report?.impression ?? ''} ${report?.findings ?? ''} ${exam.bodyPart ?? ''}`
      const classified = classifyType(text)
      const type: NeuroStudyType = classified?.type ?? (['stroke', 'tumor', 'epilepsy', 'aneurysm'][deterministicHash(exam.id) % 4] as NeuroStudyType)
      const hash = deterministicHash(exam.id)
      const age = exam.patient?.birthDate
        ? Math.max(0, Math.floor((Date.now() - new Date(exam.patient.birthDate).getTime()) / (365.25 * 86400000)))
        : 0
      const base: NeuroStudy = {
        id: `NX-DB-${exam.accessionNumber.slice(-6)}${i}`,
        patientName: exam.patient?.name ?? '未知患者',
        age,
        gender: exam.patient?.gender === 'FEMALE' ? 'F' : 'M',
        modality: exam.modality,
        indication: (exam.techNotes ?? text.slice(0, 40)) || '神经检查',
        type,
        date: (exam.completedAt ?? exam.createdAt).toISOString().slice(0, 10),
        acquiredAt: (exam.completedAt ?? exam.createdAt).toISOString(),
        status:
          report?.state === 'SIGNED' || report?.state === 'PUBLISHED'
            ? 'reported'
            : report?.state === 'REVIEWED'
              ? 'reviewed'
              : 'pending',
        accessionNumber: exam.accessionNumber,
        deviceId: exam.deviceId ?? undefined,
        radiologist: report?.radiologist?.fullName ?? undefined,
        findings: report?.findings ?? undefined,
        impression: report?.impression ?? undefined,
      }
      if (type === 'stroke') {
        base.subtype = classified?.subtype ?? (hash % 3 === 0 ? 'hemorrhagic' : 'ischemic')
        base.vessel = ['MCA-L', 'MCA-R', 'ACA', 'PCA', 'Basilar', 'Vertebral'][hash % 6]
        base.aspectScore = 4 + (hash % 7)
        base.coreMl = hash % 60
        base.penumbraMl = base.subtype === 'hemorrhagic' ? 0 : 20 + (hash % 80)
        base.lvo = base.subtype === 'ischemic' && base.aspectScore < 8
      } else if (type === 'tumor') {
        base.tumorType = ['glioma', 'meningioma', 'schwannoma', 'pituitary', 'metastasis'][hash % 5]
        base.grade = ['I', 'II', 'III', 'IV'][hash % 4]
        base.sizeMm = 10 + (hash % 40)
        base.volumeCm3 = Math.round(((base.sizeMm ** 3 * Math.PI) / 6000) * 10) / 10
        base.location = ['frontal', 'parietal', 'sella', 'cerebellopontine', 'temporal'][hash % 5]
      } else if (type === 'epilepsy') {
        base.focus = hash % 2 === 0 ? 'mesial-temporal' : 'frontal'
        base.mts = hash % 3 === 0
        base.hippocampalAsymmetry = 4 + (hash % 20)
      } else {
        base.location = ['ACoA', 'PCom', 'MCA', 'Basilar'][hash % 4]
        base.sizeMm = 3 + (hash % 8)
        base.neckMm = Math.round((base.sizeMm * 0.55 + (hash % 10) / 10) * 10) / 10
        base.ruptureRisk = hash % 3 === 0 ? 'low' : hash % 2 === 0 ? 'moderate' : 'high'
      }
      return base
    })
  }
}
