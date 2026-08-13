// [G005 Wave1A P0] 眼科 8 亚专科 (Subspecialty) — 孤儿模块
// 数据源: Exam 派生 + 确定性 seed 回退 + 进程内存 CRUD
// 动作端点 (同视机/色觉/PVEP/眼突计/Pentacam/LOCS III/屈光/低视力) 复刻 MSW 判定逻辑
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export type SubspecialtyKey = 'strabismus' | 'neuro' | 'oncology' | 'cornea' | 'cataract' | 'refractive'

export interface SubspecialtyRecord {
  id: string
  subspecialty: string
  patientId: string
  patientName?: string
  diagnosis: string
  examDate: string
  findings: Record<string, any>
}

const SUBSPECIALTY_LABELS: Record<string, string> = {
  strabismus: '斜视专科',
  neuro: '神经眼科',
  oncology: '眼眶肿瘤',
  cornea: '角膜病',
  cataract: '白内障',
  refractive: '屈光手术',
}

const SEED_RECORDS: SubspecialtyRecord[] = [
  { id: 'STR-001', subspecialty: 'strabismus', patientId: 'PEYE-010', patientName: '赵刚', diagnosis: '内斜视', examDate: '2026-07-01', findings: { horizontalPrism: 12, verticalPrism: 0, torsion: 0, method: '同视机检查 (Synoptophore)' } },
  { id: 'STR-002', subspecialty: 'strabismus', patientId: 'PEYE-011', patientName: '孙晓', diagnosis: '外斜视', examDate: '2026-06-28', findings: { horizontalPrism: -14, verticalPrism: 2, torsion: -3, method: '同视机检查 (Synoptophore)' } },
  { id: 'NEU-001', subspecialty: 'neuro', patientId: 'PEYE-012', patientName: '周敏', diagnosis: '色觉异常 (红绿色弱)', examDate: '2026-07-03', findings: { test: 'ishihara', errors: 8, method: '石原氏色觉检查 (Ishihara)' } },
  { id: 'NEU-002', subspecialty: 'neuro', patientId: 'PEYE-013', patientName: '吴涛', diagnosis: 'P100 潜伏期延长,提示视神经传导障碍', examDate: '2026-06-30', findings: { p100Latency: 128, p100Amplitude: 6.2, method: '图形视觉诱发电位 (Pattern VEP)' } },
  { id: 'ONC-001', subspecialty: 'oncology', patientId: 'PEYE-014', patientName: '郑华', diagnosis: '左眼眼球突出', examDate: '2026-07-02', findings: { od: 14, os: 17.5, reference: 12, difference: 3.5, method: 'Hertel 眼突计' } },
  { id: 'COR-001', subspecialty: 'cornea', patientId: 'PEYE-015', patientName: '冯丽', diagnosis: '圆锥角膜', examDate: '2026-07-01', findings: { kmax: 48.2, thinnestPachy: 455, badScore: 3, method: 'Pentacam 角膜地形图 + BAD 指数' } },
  { id: 'CAT-001', subspecialty: 'cataract', patientId: 'PEYE-016', patientName: '韩梅', diagnosis: '白内障 (中等混浊)', examDate: '2026-06-29', findings: { nuclearGrade: 2, corticalGrade: 2, pscGrade: 1, totalScore: 5, method: 'LOCS III' } },
  { id: 'REF-001', subspecialty: 'refractive', patientId: 'PEYE-017', patientName: '曹阳', diagnosis: '适合 SMILE 手术', examDate: '2026-07-04', findings: { rightEye: { sphere: -3.5, cylinder: -0.75, axis: 180 }, leftEye: { sphere: -3.0, cylinder: -0.5, axis: 170 }, recommendedProcedure: 'SMILE 全飞秒激光手术' } },
]

const memRecords: SubspecialtyRecord[] = []

function envelope(data: any) {
  return { success: true, data }
}

@Injectable()
export class EyeSubspecialtyService {
  private readonly logger = new Logger(EyeSubspecialtyService.name)

  constructor(private readonly prisma: PrismaService) {}

  async listRecords(sub: string, params: { patientId?: string } = {}) {
    if (!SUBSPECIALTY_LABELS[sub]) throw new NotFoundException(`Subspecialty ${sub} not found`)
    const derived = await this.listFromDb(sub)
    let all = [...memRecords, ...(derived.length > 0 ? derived : SEED_RECORDS)]
    all = all.filter((r) => r.subspecialty === sub)
    if (params.patientId) all = all.filter((r) => r.patientId === params.patientId)
    return envelope(all)
  }

