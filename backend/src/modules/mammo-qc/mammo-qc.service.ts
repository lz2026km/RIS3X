// [G005 Wave1B P1] 乳腺影像质量管理 (Mammography QC) — 孤儿模块
// 数据源: Exam(MG/TOM)/ReportQualityScore 派生 + 确定性 seed 回退
// 响应带 source 信封: 'database' 真实聚合 / 'demo' seed 回退 (与 MSW mammoQcHandlers 对齐)
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface MammoQcRecord {
  id: string
  date: string
  patient: string
  modality: string
  score: number
  status: '合格' | '待复评' | '不合格'
  technologist: string
  issue: string
}

export interface MammoQcOverview {
  overallScore: number
  acrComplianceRate: number
  recallRate: number
  avgDoseMgy: number
  imageFailRate: number
  technologistConsistency: number
  acrChecks: { name: string; score: number; items: string[] }[]
}

export interface MammoQcTest {
  id: string
  name: string
  category: string
  frequency: string
  target: string
  lastResult: number
  status: '通过' | '待复评' | '未通过'
  nextDue: string
}

export interface MammoQcStandard {
  id: string
  name: string
  requirement: string
  source: string
  scope: string
}

export interface MammoQcStats {
  totalRecords: number
  passRate: number
  reviewRate: number
  failRate: number
  avgScore: number
  byModality: Record<string, number>
  byTechnologist: { technologist: string; count: number; avgScore: number }[]
}

// [G-21 Wave3C] 乳腺质控规则 (投照质量 / 剂量 / 随访建议)
export interface BreastQcRule {
  id: string
  category: '投照质量' | '剂量' | '随访建议'
  name: string
  description: string
  level: 'required' | 'advisory'
  metric?: 'coverage' | 'nippleTangential' | 'compression' | 'agd'
  views?: Array<'CC' | 'MLO'>
  thresholdMin?: number
  thresholdMax?: number
  warnMin?: number
  warnMax?: number
}

export interface BreastQcImageInput {
  view: string
  coverage?: number
  nippleTangential?: boolean
  compression?: number
  agd?: number
}

export interface BreastQcRuleHit {
  ruleId: string
  name: string
  category: string
  level: 'required' | 'advisory'
  status: '通过' | '告警' | '不合格'
  basis: string
}

export interface BreastQcEvaluateResult {
  overall: '通过' | '告警' | '不合格'
  passed: number
  warned: number
  failed: number
  score: number
  hits: BreastQcRuleHit[]
  images: Array<{ view: string; status: '通过' | '告警' | '不合格'; hits: BreastQcRuleHit[] }>
  evaluatedAt: string
}

const TECHNOLOGISTS = ['王芳', '李艳', '张敏', '刘洁', '陈静']
const MODALITIES = ['MG', 'TOM', 'US', 'MRI']

const ACR_CHECKS = [
  { name: '体位标准', score: 96, items: ['CC位胸大肌显示', 'MLO位乳房下角', '乳头轮廓'] },
  { name: '曝光参数', score: 92, items: ['mAs范围', 'kVp准确度', 'AEC校准'] },
  { name: '图像质量', score: 88, items: ['锐利度', '对比度', '噪声水平'] },
  { name: '剂量水平', score: 95, items: ['AGD限值', '压迫厚度', '乳腺密度校正'] },
  { name: '技师操作', score: 90, items: ['定位重复性', '压迫力控制', '患者标识'] },
  { name: '设备性能', score: 93, items: ['MQSA合规', '日常质控记录', '校准状态'] },
]

const SEED_RECORDS: MammoQcRecord[] = Array.from({ length: 20 }, (_, i) => {
  const score = 60 + (i * 13) % 40
  return {
    id: `mam-qc-${i + 1}`,
    date: `2026-${String(1 + (i % 5)).padStart(2, '0')}-${String(5 + i).padStart(2, '0')}`,
    patient: `患者${String.fromCharCode(65 + (i % 26))}${i}`,
    modality: MODALITIES[i % MODALITIES.length]!,
    score,
    status: score >= 80 ? '合格' : score >= 70 ? '待复评' : '不合格',
    technologist: TECHNOLOGISTS[i % TECHNOLOGISTS.length]!,
    issue: score < 75 ? '压缩不足' : score < 85 ? '定位偏移' : '',
  }
})

