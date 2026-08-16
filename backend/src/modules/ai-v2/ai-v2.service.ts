/**
 * G005 RIS v3.0.6.11-101 Wave 3C - AI 增强服务 (孤儿模块, 无 Prisma 依赖)
 *
 * 三大能力:
 * 1. 多器官自动检出 (organ-detection): 8 类器官, 确定性模拟推理
 *    - 基于灰度统计特征 (均值/标准差 → HU 窗口拟合 + 对比度拟合), 非随机
 * 2. 报告草稿评分 (draft-score): 长度/结构/术语/单位 四维 0-100 + 改进建议
 * 3. 智能挂片 (smart-hanging): 确定性规则表推导布局 + 应用记录 + 医生历史偏好
 *
 * 孤儿模块模式: 不注入 PrismaService, 全部内存存储 + 内置 seed 回退,
 * 可无 DB 启动; 供 jest 离线测试。
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { hashString, intInRange, floatInRange } from '../../common/utils/deterministic-hash'
import {
  ORGAN_CATALOG,
  ORGAN_BY_CODE,
  expectedMeanRange,
  expectedContrastRange,
  type OrganCode,
  type OrganDef,
} from './organ-catalog'
import { findHangingRule, HANGING_RULES, type HangingRuleDef } from './hanging-rules'
import { scoreDraftText } from './draft-scoring'
import type { DraftInputStats } from './draft-scoring'

// ── 类型 ─────────────────────────────────────────────────────────────────────

export interface PixelStatsInput {
  mean?: number
  stddev?: number
  min?: number
  max?: number
  slices?: number
  width?: number
  height?: number
}

export interface OrganBBox {
  x: number
  y: number
  width: number
  height: number
}

export interface OrganMask {
  type: 'ellipse'
  cx: number
  cy: number
  rx: number
  ry: number
}

export interface OrganDetectionItem {
  code: OrganCode
  label: string
  /** 0-1, 确定性推导, 恒在 (0, 0.99] */
  confidence: number
  bbox: OrganBBox
  mask: OrganMask
  /** 体积估计 (mL) */
  volumeMl: number
  slices: number
  status: 'detected' | 'low-confidence'
  featureNote: string
}

export interface OrganDetectionResult {
  id: string
  studyId: string
  modality: string
  bodyPart: string
  pixelStats: Required<PixelStatsInput>
  organs: OrganDetectionItem[]
  organsDetected: number
  avgConfidence: number
  primaryOrgan: OrganCode | null
  modelVersion: string
  createdAt: string
}

export interface OrganAnalyzeInput {
  studyId: string
  modality: string
  bodyPart?: string
  pixelStats?: PixelStatsInput
}

export interface ReportParagraphResult {
  id: string
  studyId: string
  paragraph: string
  organCount: number
  generatedAt: string
}

export interface DraftScoreResult {
  id: string
  modality: string | null
  score: number
  grade: '优' | '良' | '中' | '差'
  dimensions: { key: string; label: string; weight: number; score: number }[]
  suggestions: { code: string; level: 'error' | 'warning' | 'info'; message: string }[]
  stats: DraftInputStats
  scoredAt: string
}

export interface DraftScoreInput {
  draftText: string
  modality?: string
  expectedSections?: string[]
}

export interface HangingSeriesInput {
  description?: string
  seriesNumber?: number
  images?: number
}

export interface HangingRecommendInput {
  examId?: string
  modality: string
  bodyPart?: string
  series?: HangingSeriesInput[]
  doctorId?: string
}

export interface HangingRecommendation {
  layoutId: string
  name: string
  rows: number
  cols: number
  cells: { index: number; label: string; seriesKey: string; windowWidth?: number; windowCenter?: number }[]
  score: number
  source: 'rule' | 'history'
  reasons: string[]
  matchedSeries: string[]
  alternatives: { layoutId: string; name: string; score: number }[]
  recommendedAt: string
}

export interface HangingApplyInput {
  examId: string
  layoutId: string
  appliedBy: string
}