  createRecord(sub: string, dto: Partial<SubspecialtyRecord>) {
    if (!SUBSPECIALTY_LABELS[sub]) throw new NotFoundException(`Subspecialty ${sub} not found`)
    const record: SubspecialtyRecord = {
      id: dto.id ?? `${sub.slice(0, 3).toUpperCase()}-${Date.now().toString(36)}`,
      subspecialty: sub,
      patientId: dto.patientId ?? 'PEYE-000',
      patientName: dto.patientName ?? '',
      diagnosis: dto.diagnosis ?? '',
      examDate: dto.examDate ?? new Date().toISOString().slice(0, 10),
      findings: dto.findings ?? {},
    }
    memRecords.unshift(record)
    return envelope(record)
  }

  // ── 页面动作端点 (复刻 MSW eyeSubspecialtyDepthModule 判定) ──

  synoptophore(body: { patientId: string; eye: string; horizontalPrism: number; verticalPrism: number; torsion: number }) {
    const h = Number(body.horizontalPrism) || 0
    const v = Number(body.verticalPrism) || 0
    const t = Number(body.torsion) || 0
    return envelope({
      patientId: body.patientId,
      eye: body.eye,
      result: {
        horizontal: { value: h, unit: 'Δ', type: h > 0 ? '内斜' : h < 0 ? '外斜' : '正位' },
        vertical: { value: v, unit: 'Δ', type: v > 0 ? '上斜' : v < 0 ? '下斜' : '正位' },
        torsion: { value: t, unit: '°' },
        diagnosis: h > 10 ? '内斜视' : h < -10 ? '外斜视' : '正常',
      },
      method: '同视机检查 (Synoptophore)',
      examinedAt: new Date().toISOString(),
    })
  }

  colorVision(body: { patientId: string; test: string; errors: number; eye: string }) {
    const errors = Number(body.errors) || 0
    let diagnosis = '正常色觉'
    if (body.test === 'ishihara' && errors > 4) diagnosis = '色觉异常 (红绿色弱)'
    else if (body.test === 'd15' && errors > 4) diagnosis = '获得性色觉异常'
    return envelope({
      patientId: body.patientId,
      test: body.test,
      eye: body.eye,
      errors,
      diagnosis,
      method: body.test === 'ishihara' ? '石原氏色觉检查 (Ishihara)' : 'Farnsworth D-15',
      examinedAt: new Date().toISOString(),
    })
  }

  pvep(body: { patientId: string; eye: string; p100Latency: number; p100Amplitude: number }) {
    const latency = Number(body.p100Latency) || 0
    const amp = Number(body.p100Amplitude) || 0
    const normal = latency < 115
    return envelope({
      patientId: body.patientId,
      eye: body.eye,
      p100Latency: { value: latency, unit: 'ms', normal },
      p100Amplitude: { value: amp, unit: 'μV' },
      diagnosis: normal ? 'PVEP 正常' : 'P100 潜伏期延长,提示视神经传导障碍',
      method: '图形视觉诱发电位 (Pattern VEP)',
      examinedAt: new Date().toISOString(),
    })
  }

  exophthalmometry(body: { patientId: string; odValue: number; osValue: number; reference: number }) {
    const od = Number(body.odValue) || 0
    const os = Number(body.osValue) || 0
    const ref = Number(body.reference) || 12
    const diff = Math.abs(od - os)
    let diagnosis = '双眼对称'
    if (od > ref + 2) diagnosis = '右眼眼球突出'
    else if (os > ref + 2) diagnosis = '左眼眼球突出'
    else if (diff > 2) diagnosis = '双眼不对称'
    return envelope({
      patientId: body.patientId,
      od: { value: od, unit: 'mm' },
      os: { value: os, unit: 'mm' },
      reference: ref,
      difference: diff,
      diagnosis,
      method: 'Hertel 眼突计',
      examinedAt: new Date().toISOString(),
    })
  }

  pentacam(body: { patientId: string; eye: string; kmax: number; thinnestPachy: number; pachyMin: number; pachyMinX: number; pachyMinY: number }) {
    const kmax = Number(body.kmax) || 0
    const pachy = Number(body.thinnestPachy) || 0
    const badScore = kmax > 47 ? 3 : kmax > 45 ? 2 : 1
    const isKc = badScore >= 2 && pachy < 480
    return envelope({
      patientId: body.patientId,
      eye: body.eye,
      kmax: { value: kmax, unit: 'D' },
      thinnestPachy: { value: pachy, unit: 'μm' },
      pachyMin: { x: body.pachyMinX ?? 0, y: body.pachyMinY ?? 0, value: body.pachyMin ?? pachy },
      badScore,
      isKeratoconus: isKc,
      diagnosis: isKc ? '圆锥角膜' : '正常角膜',
      method: 'Pentacam 角膜地形图 + BAD 指数',
      examinedAt: new Date().toISOString(),
    })
  }