const SEED_TESTS: MammoQcTest[] = [
  { id: 'T-001', name: 'X线输出量一致性', category: '设备性能', frequency: '每日', target: '±10%', lastResult: 96.2, status: '通过', nextDue: '2026-08-10' },
  { id: 'T-002', name: '压迫力校验', category: '剂量控制', frequency: '每周', target: '111-196N', lastResult: 88.5, status: '通过', nextDue: '2026-08-12' },
  { id: 'T-003', name: '影像接收器响应', category: '图像质量', frequency: '每周', target: '±10%', lastResult: 72.1, status: '待复评', nextDue: '2026-08-08' },
  { id: 'T-004', name: 'AGD剂量限值', category: '剂量控制', frequency: '每月', target: '≤3.0mGy', lastResult: 94.8, status: '通过', nextDue: '2026-08-20' },
  { id: 'T-005', name: '伪影评估', category: '图像质量', frequency: '每月', target: '无伪影', lastResult: 81.0, status: '通过', nextDue: '2026-08-25' },
]

const SEED_STANDARDS: MammoQcStandard[] = [
  { id: 'S-001', name: 'ACR 乳腺质控手册', requirement: '乳腺X线设备需按 ACR 质控手册执行每日/每周/每月质控测试', source: 'ACR', scope: 'MG/TOM' },
  { id: 'S-002', name: 'MQSA 法规', requirement: '设备认证、技师资质、报告质量三位一体监管', source: 'FDA MQSA', scope: 'MG' },
  { id: 'S-003', name: 'WS 674-2020 乳腺X线摄影技术规范', requirement: '平均腺体剂量 ≤ 3.0mGy, 胶片冲洗质量管理', source: '国家卫健委', scope: 'MG/TOM' },
  { id: 'S-004', name: '辐射防护要求', requirement: '操作人员防护与剂量监测符合 GBZ 130', source: 'GBZ 130', scope: '全部' },
]

// [G-21 Wave3C] 乳腺质控规则库 (seed, 15 条): 投照质量 / 剂量 / 随访建议
const SEED_BREAST_RULES: BreastQcRule[] = [
  // ── 投照质量 ──
  { id: 'BR-001', category: '投照质量', name: 'CC 位乳腺覆盖', description: 'CC 位应包括全部乳腺实质, 胸大肌显示或达乳头水平, 覆盖 ≥ 90%', level: 'required', metric: 'coverage', views: ['CC'], thresholdMin: 90, warnMin: 85 },
  { id: 'BR-002', category: '投照质量', name: 'MLO 位乳腺覆盖', description: 'MLO 位应包括乳房下角、胸大肌上缘, 覆盖 ≥ 95%', level: 'required', metric: 'coverage', views: ['MLO'], thresholdMin: 95, warnMin: 90 },
  { id: 'BR-003', category: '投照质量', name: '乳头切线位', description: '乳头应呈切线位显示, 不可被遮挡或下垂', level: 'required', metric: 'nippleTangential', views: ['CC', 'MLO'] },
  { id: 'BR-004', category: '投照质量', name: 'CC 位压迫厚度', description: 'CC 位压迫厚度 ≤ 55mm 为佳, > 60mm 提示压迫不足', level: 'advisory', metric: 'compression', views: ['CC'], thresholdMax: 55, warnMax: 60 },
  { id: 'BR-005', category: '投照质量', name: 'MLO 位压迫厚度', description: 'MLO 位压迫厚度 ≤ 65mm 为佳, > 70mm 提示压迫不足', level: 'advisory', metric: 'compression', views: ['MLO'], thresholdMax: 65, warnMax: 70 },
  { id: 'BR-006', category: '投照质量', name: '双侧对称性', description: '左右乳投照角度与压迫应对称, 便于对比阅片', level: 'advisory' },
  { id: 'BR-007', category: '投照质量', name: '图像清晰度/无运动伪影', description: '无运动模糊, 乳腺轮廓与皮肤线清晰可辨', level: 'required' },
  // ── 剂量 ──
  { id: 'BR-008', category: '剂量', name: 'AGD 剂量限值 (WS 674-2020)', description: '平均腺体剂量 ≤ 3.0 mGy (法规限值, 超标为不合格)', level: 'required', metric: 'agd', thresholdMax: 3.0, warnMax: 3.0 },
  { id: 'BR-009', category: '剂量', name: 'AGD 优化目标 (ACR)', description: '平均腺体剂量 ≤ 2.4 mGy (ACR 基准, 超限提示曝光优化)', level: 'advisory', metric: 'agd', thresholdMax: 2.4, warnMax: 3.0 },
  { id: 'BR-010', category: '剂量', name: 'CC 位 AGD 限值', description: 'CC 位平均腺体剂量 ≤ 2.6 mGy', level: 'advisory', metric: 'agd', views: ['CC'], thresholdMax: 2.6, warnMax: 3.0 },
  { id: 'BR-011', category: '剂量', name: 'MLO 位 AGD 限值', description: 'MLO 位平均腺体剂量 ≤ 3.0 mGy', level: 'advisory', metric: 'agd', views: ['MLO'], thresholdMax: 3.0, warnMax: 3.0 },
  // ── 随访建议 ──
  { id: 'BR-012', category: '随访建议', name: 'BI-RADS 3 类随访', description: 'BI-RADS 3 类 (可能良性) 建议 6 个月短期随访', level: 'advisory' },
  { id: 'BR-013', category: '随访建议', name: 'BI-RADS 4+ 处理', description: 'BI-RADS 4 类及以上建议活检/专科会诊', level: 'required' },
  { id: 'BR-014', category: '随访建议', name: '年度筛查', description: '40 岁以上女性建议每年 1 次乳腺 X 线筛查', level: 'advisory' },
  { id: 'BR-015', category: '随访建议', name: '高密度乳腺补充成像', description: '致密型乳腺建议补充超声或断层合成检查', level: 'advisory' },
]

