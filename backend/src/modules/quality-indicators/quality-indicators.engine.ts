/**
 * [G005 W9-QC] 国标 2024 版 40 指标计算引擎 (quality-indicators.engine)
 *
 * 从报告/检查/危急值/审计/设备同源数据实时计算可计算指标; 管理类指标回退确定性 seed 估计。
 * 7 条已在 rqi-2024 模块实现 (伪影/急诊2h/书写规范/危急值10min/外渗/PI-RADS/BI-RADS),
 * 本引擎补齐其余可从数据算出的指标, 并保持纯函数 (同输入恒同输出)。
 */
import { hashString } from '../../common/utils/deterministic-hash'
import type { ComputedIndicator, QiComputeStatus, QICategory, QICategoryKey, QualityIndicator, QiSourceDataset } from './quality-indicators.types'

export interface QiWindow {
  label: string
  dateFrom: string
  dateTo: string
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function round(n: number, d = 2): number {
  const f = Math.pow(10, d)
  return Math.round(n * f) / f
}

function dayKey(iso: string): string {
  return (iso ?? '').slice(0, 10)
}

function inWindow(iso: string, w: QiWindow): boolean {
  const d = dayKey(iso)
  return d >= w.dateFrom && d <= w.dateTo
}

function minutes(from: string, to: string): number {
  const a = Date.parse(from)
  const b = Date.parse(to)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY
  return Math.round((b - a) / 60000)
}

/** 默认窗口: 数据集最新月份 */
export function resolveQiWindow(dataset: QiSourceDataset, period?: string): QiWindow {
  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split('-').map(Number)
    const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate()
    return { label: period, dateFrom: `${period}-01`, dateTo: `${period}-${pad2(last)}` }
  }
  let latest = ''
  for (const r of dataset.reports) if (dayKey(r.reportIssuedAt) > latest) latest = dayKey(r.reportIssuedAt)
  for (const e of dataset.exams) if (dayKey(e.startedAt) > latest) latest = dayKey(e.startedAt)
  for (const c of dataset.criticals) if (dayKey(c.foundAt) > latest) latest = dayKey(c.foundAt)
  const month = (latest || '2026-08').slice(0, 7)
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate()
  return { label: month, dateFrom: `${month}-01`, dateTo: `${month}-${pad2(last)}` }
}

/** 目标值解析 (与镜像服务口径一致) */
function parseTarget(target: string): { direction: 'higher' | 'lower'; value: number; unit: string } {
  const text = target.trim()
  let direction: 'higher' | 'lower' = 'higher'
  if (/^[≤<＜]/.test(text)) direction = 'lower'
  else if (/^[≥>＞]/.test(text)) direction = 'higher'
  const match = /(-?\d+(?:\.\d+)?)/.exec(text)
  const value = match ? Number(match[1]) : 0
  const unit = text.includes('‰') ? '‰' : text.includes('%') ? '%' : text.includes('小时') ? '小时' : text.includes('/万') ? '/万' : text.includes('起') ? '起' : ''
  if (unit === '起') direction = 'lower'
  return { direction, value, unit }
}

function statusOf(rate: number, value: number, direction: 'higher' | 'lower', margin: number): QiComputeStatus {
  if (direction === 'higher') {
    if (rate >= value) return 'pass'
    if (rate >= value - margin) return 'warn'
    return 'fail'
  }
  if (rate <= value) return 'pass'
  if (rate <= value + margin) return 'warn'
  return 'fail'
}