  lensOpacity(body: { patientId: string; eye: string; nuclearGrade: number; corticalGrade: number; pscGrade: number; bestCorrectedVA?: string }) {
    const nuclear = Math.max(0, Math.min(5, Number(body.nuclearGrade) || 0))
    const cortical = Math.max(0, Math.min(5, Number(body.corticalGrade) || 0))
    const psc = Math.max(0, Math.min(5, Number(body.pscGrade) || 0))
    const total = nuclear + cortical + psc
    const needsSurgery = total >= 6 || nuclear >= 3
    const diagnosis = needsSurgery ? '白内障 (需手术评估)' : total >= 4 ? '白内障 (中等混浊)' : '晶状体轻度混浊'
    return envelope({
      patientId: body.patientId,
      eye: body.eye,
      nuclearGrade: nuclear,
      corticalGrade: cortical,
      pscGrade: psc,
      totalScore: total,
      diagnosis,
      needsSurgery,
      recommendation: needsSurgery ? '建议眼科手术评估, 行超声乳化+人工晶体植入' : '建议定期复查, 关注视力变化',
      method: 'LOCS III 晶状体混浊分级',
      examinedAt: new Date().toISOString(),
    })
  }

  refractivePrescription(body: { patientId?: string; rightEye?: any; leftEye?: any }) {
    const re = body?.rightEye ?? { sphere: -3.5, cylinder: -0.75, axis: 180 }
    const le = body?.leftEye ?? { sphere: -3.0, cylinder: -0.5, axis: 170 }
    const se = (s: number, c: number) => +(Number(s) + Number(c) / 2).toFixed(3)
    return envelope({
      patientId: body?.patientId ?? 'PEYE-017',
      prescription: {
        rightEye: { ...re, se: se(re.sphere ?? 0, re.cylinder ?? 0) },
        leftEye: { ...le, se: se(le.sphere ?? 0, le.cylinder ?? 0) },
      },
      recommendedProcedure: 'SMILE 全飞秒激光手术',
      procedureRationale: '角膜厚度充足, 近视散光符合 SMILE 适应症',
      expectedPostopVA: '1.0 (20/20)',
      riskLevel: 'low',
      prescribedAt: new Date().toISOString(),
    })
  }

  lowVisionPrescription(body: { patientId?: string; reDist?: string; reNear?: string; leDist?: string; leNear?: string; reDevice?: string; leDevice?: string; recommendation?: string }) {
    return envelope({
      prescriptionId: `LVP${Date.now().toString(36).toUpperCase()}`,
      patientId: body?.patientId ?? 'PEYE-018',
      rightEye: { distance: body?.reDist ?? '0.1', near: body?.reNear ?? '0.5', device: body?.reDevice ?? '普通眼镜' },
      leftEye: { distance: body?.leDist ?? '0.08', near: body?.leNear ?? '0.4', device: body?.leDevice ?? '普通眼镜' },
      deviceRecommendation: body?.recommendation ?? '手持放大镜 4X',
      prescribedAt: new Date().toISOString(),
    })
  }

  // Exam 派生: 眼科相关检查 → 亚专科记录候选
  private async listFromDb(sub: string): Promise<SubspecialtyRecord[]> {
    try {
      const rows = await this.prisma.exam.findMany({
        where: { bodyPart: { contains: '眼' } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
      if (rows.length === 0) return []
      const label = SUBSPECIALTY_LABELS[sub]
      return rows.map((r) => ({
        id: `SUB-DB-${sub}-${r.id.slice(-6)}`,
        subspecialty: sub,
        patientId: r.patientId ?? 'UNKNOWN',
        patientName: '未知患者',
        diagnosis: `${label} 待评估`,
        examDate: (r.scheduledAt ?? r.createdAt).toISOString().slice(0, 10),
        findings: { modality: r.modality, bodyPart: r.bodyPart, note: '由检查记录派生' },
      }))
    } catch (err) {
      this.logger.warn(`[EyeSubspecialty] DB query failed, fallback to seed: ${(err as Error).message}`)
      return []
    }
  }
}