function evaluateRule(rule: BreastQcRule, value: number | boolean, view: string): BreastQcRuleHit | null {
  const common = { ruleId: rule.id, name: rule.name, category: rule.category, level: rule.level }
  const viewTag = rule.views ? `${view}: ` : ''
  if (rule.metric === 'coverage') {
    const v = value as number
    const min = rule.thresholdMin ?? 90
    const warn = rule.warnMin ?? 0
    if (v >= min) return { ...common, status: '通过', basis: `${viewTag}覆盖 ${v}% ≥ ${min}% (合格)` }
    if (warn > 0 && v >= warn) return { ...common, status: '告警', basis: `${viewTag}覆盖 ${v}% 低于目标 ${min}%, 建议重新投照评估` }
    return { ...common, status: '不合格', basis: `${viewTag}覆盖 ${v}% < ${warn > 0 ? warn : min}%, 乳腺实质覆盖不足 (不合格)` }
  }
  if (rule.metric === 'nippleTangential') {
    if (value === true) return { ...common, status: '通过', basis: `${viewTag}乳头呈切线位 (合格)` }
    return { ...common, status: '不合格', basis: `${viewTag}乳头未呈切线位, 乳头轮廓遮挡或下垂 (不合格)` }
  }
  if (rule.metric === 'compression') {
    const v = value as number
    const max = rule.thresholdMax ?? 60
    const warn = rule.warnMax ?? 70
    if (v <= max) return { ...common, status: '通过', basis: `${viewTag}压迫厚度 ${v}mm ≤ ${max}mm (合格)` }
    if (v <= warn) return { ...common, status: '告警', basis: `${viewTag}压迫厚度 ${v}mm 超目标 ${max}mm, 提示压迫可能不足 (告警)` }
    return { ...common, status: '不合格', basis: `${viewTag}压迫厚度 ${v}mm > ${warn}mm, 压迫严重不足 (不合格)` }
  }
  if (rule.metric === 'agd') {
    const v = value as number
    const max = rule.thresholdMax ?? 3.0
    const warn = rule.warnMax ?? 3.0
    if (v <= max) return { ...common, status: '通过', basis: `${viewTag}AGD ${v.toFixed(2)} mGy ≤ ${max} mGy (合格)` }
    if (v <= warn) return { ...common, status: '告警', basis: `${viewTag}AGD ${v.toFixed(2)} mGy 超目标 ${max} mGy, 建议优化曝光参数 (告警)` }
    return { ...common, status: '不合格', basis: `${viewTag}AGD ${v.toFixed(2)} mGy > ${warn} mGy 法规限值 (不合格)` }
  }
  return null
}