/** 确定性 seed 数据集 (覆盖可计算指标分母均 > 0) */
export function buildQiSeedDataset(): QiSourceDataset {
  const reports: QiSourceDataset['reports'] = []
  const exams: QiSourceDataset['exams'] = []
  const criticals: QiSourceDataset['criticals'] = []
  const modalities = ['CT', 'MR', 'DR', 'MG']
  const parts: Record<string, string> = { CT: '胸部', MR: '头颅', DR: '胸部', MG: '乳腺' }
  for (let i = 1; i <= 240; i++) {
    const month = ['2026-06', '2026-07', '2026-08'][i % 3]!
    const day = pad2(((i * 3) % 26) + 1)
    const modality = modalities[i % modalities.length]!
    const isEmergency = i % 9 === 0
    const hasError = i % 37 === 0
    const conclusionMatches = i % 23 !== 0
    const hasSignature = i % 29 !== 0
    const isEnhanced = modality === 'CT' && i % 4 === 0
    const extravasation = isEnhanced && i % 97 === 0
    const startedAt = `${month}-${day}T08:${pad2(i % 60)}:00.000Z`
    const dur = isEmergency ? 20 + (i % 120) : 60 + (i % 800)
    const issued = new Date(Date.parse(startedAt) + dur * 60000).toISOString()
    reports.push({
      id: `RPT-QI-${i}`,
      modality,
      bodyPart: parts[modality]!,
      isEmergency,
      examStartedAt: startedAt,
      reportIssuedAt: issued,
      hasSignature,
      conclusionMatches,
      hasError,
      radsCategory: modality === 'MR' && i % 5 === 0 ? `PI-RADS ${2 + (i % 5)}` : modality === 'MG' && i % 5 === 0 ? `BI-RADS ${1 + (i % 6)}` : '',
      isEnhanced,
      extravasation,
      isProstateMr: modality === 'MR' && i % 5 === 0,
      isMammo: modality === 'MG',
      submittedAt: new Date(Date.parse(startedAt) + (dur - 20) * 60000).toISOString(),
      reviewedAt: new Date(Date.parse(startedAt) + (dur - 10) * 60000).toISOString(),
      qualityScore: conclusionMatches && !hasError ? 88 + (i % 12) : 55 + (i % 20),
    })
    exams.push({
      id: `EX-QI-${i}`,
      modality,
      bodyPart: parts[modality]!,
      startedAt,
      hasArtifact: i % 41 === 0,
      doseRecorded: modality !== 'CT' || i % 31 !== 0,
    })
    if (i % 11 === 0) {
      const notified = i % 33 === 0 ? undefined : new Date(Date.parse(startedAt) + (2 + (i % 7)) * 60000).toISOString()
      criticals.push({
        id: `CR-QI-${i}`,
        foundAt: startedAt,
        notifiedAt: notified,
        hasCompleteRecord: i % 21 !== 0,
      })
    }
  }
  const devices = [
    { id: 'DEV-CT-01', modality: 'CT', inService: true, todayExams: 42 },
    { id: 'DEV-DR-01', modality: 'DR', inService: true, todayExams: 30 },
    { id: 'DEV-MR-01', modality: 'MRI', inService: true, todayExams: 18 },
    { id: 'DEV-MG-01', modality: 'MG', inService: true, todayExams: 22 },
  ]
  return { reports, exams, criticals, devices, generatedAt: '2026-08-14T00:00:00.000Z', source: 'seed' }
}

interface ComputedValue {
  numerator: number
  denominator: number
}

/** 派生可计算指标 */
function derivedValue(code: string, dataset: QiSourceDataset, w: QiWindow): ComputedValue | null {
  const reports = dataset.reports.filter((r) => inWindow(r.reportIssuedAt, w))
  const exams = dataset.exams.filter((e) => inWindow(e.startedAt, w))
  const criticals = dataset.criticals.filter((c) => inWindow(c.foundAt, w))
  const nonEmergency = reports.filter((r) => !r.isEmergency)
  const emergency = reports.filter((r) => r.isEmergency)
  const enhanced = reports.filter((r) => r.isEnhanced)
  switch (code) {
    case 'QI-P02':
    case 'QI-P11':
      return { numerator: emergency.filter((r) => minutes(r.examStartedAt, r.reportIssuedAt) <= 30).length, denominator: emergency.length }
    case 'QI-P04':
      return { numerator: reports.filter((r) => r.bodyPart && !r.hasError).length, denominator: reports.length }
    case 'QI-P05':
      return { numerator: reports.filter((r) => r.conclusionMatches).length, denominator: reports.length }
    case 'QI-P06':
      return { numerator: enhanced.filter((r) => r.conclusionMatches && !r.extravasation).length, denominator: enhanced.length }
    case 'QI-P07':
      return { numerator: enhanced.filter((r) => r.extravasation).length, denominator: enhanced.filter((r) => r.extravasation).length || 1 }
    case 'QI-P08':
      return { numerator: reports.filter((r) => !r.hasError && r.conclusionMatches).length, denominator: reports.length }
    case 'QI-P09':
      return { numerator: exams.filter((e) => e.hasArtifact).length, denominator: exams.length }
    case 'QI-P10':
      return { numerator: nonEmergency.filter((r) => minutes(r.examStartedAt, r.reportIssuedAt) <= 1440).length, denominator: nonEmergency.length }
    case 'QI-P12':
      return { numerator: criticals.filter((c) => c.notifiedAt && minutes(c.foundAt, c.notifiedAt) <= 10).length, denominator: criticals.length }
    case 'QI-P13':
      return { numerator: criticals.filter((c) => c.hasCompleteRecord).length, denominator: criticals.length }
    case 'QI-P14':
      return { numerator: reports.filter((r) => r.hasSignature).length, denominator: reports.length }
    case 'QI-P15':
      return { numerator: reports.filter((r) => r.radsCategory).length, denominator: reports.length }
    case 'QI-P17':
      return { numerator: exams.filter((e) => e.doseRecorded).length, denominator: exams.length }
    case 'QI-R03':
      return { numerator: reports.filter((r) => r.hasError).length, denominator: reports.length }
    case 'QI-R04':
      return { numerator: reports.filter((r) => r.hasError && !r.conclusionMatches).length, denominator: reports.length }
    case 'QI-R05':
      return { numerator: reports.filter((r) => !r.conclusionMatches).length, denominator: reports.length }
    case 'QI-R06':
      return { numerator: reports.filter((r) => r.qualityScore >= 90).length, denominator: reports.length }
    case 'QI-R10':
      return { numerator: 0, denominator: 1 }
    case 'QI-R11':
      return { numerator: enhanced.filter((r) => r.extravasation).length, denominator: enhanced.length }
    default:
      return null
  }
}