export interface HangingApplication {
  id: string
  examId: string
  layoutId: string
  layoutName: string
  rows: number
  cols: number
  appliedBy: string
  appliedAt: string
}

// ── Seed 回退 (孤儿模块: 无 DB 时仍可展示历史应用记录) ──────────────────────

const SEED_APPLICATIONS: HangingApplication[] = [
  { id: 'app-seed-001', examId: 'EX-20260718-001', layoutId: 'hp-ct-chest', layoutName: 'CT 胸部 肺窗+纵隔窗', rows: 2, cols: 2, appliedBy: 'D1001', appliedAt: '2026-07-18T09:05:00.000Z' },
  { id: 'app-seed-002', examId: 'EX-20260719-003', layoutId: 'hp-mr-head', layoutName: 'MR 头颅 多序列', rows: 2, cols: 3, appliedBy: 'D1002', appliedAt: '2026-07-19T10:40:00.000Z' },
  { id: 'app-seed-003', examId: 'EX-20260720-007', layoutId: 'hp-dr-chest', layoutName: 'DR 胸部 正侧位', rows: 1, cols: 2, appliedBy: 'D1001', appliedAt: '2026-07-20T14:12:00.000Z' },
]

const SEED_DETECTIONS: OrganDetectionResult[] = [
  {
    id: 'od-seed-001',
    studyId: 'LS20260718-001',
    modality: 'CT',
    bodyPart: 'CHEST',
    pixelStats: { mean: -480, stddev: 265, min: -1024, max: 950, slices: 240, width: 512, height: 512 },
    organs: [
      { code: 'lung', label: '肺', confidence: 0.93, bbox: { x: 92, y: 120, width: 330, height: 262 }, mask: { type: 'ellipse', cx: 257, cy: 251, rx: 165, ry: 131 }, volumeMl: 4120, slices: 182, status: 'detected', featureNote: 'HU 均值 -621, 与空气窗高度吻合' },
      { code: 'heart', label: '心脏', confidence: 0.81, bbox: { x: 190, y: 196, width: 150, height: 140 }, mask: { type: 'ellipse', cx: 265, cy: 266, rx: 75, ry: 70 }, volumeMl: 640, slices: 96, status: 'detected', featureNote: '纵隔窗软组织对比清晰' },
      { code: 'thyroid', label: '甲状腺', confidence: 0.46, bbox: { x: 228, y: 62, width: 74, height: 42 }, mask: { type: 'ellipse', cx: 265, cy: 83, rx: 37, ry: 21 }, volumeMl: 16, slices: 18, status: 'low-confidence', featureNote: '上颈部扫描范围受限' },
    ],
    organsDetected: 2,
    avgConfidence: 0.73,
    primaryOrgan: 'lung',
    modelVersion: 'organseg-v2.6.0',
    createdAt: '2026-07-18T09:30:00.000Z',
  },
  {
    id: 'od-seed-002',
    studyId: 'AS20260721-009',
    modality: 'CT',
    bodyPart: 'ABDOMEN',
    pixelStats: { mean: 58, stddev: 76, min: -900, max: 760, slices: 190, width: 512, height: 512 },
    organs: [
      { code: 'liver', label: '肝', confidence: 0.91, bbox: { x: 148, y: 240, width: 180, height: 132 }, mask: { type: 'ellipse', cx: 238, cy: 306, rx: 90, ry: 66 }, volumeMl: 1520, slices: 104, status: 'detected', featureNote: '实质 HU 均值约 62, 软组织窗拟合优' },
      { code: 'kidney', label: '肾', confidence: 0.84, bbox: { x: 208, y: 330, width: 230, height: 92 }, mask: { type: 'ellipse', cx: 323, cy: 376, rx: 115, ry: 46 }, volumeMl: 168, slices: 62, status: 'detected', featureNote: '双肾轮廓完整, 皮髓质分界可见' },
      { code: 'spleen', label: '脾', confidence: 0.79, bbox: { x: 88, y: 252, width: 104, height: 100 }, mask: { type: 'ellipse', cx: 140, cy: 302, rx: 52, ry: 50 }, volumeMl: 190, slices: 58, status: 'detected', featureNote: '脾脏均匀强化' },
      { code: 'pancreas', label: '胰', confidence: 0.68, bbox: { x: 176, y: 280, width: 140, height: 52 }, mask: { type: 'ellipse', cx: 246, cy: 306, rx: 70, ry: 26 }, volumeMl: 86, slices: 34, status: 'detected', featureNote: '胰体尾显示清楚' },
      { code: 'gallbladder', label: '胆囊', confidence: 0.72, bbox: { x: 200, y: 268, width: 62, height: 64 }, mask: { type: 'ellipse', cx: 231, cy: 300, rx: 31, ry: 32 }, volumeMl: 42, slices: 26, status: 'detected', featureNote: '胆汁低密度区, 壁厚未见增厚' },
    ],
    organsDetected: 5,
    avgConfidence: 0.79,
    primaryOrgan: 'liver',
    modelVersion: 'organseg-v2.6.0',
    createdAt: '2026-07-21T15:20:00.000Z',
  },
]