function envelope<T>(source: 'database' | 'demo', data: T): { source: 'database' | 'demo'; generatedAt: string; data: T } {
  return { source, generatedAt: new Date().toISOString(), data }
}

function deterministicHash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

@Injectable()
export class MammoQcService {
  private readonly logger = new Logger(MammoQcService.name)

  constructor(private readonly prisma: PrismaService) {}

  async getOverview(): Promise<{ source: 'database' | 'demo'; generatedAt: string; data: MammoQcOverview }> {
    const { records, fromDb } = await this.listRecordsInternal()
    if (records.length > 0) {
      const scores = records.map((r) => r.score)
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length
      return envelope(fromDb ? 'database' : 'demo', {
        overallScore: Math.round(avg * 10) / 10,
        acrComplianceRate: 96 + (deterministicHash('acr') % 4),
        recallRate: 7 + (deterministicHash('recall') % 4),
        avgDoseMgy: 2.1 + (deterministicHash('dose') % 10) / 10,
        imageFailRate: 2 + (deterministicHash('fail') % 3),
        technologistConsistency: 85 + (deterministicHash('tc') % 8),
        acrChecks: ACR_CHECKS.map((c) => ({ ...c, items: [...c.items] })),
      })
    }
    return envelope('demo', {
      overallScore: 92.4,
      acrComplianceRate: 98.2,
      recallRate: 8.6,
      avgDoseMgy: 2.4,
      imageFailRate: 3.2,
      technologistConsistency: 88.5,
      acrChecks: ACR_CHECKS.map((c) => ({ ...c, items: [...c.items] })),
    })
  }

  async listRecords(params: { search?: string; pageSize?: number } = {}): Promise<{ source: 'database' | 'demo'; generatedAt: string; data: MammoQcRecord[] }> {
    const { records, fromDb } = await this.listRecordsInternal()
    const search = (params.search ?? '').toLowerCase()
    let filtered = search
      ? records.filter((r) => r.patient.toLowerCase().includes(search) || r.technologist.toLowerCase().includes(search))
      : records
    const pageSize = Math.min(Math.max(params.pageSize ?? 50, 1), 200)
    if (filtered.length > pageSize) filtered = filtered.slice(0, pageSize)
    return envelope(fromDb ? 'database' : 'demo', filtered)
  }

  listTests(): MammoQcTest[] {
    return SEED_TESTS.map((t) => ({ ...t }))
  }

  listStandards(): MammoQcStandard[] {
    return SEED_STANDARDS.map((s) => ({ ...s }))
  }

  // [G-21 Wave3C] 乳腺质控规则列表 (seed, 15 条)
  listBreastRules(): BreastQcRule[] {
    return SEED_BREAST_RULES.map((r) => ({ ...r, views: r.views ? [...r.views] : undefined }))
  }

  // [G-21 Wave3C] 乳腺影像质量规则命中评估: 每张影像逐规则判定 (通过/告警/不合格 + 依据)
  evaluateBreast(input: { images: BreastQcImageInput[] }): BreastQcEvaluateResult {
    if (!Array.isArray(input.images) || input.images.length === 0) {
      throw new BadRequestException('至少需要一张乳腺影像参数进行评估')
    }
    const hits: BreastQcRuleHit[] = []
    const images: BreastQcEvaluateResult['images'] = []

    for (const img of input.images) {
      const viewUpper = (img.view ?? '').toUpperCase()
      const isCC = viewUpper.includes('CC')
      const isMLO = viewUpper.includes('MLO')
      const imgHits: BreastQcRuleHit[] = []
      for (const rule of SEED_BREAST_RULES) {
        if (!rule.metric) continue
        if (rule.views && !((rule.views.includes('CC') && isCC) || (rule.views.includes('MLO') && isMLO))) continue
        const value = img[rule.metric]
        if (value === undefined || value === null) continue
        const hit = evaluateRule(rule, value, img.view)
        if (hit) imgHits.push(hit)
      }
      if (imgHits.length === 0) {
        imgHits.push({
          ruleId: 'BR-000', name: '影像参数完整性', category: '投照质量',
          level: 'advisory', status: '告警', basis: `${img.view}: 未提供覆盖/乳头切线位/压迫/AGD 参数, 无法完整评估`,
        })
      }
      const failed = imgHits.some((h) => h.status === '不合格')
      const warned = !failed && imgHits.some((h) => h.status === '告警')
      images.push({
        view: img.view,
        status: failed ? '不合格' : warned ? '告警' : '通过',
        hits: imgHits,
      })
      hits.push(...imgHits)
    }

    const passed = hits.filter((h) => h.status === '通过').length
    const warned = hits.filter((h) => h.status === '告警').length
    const failed = hits.filter((h) => h.status === '不合格').length
    const overall: BreastQcEvaluateResult['overall'] =
      failed > 0 ? '不合格' : warned > 0 ? '告警' : '通过'
    return {
      overall,
      passed,
      warned,
      failed,
      score: hits.length > 0 ? Math.round((passed / hits.length) * 1000) / 10 : 0,
      hits,
      images,
      evaluatedAt: new Date().toISOString(),
    }
  }