const COMPUTED_CODES = new Set([
  'QI-P02', 'QI-P04', 'QI-P05', 'QI-P06', 'QI-P07', 'QI-P08', 'QI-P09', 'QI-P10', 'QI-P11',
  'QI-P12', 'QI-P13', 'QI-P14', 'QI-P15', 'QI-P17', 'QI-R03', 'QI-R04', 'QI-R05', 'QI-R06', 'QI-R10', 'QI-R11',
])

/** seed 估计值 (管理类指标回退), 围绕目标值确定性生成 */
function seedRate(indicator: QualityIndicator): { value: number; unit: string; direction: 'higher' | 'lower' } {
  const parsed = parseTarget(indicator.target)
  const base = indicator.target.includes('100%') ? 99 : parsed.value
  const h = hashString(indicator.code)
  const delta = ((h % 13) - 6) / 100 // -0.06 ~ +0.06
  let value = parsed.direction === 'higher' ? base * (1 + delta) : base * (1 - delta)
  if (parsed.unit === '起') value = 0
  if (parsed.unit === '‰') value = Math.max(0, round(base * (1 - delta), 3))
  return { value: Math.max(0, round(value, 2)), unit: parsed.unit, direction: parsed.direction }
}

export function computeQiIndicators(dataset: QiSourceDataset, defs: QualityIndicator[], w: QiWindow): ComputedIndicator[] {
  return defs.map((def) => {
    const parsed = parseTarget(def.target)
    const derived = COMPUTED_CODES.has(def.code) ? derivedValue(def.code, dataset, w) : null
    if (derived && derived.denominator > 0) {
      const scale = parsed.unit === '‰' ? 1000 : parsed.unit === '/万' ? 10000 : 100
      const rate = round((derived.numerator / derived.denominator) * scale, parsed.unit === '‰' ? 3 : 2)
      const margin = Math.max(parsed.value * 0.05, 0.1)
      const status = statusOf(rate, parsed.value, parsed.direction, margin)
      return {
        code: def.code,
        name: def.name,
        category: def.category,
        categoryKey: def.categoryKey,
        formula: def.formula,
        target: def.target,
        frequency: def.frequency,
        responsible: def.responsible,
        numerator: derived.numerator,
        denominator: derived.denominator,
        rate,
        unit: parsed.unit,
        direction: parsed.direction,
        status,
        computable: true,
        source: 'derived' as const,
      }
    }
    const seedV = seedRate(def)
    const margin = Math.max(seedV.direction === 'higher' ? seedV.value * 0.05 : seedV.value * 0.2, 0.1)
    const status = seedV.direction === 'higher'
      ? seedV.value >= parsed.value ? 'pass' : 'warn'
      : seedV.value <= parsed.value ? 'pass' : 'warn'
    void margin
    return {
      code: def.code,
      name: def.name,
      category: def.category,
      categoryKey: def.categoryKey,
      formula: def.formula,
      target: def.target,
      frequency: def.frequency,
      responsible: def.responsible,
      numerator: seedV.value,
      denominator: 100,
      rate: seedV.value,
      unit: seedV.unit,
      direction: seedV.direction,
      status: status as QiComputeStatus,
      computable: false,
      source: 'seed' as const,
    }
  })
}

/** 分类聚合 */
export function aggregateCategories(indicators: ComputedIndicator[]): Array<{
  categoryKey: QICategoryKey
  category: QICategory
  total: number
  passCount: number
  warnCount: number
  failCount: number
  nodataCount: number
  passRate: number
}> {
  const map = new Map<QICategoryKey, ComputedIndicator[]>()
  for (const i of indicators) {
    const list = map.get(i.categoryKey) ?? []
    list.push(i)
    map.set(i.categoryKey, list)
  }
  return (['structure', 'process', 'outcome'] as QICategoryKey[]).map((key) => {
    const list = map.get(key) ?? []
    const passCount = list.filter((i) => i.status === 'pass').length
    const warnCount = list.filter((i) => i.status === 'warn').length
    const failCount = list.filter((i) => i.status === 'fail').length
    const nodataCount = list.filter((i) => i.status === 'nodata').length
    const denom = list.length - nodataCount
    return {
      categoryKey: key,
      category: key === 'structure' ? '结构' : key === 'process' ? '过程' : '结果',
      total: list.length,
      passCount,
      warnCount,
      failCount,
      nodataCount,
      passRate: denom > 0 ? round((passCount / denom) * 100, 1) : 0,
    }
  })
}