// ── 确定性灰度特征回退 ───────────────────────────────────────────────────────

function derivePixelStats(input: OrganAnalyzeInput): Required<PixelStatsInput> {
  const seed = `${input.studyId}:${input.modality}:${input.bodyPart ?? ''}`
  const meanRange = expectedMeanRange(input.modality, input.bodyPart)
  const contrastRange = expectedContrastRange(input.modality, input.bodyPart)
  return {
    mean: input.pixelStats?.mean ?? floatInRange(seed, meanRange.min, meanRange.max, 1, 0),
    stddev: input.pixelStats?.stddev ?? floatInRange(seed, contrastRange.min, contrastRange.max, 2, 0),
    min: input.pixelStats?.min ?? -1024,
    max: input.pixelStats?.max ?? 1024,
    slices: input.pixelStats?.slices ?? intInRange(seed, 60, 320, 3),
    width: input.pixelStats?.width ?? 512,
    height: input.pixelStats?.height ?? 512,
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000
}

function organVisible(organ: OrganDef, bodyPart?: string): boolean {
  const bp = (bodyPart ?? '').toUpperCase()
  if (!bp) return organ.defaultDetectable
  if (organ.bodyParts.some((p) => p === bp || bp === 'WHOLE BODY')) return true
  return false
}

function detectOrgan(organ: OrganDef, seedBase: string, stats: Required<PixelStatsInput>): OrganDetectionItem {
  const seed = `${seedBase}:${organ.code}`
  const windowFit = clamp01(1 - Math.abs(stats.mean - organ.expectedHu) / organ.huTolerance)
  const contrastFit = clamp01(stats.stddev / organ.expectedContrast)
  const base = 0.35 + 0.65 * (0.65 * windowFit + 0.35 * contrastFit)
  const jitter = floatInRange(seed, -0.04, 0.04, 7)
  const confidence = round3(clamp01(base + jitter))
  const imgW = stats.width
  const imgH = stats.height
  const w = Math.max(16, Math.round(organ.regionW * imgW * floatInRange(seed, 0.85, 1.1, 11, 2)))
  const h = Math.max(16, Math.round(organ.regionH * imgH * floatInRange(seed, 0.85, 1.1, 12, 2)))
  const cx = intInRange(seed, Math.round(organ.regionX * imgW) - 40, Math.round(organ.regionX * imgW) + 40, 13)
  const cy = intInRange(seed, Math.round(organ.regionY * imgH) - 40, Math.round(organ.regionY * imgH) + 40, 14)
  const x = Math.max(0, cx - Math.floor(w / 2))
  const y = Math.max(0, cy - Math.floor(h / 2))
  const bbox: OrganBBox = {
    x: Math.min(x, imgW - w),
    y: Math.min(y, imgH - h),
    width: Math.min(w, imgW - Math.min(x, imgW - w)),
    height: Math.min(h, imgH - Math.min(y, imgH - h)),
  }
  const volumeMl = floatInRange(seed, organ.volumeMin, organ.volumeMax, 15, 1)
  const slices = intInRange(seed, Math.max(1, Math.round(stats.slices * 0.2)), stats.slices, 16)
  const featureNote = buildFeatureNote(organ, stats, windowFit, contrastFit)
  return {
    code: organ.code,
    label: organ.label,
    confidence,
    bbox,
    mask: { type: 'ellipse', cx: bbox.x + Math.floor(bbox.width / 2), cy: bbox.y + Math.floor(bbox.height / 2), rx: Math.floor(bbox.width / 2), ry: Math.floor(bbox.height / 2) },
    volumeMl,
    slices,
    status: confidence >= 0.5 ? 'detected' : 'low-confidence',
    featureNote,
  }
}

function buildFeatureNote(organ: OrganDef, stats: Required<PixelStatsInput>, windowFit: number, contrastFit: number): string {
  const parts: string[] = []
  if (windowFit >= 0.75) parts.push(`灰度均值 ${stats.mean} 与 ${organ.label} 期望窗高度吻合`)
  else if (windowFit >= 0.4) parts.push(`灰度均值 ${stats.mean} 接近期望窗`)
  else parts.push(`灰度均值 ${stats.mean} 偏离 ${organ.label} 期望窗`)
  if (contrastFit >= 0.7) parts.push('边缘对比度充足')
  else if (contrastFit < 0.4) parts.push('对比度偏低, 边界估计受噪声影响')
  return parts.join('; ')
}

// ── 服务 ─────────────────────────────────────────────────────────────────────

@Injectable()
export class AiV2Service {
  private readonly logger = new Logger(AiV2Service.name)
  private readonly detections = new Map<string, OrganDetectionResult>()
  private readonly paragraphs = new Map<string, ReportParagraphResult>()
  private readonly draftScores = new Map<string, DraftScoreResult>()
  private readonly applications: HangingApplication[] = [...SEED_APPLICATIONS]
  /** doctorId → (modality|bodyPart → layoutId) 历史偏好 */
  private readonly history = new Map<string, string>()

  constructor() {
    for (const d of SEED_DETECTIONS) this.detections.set(d.id, d)
    this.logger.log('AiV2Service initialized (orphan module, in-memory + seed fallback)')
  }

  // ── 1. 多器官自动检出 ──────────────────────────────────────────────────────

  analyzeOrgans(input: OrganAnalyzeInput): OrganDetectionResult {
    const modality = (input.modality ?? 'CT').toUpperCase()
    const bodyPart = (input.bodyPart ?? '').toUpperCase()
    const stats = derivePixelStats(input)
    const seedBase = `${input.studyId}:${modality}:${bodyPart}`
    const organs: OrganDetectionItem[] = ORGAN_CATALOG.filter((o) => organVisible(o, bodyPart))
      .map((o) => detectOrgan(o, seedBase, stats))
      .sort((a, b) => b.confidence - a.confidence)
    const detected = organs.filter((o) => o.status === 'detected')
    const avgConfidence = organs.length
      ? Math.round((organs.reduce((s, o) => s + o.confidence, 0) / organs.length) * 1000) / 1000
      : 0
    const primaryOrgan = detected[0]?.code ?? null
    const id = `od-${hashString(`${seedBase}:${stats.mean}:${stats.stddev}`).toString(16).slice(0, 10)}`
    const result: OrganDetectionResult = {
      id,
      studyId: input.studyId,
      modality,
      bodyPart,
      pixelStats: stats,
      organs,
      organsDetected: detected.length,
      avgConfidence,
      primaryOrgan,
      modelVersion: 'organseg-v2.6.0',
      createdAt: new Date().toISOString(),
    }
    this.detections.set(id, result)
    return result
  }

  listOrganResults(): OrganDetectionResult[] {
    return Array.from(this.detections.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  getOrganResult(id: string): OrganDetectionResult {
    const found = this.detections.get(id)
    if (!found) throw new NotFoundException(`Organ detection ${id} not found`)
    return found
  }

  /** 一键生成报告段落: 由检出结果确定性组合自然语言描述 */
  generateReportParagraph(result: OrganDetectionResult): ReportParagraphResult {
    const id = `rp-${hashString(`${result.id}:paragraph`).toString(16).slice(0, 10)}`
    const detected = result.organs.filter((o) => o.status === 'detected')
    const items = detected.map((o) => `${o.label}(体积约 ${o.volumeMl}mL, 置信度 ${(o.confidence * 100).toFixed(0)}%, 覆盖 ${o.slices} 层)`).join('; ')
    const primary = result.primaryOrgan ? ORGAN_BY_CODE[result.primaryOrgan]?.label ?? result.primaryOrgan : null
    const bodyPartNote = result.bodyPart || result.modality
    const paragraph = `【AI 自动检出】${result.modality} ${bodyPartNote} 扫描共自动检出 ${result.organsDetected} 个器官${primary ? `, 主要器官为 ${primary}` : ''}: ${items}。AI 检出结果仅供医师参考, 请结合原始图像复核确认。`
    const out: ReportParagraphResult = {
      id,
      studyId: result.studyId,
      paragraph,
      organCount: detected.length,
      generatedAt: new Date().toISOString(),
    }
    this.paragraphs.set(id, out)
    return out
  }

  // ── 2. 报告草稿评分 ────────────────────────────────────────────────────────

  scoreDraft(input: DraftScoreInput): DraftScoreResult {
    const modality = input.modality?.toUpperCase() ?? null
    const { dimensions, total, grade, stats, suggestions } = scoreDraftText(input.draftText, modality ?? undefined)
    const id = `ds-${hashString(`${input.draftText}:${modality ?? ''}`).toString(16).slice(0, 10)}`
    const result: DraftScoreResult = {
      id,
      modality,
      score: total,
      grade,
      dimensions,
      suggestions,
      stats,
      scoredAt: new Date().toISOString(),
    }
    this.draftScores.set(id, result)
    return result
  }

  listDraftScores(): DraftScoreResult[] {
    return Array.from(this.draftScores.values()).sort((a, b) => b.scoredAt.localeCompare(a.scoredAt))
  }

  getDraftScore(id: string): DraftScoreResult {
    const found = this.draftScores.get(id)
    if (!found) throw new NotFoundException(`Draft score ${id} not found`)
    return found
  }

  // ── 3. 智能挂片 ────────────────────────────────────────────────────────────

  recommendHanging(input: HangingRecommendInput): HangingRecommendation {
    const modality = (input.modality ?? '').toUpperCase()
    const bodyPart = (input.bodyPart ?? '').toUpperCase()
    const rule = findHangingRule(modality, bodyPart)
    const capacity = rule.rows * rule.cols
    const series = Array.isArray(input.series) ? input.series : []
    const reasons: string[] = []
    const matchedSeries: string[] = []

    let score = rule.priority
    if (rule.id === 'hp-fallback') {
      reasons.push(`无 ${modality}/${bodyPart || '未知部位'} 专属协议, 使用默认单视野布局`)
    } else {
      reasons.push(`规则匹配: ${rule.description}`)
      if (rule.modality === modality && rule.bodyPart === bodyPart) score += 100
      else if (rule.modality === modality) score += 50
      else score += 40
    }

    for (const cell of rule.cells) {
      const hit = series.find((s) => cell.seriesKey && (s.description ?? '').toUpperCase().includes(cell.seriesKey.toUpperCase()))
      if (hit) {
        matchedSeries.push(cell.seriesKey)
        score += 8
      }
    }
    if (matchedSeries.length > 0) {
      reasons.push(`序列匹配 ${matchedSeries.length} 项: ${matchedSeries.join('、')}`)
    } else if (series.length > 0) {
      reasons.push(`未识别到与布局序列匹配的序列描述, 按默认序列顺序挂片`)
    }

    // 医生历史偏好: 同一医生对相同 (模态|部位) 应用过的布局优先 (含与规则一致的情形)
    const historyKey = `${input.doctorId ?? ''}|${rule.modality}|${rule.bodyPart}`
    const preferredLayoutId = input.doctorId ? this.history.get(historyKey) : undefined
    let usedRule = rule
    let source: 'rule' | 'history' = 'rule'
    if (preferredLayoutId) {
      const preferred = HANGING_RULES.find(
        (r) => r.id === preferredLayoutId && r.modality === rule.modality && r.bodyPart === rule.bodyPart,
      )
      if (preferred) {
        usedRule = preferred
        source = 'history'
        score += 30
        reasons.push(
          preferred.id === rule.id
            ? `医生历史偏好: 该医生对 ${modality}/${bodyPart} 常用「${preferred.name}」, 与规则推荐一致`
            : `医生历史偏好: 该医生上次对 ${modality}/${bodyPart} 应用「${preferred.name}」`,
        )
      }
    }

    const capacity2 = usedRule.rows * usedRule.cols
    if (series.length > capacity2) reasons.push(`序列数 ${series.length} 超出 ${capacity2} 格布局, 需翻页查看`)
    else if (series.length > 0) reasons.push(`序列数 ${series.length} 适配 ${capacity2} 格布局`)

    const alternatives = HANGING_RULES.filter((r) => r.id !== usedRule.id && r.id !== 'hp-fallback' && r.modality === usedRule.modality)
      .map((r) => ({ layoutId: r.id, name: r.name, score: r.priority + 40 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)

    return {
      layoutId: usedRule.id,
      name: usedRule.name,
      rows: usedRule.rows,
      cols: usedRule.cols,
      cells: usedRule.cells.map((c, index) => ({
        index,
        label: c.label,
        seriesKey: c.seriesKey,
        windowWidth: c.windowWidth,
        windowCenter: c.windowCenter,
      })),
      score,
      source,
      reasons,
      matchedSeries,
      alternatives,
      recommendedAt: new Date().toISOString(),
    }
  }

  applyHanging(input: HangingApplyInput): HangingApplication {
    const rule = HANGING_RULES.find((r) => r.id === input.layoutId)
    if (!rule) throw new NotFoundException(`Hanging layout ${input.layoutId} not found`)
    const record: HangingApplication = {
      id: `app-${hashString(`${input.examId}:${input.layoutId}:${input.appliedBy}`).toString(16).slice(0, 10)}`,
      examId: input.examId,
      layoutId: rule.id,
      layoutName: rule.name,
      rows: rule.rows,
      cols: rule.cols,
      appliedBy: input.appliedBy,
      appliedAt: new Date().toISOString(),
    }
    this.applications.unshift(record)
    this.history.set(`${input.appliedBy}|${rule.modality}|${rule.bodyPart}`, rule.id)
    return record
  }

  listHangingApplications(): HangingApplication[] {
    return [...this.applications]
  }

  listHangingRules(): HangingRuleDef[] {
    return HANGING_RULES.map((r) => ({ ...r, cells: r.cells.map((c) => ({ ...c })) }))
  }

  // ── 总览 ───────────────────────────────────────────────────────────────────

  overview() {
    const detections = this.listOrganResults()
    const draftCount = this.draftScores.size
    const avgScore = draftCount
      ? Math.round((Array.from(this.draftScores.values()).reduce((s, d) => s + d.score, 0) / draftCount) * 10) / 10
      : 0
    return {
      organDetection: {
        total: detections.length,
        lastRun: detections[0]?.createdAt ?? null,
        organsDetected: detections.reduce((s, d) => s + d.organsDetected, 0),
      },
      draftScoring: { total: draftCount, avgScore },
      smartHanging: { applications: this.applications.length, layouts: HANGING_RULES.length },
      modelVersion: 'ai-v2-w3c.1',
      generatedAt: new Date().toISOString(),
    }
  }
}