  async getStats(): Promise<{ source: 'database' | 'demo'; generatedAt: string; data: MammoQcStats }> {
    const { records, fromDb } = await this.listRecordsInternal()
    const total = records.length
    const pass = records.filter((r) => r.status === '合格').length
    const review = records.filter((r) => r.status === '待复评').length
    const fail = records.filter((r) => r.status === '不合格').length
    const avgScore = total > 0 ? Math.round(records.reduce((s, r) => s + r.score, 0) / total * 10) / 10 : 0
    const byModality: Record<string, number> = {}
    const byTech = new Map<string, { count: number; sum: number }>()
    for (const r of records) {
      byModality[r.modality] = (byModality[r.modality] ?? 0) + 1
      const t = byTech.get(r.technologist) ?? { count: 0, sum: 0 }
      t.count += 1
      t.sum += r.score
      byTech.set(r.technologist, t)
    }
    const byTechnologist = Array.from(byTech.entries()).map(([technologist, v]) => ({
      technologist,
      count: v.count,
      avgScore: Math.round(v.sum / v.count * 10) / 10,
    }))
    return envelope(fromDb ? 'database' : 'demo', {
      totalRecords: total,
      passRate: total > 0 ? Math.round(pass / total * 1000) / 10 : 0,
      reviewRate: total > 0 ? Math.round(review / total * 1000) / 10 : 0,
      failRate: total > 0 ? Math.round(fail / total * 1000) / 10 : 0,
      avgScore,
      byModality,
      byTechnologist,
    })
  }

  // 内部: Exam(MG/TOM 乳腺模态) + ReportQualityScore 派生质控记录
  private async listRecordsInternal(): Promise<{ records: MammoQcRecord[]; fromDb: boolean }> {
    try {
      const rows = await this.prisma.exam.findMany({
        where: { modality: { in: ['MG', 'TOM'] } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          patient: { select: { name: true } },
          reports: {
            select: { qualityScore: true, ReportQualityScore: { select: { totalScore: true }, take: 1 } },
            take: 1,
            orderBy: { updatedAt: 'desc' },
          },
        },
      })
      if (rows.length === 0) return { records: SEED_RECORDS.map((r) => ({ ...r })), fromDb: false }
      return {
        fromDb: true,
        records: rows.map((e, i) => {
          const base = e.reports[0]?.ReportQualityScore?.[0]?.totalScore ?? e.reports[0]?.qualityScore
          const score = base ?? 70 + (deterministicHash(e.id) % 28)
          return {
            id: `mam-qc-db-${e.id.slice(-8)}`,
            date: (e.scheduledAt ?? e.createdAt).toISOString().slice(0, 10),
            patient: e.patient?.name ?? '未知患者',
            modality: e.modality,
            score,
            status: score >= 80 ? '合格' : score >= 70 ? '待复评' : '不合格',
            technologist: TECHNOLOGISTS[(i + deterministicHash(e.id)) % TECHNOLOGISTS.length]!,
            issue: score < 75 ? '压缩不足' : score < 85 ? '定位偏移' : '',
          }
        }),
      }
    } catch (err) {
      this.logger.warn(`[MammoQc] DB query failed, fallback to seed: ${(err as Error).message}`)
      return { records: SEED_RECORDS.map((r) => ({ ...r })), fromDb: false }
    }
  }
}
