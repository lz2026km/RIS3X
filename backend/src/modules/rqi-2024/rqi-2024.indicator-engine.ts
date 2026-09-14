/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 1A - 放射影像质控指标 (2024 年版) 纯函数计算引擎
 *
 * 7 条国标指标的确定性计算 (无副作用 / 无 IO / 同输入恒同输出):
 *   - 输入: 同源派生数据集 RqiSourceDataset + 目标值配置 + 统计窗口
 *   - 输出: 分子 / 分母 / 比率 / 单位 / 目标 / 达标判定 (pass|warn|fail)
 *   - IIA-01 支持 CT / MRI 分列; 支持按周期 (月/季/年) 聚合
 */
import {
  BI_RADS_PATTERN,
  CRITICAL_NOTIFY_MINUTES,
  CT_MODALITIES,
  EMERGENCY_MODALITIES,
  EMERGENCY_REPORT_MINUTES,
  INDICATOR_CODES,
  INDICATOR_META,
  INDICATOR_META_MAP,
  MAMMO_MODALITIES,
  MR_MODALITIES,
  PI_RADS_PATTERN,
  classifyCriticalDiagnosis,
  isCriticalDiagnosis,
  type IndicatorCode,
  type IndicatorConfig,
  type IndicatorDetailItem,
  type IndicatorDetailResult,
  type IndicatorDimensionResult,
  type IndicatorResult,
  type IndicatorStatus,
  type IndicatorTrendPoint,
  type IndicatorWindow,
  type RqiCriticalEvent,
  type RqiExam,
  type RqiGranularity,
  type RqiReport,
  type RqiSourceDataset,
} from './rqi-2024.types'

// ================= 基础工具 (确定性) =================

export function round(n: number, digits = 2): number {
  const f = Math.pow(10, digits)
  return Math.round(n * f) / f
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function dateKey(iso: string): string {
  return (iso ?? '').slice(0, 10)
}

export function monthOf(iso: string): string {
  return (iso ?? '').slice(0, 7)
}

export function inWindow(iso: string, w: IndicatorWindow): boolean {
  const d = dateKey(iso)
  if (!d) return false
  return d >= w.dateFrom && d <= w.dateTo
}

export function diffMinutes(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime()
  const to = new Date(toIso).getTime()
  if (!Number.isFinite(from) || !Number.isFinite(to)) return Number.POSITIVE_INFINITY
  return Math.round((to - from) / 60000)
}

// ================= 统计窗口构造 / 平移 =================

export function monthWindow(month: string): IndicatorWindow {
  const [y, m] = month.split('-').map((v) => Number(v))
  const last = new Date(Date.UTC(y ?? 1970, m ?? 1, 0)).getUTCDate()
  return {
    granularity: 'month',
    label: month,
    dateFrom: `${month}-01`,
    dateTo: `${month}-${pad2(last)}`,
  }
}

export function quarterWindow(quarter: string): IndicatorWindow {
  const [yStr, qStr] = quarter.split('-Q')
  const y = Number(yStr ?? 1970)
  const q = Number(qStr ?? 1)
  const startMonth = (q - 1) * 3 + 1
  const endMonth = startMonth + 2
  const last = new Date(Date.UTC(y, endMonth, 0)).getUTCDate()
  return {
    granularity: 'quarter',
    label: quarter,
    dateFrom: `${y}-${pad2(startMonth)}-01`,
    dateTo: `${y}-${pad2(endMonth)}-${pad2(last)}`,
  }
}

export function yearWindow(year: string): IndicatorWindow {
  return { granularity: 'year', label: year, dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` }
}

export function shiftWindow(w: IndicatorWindow, delta: number): IndicatorWindow {
  if (w.label.includes('~')) {
    const from = new Date(`${w.dateFrom}T00:00:00Z`).getTime()
    const to = new Date(`${w.dateTo}T00:00:00Z`).getTime()
    const days = Math.round((to - from) / 86400000) + 1
    const newTo = from - 86400000
    const newFrom = newTo - (days - 1) * 86400000
    const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10)
    return { granularity: w.granularity, label: `${fmt(newFrom)}~${fmt(newTo)}`, dateFrom: fmt(newFrom), dateTo: fmt(newTo) }
  }
  if (w.granularity === 'month') {
    const [y, m] = w.label.split('-').map((v) => Number(v))
    const d = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1 + delta, 1))
    return monthWindow(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`)
  }
  if (w.granularity === 'quarter') {
    const [yStr, qStr] = w.label.split('-Q')
    let y = Number(yStr ?? 1970)
    let q = Number(qStr ?? 1) + delta
    while (q > 4) {
      q -= 4
      y += 1
    }
    while (q < 1) {
      q += 4
      y -= 1
    }
    return quarterWindow(`${y}-Q${q}`)
  }
  return yearWindow(String(Number(w.label || 1970) + delta))
}

/** 由数据集推断最新记录日期 (确定性) */
export function latestDatasetDate(dataset: RqiSourceDataset): string {
  let latest = ''
  for (const e of dataset.exams) if (dateKey(e.startedAt) > latest) latest = dateKey(e.startedAt)
  for (const r of dataset.reports) if (dateKey(r.reportIssuedAt) > latest) latest = dateKey(r.reportIssuedAt)
  for (const c of dataset.criticalEvents) if (dateKey(c.foundAt) > latest) latest = dateKey(c.foundAt)
  return latest || '1970-01-01'
}

// ================= 达标判定 =================

/**
 * 达标判定:
 *   higher (越高越好): rate ≥ target → pass; rate ≥ target - margin → warn; 否则 fail
 *   lower  (越低越好): rate ≤ target → pass; rate ≤ target + margin → warn; 否则 fail
 */
export function evaluateStatus(rate: number, target: number, direction: 'higher' | 'lower', warnMargin: number): IndicatorStatus {
  const margin = Math.max(0, warnMargin)
  if (direction === 'higher') {
    if (rate >= target) return 'pass'
    if (rate >= target - margin) return 'warn'
    return 'fail'
  }
  if (rate <= target) return 'pass'
  if (rate <= target + margin) return 'warn'
  return 'fail'
}

// ================= 同源数据适配 =================

function upper(modality: string): string {
  return (modality ?? '').toUpperCase()
}

function isCt(modality: string): boolean {
  return CT_MODALITIES.includes(upper(modality))
}

function isMr(modality: string): boolean {
  return MR_MODALITIES.includes(upper(modality))
}

function isEmergencyModality(modality: string): boolean {
  const m = upper(modality)
  return EMERGENCY_MODALITIES.some((x) => upsafe(x) === m)
}

function isMammoModality(modality: string): boolean {
  const m = upper(modality)
  return MAMMO_MODALITIES.some((x) => upsafe(x) === m)
}

function upsafe(x: string): string {
  return (x ?? '').toUpperCase()
}

function isProstateMrReport(r: RqiReport): boolean {
  return Boolean(r.isProstateMr) || (r.bodyPart ?? '').includes('前列腺') || PI_RADS_PATTERN.test(r.radsCategory ?? '')
}

function isMammoReport(r: RqiReport): boolean {
  return Boolean(r.isMammoTarget) || isMammoModality(r.modality)
}

// ================= 逐指标明细评估 =================

/** IIA-01: 影像检查图像伪影率 (CT / MRI 分别统计, 每份检查报告 = 1 个例次) */
function artifactItems(exams: RqiExam[], w: IndicatorWindow): IndicatorDetailItem[] {
  const items: IndicatorDetailItem[] = []
  for (const e of exams) {
    if (!inWindow(e.startedAt, w)) continue
    const ct = isCt(e.modality)
    const mr = isMr(e.modality)
    if (!ct && !mr) continue
    const dimension = ct ? 'CT' : 'MRI'
    items.push({
      id: e.examId,
      kind: 'exam',
      label: `${e.accessionNumber || e.examId} ${e.bodyPart || ''}`.trim(),
      inNumerator: Boolean(e.hasArtifact),
      inDenominator: true,
      dimension,
      detail: {
        accessionNumber: e.accessionNumber,
        modality: e.modality,
        bodyPart: e.bodyPart,
        startedAt: e.startedAt,
        hasArtifact: Boolean(e.hasArtifact),
        artifactNote: e.artifactNote,
        dimension,
      },
    })
  }
  return items
}

/** RRC-02: 急诊 X线/CT 报告 2 小时完成率 (检查开始 → 报告出具 ≤ 120 分钟) */
function emergencyItems(reports: RqiReport[], w: IndicatorWindow): IndicatorDetailItem[] {
  const items: IndicatorDetailItem[] = []
  for (const r of reports) {
    if (!inWindow(r.reportIssuedAt, w)) continue
    if (!r.isEmergency || !isEmergencyModality(r.modality)) continue
    const minutes = diffMinutes(r.examStartedAt, r.reportIssuedAt)
    items.push({
      id: r.reportId,
      kind: 'report',
      label: `${r.reportId} ${r.modality}`,
      inNumerator: minutes <= EMERGENCY_REPORT_MINUTES,
      inDenominator: true,
      detail: {
        modality: r.modality,
        isEmergency: true,
        examStartedAt: r.examStartedAt,
        reportIssuedAt: r.reportIssuedAt,
        minutes,
      },
    })
  }
  return items
}

/** RWS-03: 报告书写规范率 (签名 + 结论与描述相符 + 无明显错误) */
function reportingItems(reports: RqiReport[], w: IndicatorWindow): IndicatorDetailItem[] {
  const items: IndicatorDetailItem[] = []
  for (const r of reports) {
    if (!inWindow(r.reportIssuedAt, w)) continue
    const signed = Boolean(r.hasRadiologistSignature)
    const matches = Boolean(r.conclusionMatchesFindings)
    const error = Boolean(r.hasObviousError)
    items.push({
      id: r.reportId,
      kind: 'report',
      label: `${r.reportId} ${r.modality}`,
      inNumerator: signed && matches && !error,
      inDenominator: true,
      detail: {
        modality: r.modality,
        hasRadiologistSignature: signed,
        conclusionMatchesFindings: matches,
        hasObviousError: error,
        errorNote: r.errorNote,
        reportIssuedAt: r.reportIssuedAt,
      },
    })
  }
  return items
}

/** RCV-04: 危急值 10 分钟内通报完成率 (仅国标 13 类诊断; 双方时间/内容/署名记录齐全) */
function criticalItems(events: RqiCriticalEvent[], w: IndicatorWindow): IndicatorDetailItem[] {
  const items: IndicatorDetailItem[] = []
  for (const c of events) {
    if (!inWindow(c.foundAt, w)) continue
    if (!isCriticalDiagnosis(c.diagnosis)) continue
    const minutes = c.notifiedAt ? diffMinutes(c.foundAt, c.notifiedAt) : Number.POSITIVE_INFINITY
    const complete = c.hasTimeRecord && c.hasContentRecord && c.hasSignerRecord
    items.push({
      id: c.id,
      kind: 'critical',
      label: `${c.patientName || c.patientId} ${c.diagnosis}`,
      inNumerator: Boolean(c.notifiedAt) && minutes <= CRITICAL_NOTIFY_MINUTES && complete,
      inDenominator: true,
      detail: {
        criticalId: c.criticalId,
        diagnosis: c.diagnosis,
        category: classifyCriticalDiagnosis(c.diagnosis) ?? '未分类',
        foundAt: c.foundAt,
        notifiedAt: c.notifiedAt,
        minutes,
        hasTimeRecord: c.hasTimeRecord,
        hasContentRecord: c.hasContentRecord,
        hasSignerRecord: c.hasSignerRecord,
      },
    })
  }
  return items
}

/** ICME-05: 增强 CT 静脉对比剂外渗发生率 (‰) */
function contrastItems(exams: RqiExam[], w: IndicatorWindow): IndicatorDetailItem[] {
  const items: IndicatorDetailItem[] = []
  for (const e of exams) {
    if (!inWindow(e.startedAt, w)) continue
    if (!isCt(e.modality) || !e.isEnhancedCt) continue
    items.push({
      id: e.examId,
      kind: 'contrast',
      label: `${e.accessionNumber || e.examId} 增强CT`,
      inNumerator: Boolean(e.contrastExtravasation),
      inDenominator: true,
      detail: {
        accessionNumber: e.accessionNumber,
        modality: e.modality,
        bodyPart: e.bodyPart,
        startedAt: e.startedAt,
        contrastExtravasation: Boolean(e.contrastExtravasation),
      },
    })
  }
  return items
}

/** RCR-06: PI-RADS 分类率 (前列腺病变 MR 报告) */
function piRadsItems(reports: RqiReport[], w: IndicatorWindow): IndicatorDetailItem[] {
  const items: IndicatorDetailItem[] = []
  for (const r of reports) {
    if (!inWindow(r.reportIssuedAt, w)) continue
    if (!isMr(r.modality) || !isProstateMrReport(r)) continue
    items.push({
      id: r.reportId,
      kind: 'report',
      label: `${r.reportId} 前列腺 MR`,
      inNumerator: PI_RADS_PATTERN.test(r.radsCategory ?? ''),
      inDenominator: true,
      detail: {
        modality: r.modality,
        bodyPart: r.bodyPart,
        radsCategory: r.radsCategory ?? '',
        reportIssuedAt: r.reportIssuedAt,
      },
    })
  }
  return items
}

/** RCR-07: BI-RADS 分类率 (乳腺钼靶报告) */
function biRadsItems(reports: RqiReport[], w: IndicatorWindow): IndicatorDetailItem[] {
  const items: IndicatorDetailItem[] = []
  for (const r of reports) {
    if (!inWindow(r.reportIssuedAt, w)) continue
    if (!isMammoReport(r)) continue
    items.push({
      id: r.reportId,
      kind: 'report',
      label: `${r.reportId} 乳腺钼靶`,
      inNumerator: BI_RADS_PATTERN.test(r.radsCategory ?? ''),
      inDenominator: true,
      detail: {
        modality: r.modality,
        bodyPart: r.bodyPart,
        radsCategory: r.radsCategory ?? '',
        reportIssuedAt: r.reportIssuedAt,
      },
    })
  }
  return items
}

export function evaluateIndicatorItems(code: IndicatorCode, dataset: RqiSourceDataset, w: IndicatorWindow): IndicatorDetailItem[] {
  switch (code) {
    case 'RQI-IIA-01':
      return artifactItems(dataset.exams, w)
    case 'RQI-RRC-02':
      return emergencyItems(dataset.reports, w)
    case 'RQI-RWS-03':
      return reportingItems(dataset.reports, w)
    case 'RQI-RCV-04':
      return criticalItems(dataset.criticalEvents, w)
    case 'RQI-ICME-05':
      return contrastItems(dataset.exams, w)
    case 'RQI-RCR-06':
      return piRadsItems(dataset.reports, w)
    case 'RQI-RCR-07':
      return biRadsItems(dataset.reports, w)
    default:
      return []
  }
}

// ================= 指标结果构建 =================

export function findConfig(configs: IndicatorConfig[], code: IndicatorCode): IndicatorConfig {
  const hit = configs.find((c) => c.code === code)
  if (hit) return hit
  const meta = INDICATOR_META_MAP[code]
  return {
    code,
    name: meta.name,
    target: meta.defaultTarget,
    warnMargin: meta.defaultWarnMargin,
    direction: meta.direction,
    unit: meta.unit,
  }
}

function scaleOf(unit: '‰' | '%'): number {
  return unit === '‰' ? 1000 : 100
}

function dimensionBreakdown(items: IndicatorDetailItem[], config: IndicatorConfig): IndicatorDimensionResult[] {
  const dimensions = ['CT', 'MRI']
  return dimensions.map((dimension) => {
    const sub = items.filter((i) => i.dimension === dimension)
    const denominator = sub.length
    const numerator = sub.filter((i) => i.inNumerator).length
    const rate = denominator > 0 ? round((numerator / denominator) * scaleOf(config.unit), 2) : 0
    return {
      dimension,
      label: dimension,
      numerator,
      denominator,
      rate,
      status: evaluateStatus(rate, config.target, config.direction, config.warnMargin),
    }
  })
}

export function buildIndicatorResult(code: IndicatorCode, items: IndicatorDetailItem[], config: IndicatorConfig, w: IndicatorWindow): IndicatorResult {
  const meta = INDICATOR_META_MAP[code]
  const denominator = items.length
  const numerator = items.filter((i) => i.inNumerator).length
  const rate = denominator > 0 ? round((numerator / denominator) * scaleOf(config.unit), 2) : 0
  const status = evaluateStatus(rate, config.target, config.direction, config.warnMargin)
  const result: IndicatorResult = {
    code,
    name: meta.name,
    numerator,
    denominator,
    rate,
    unit: config.unit,
    target: config.target,
    direction: config.direction,
    status,
    period: w.label,
    granularity: w.granularity,
    standard: meta.standard,
  }
  if (code === 'RQI-IIA-01') result.byDimension = dimensionBreakdown(items, config)
  return result
}

export function computeIndicator(code: IndicatorCode, dataset: RqiSourceDataset, configs: IndicatorConfig[], w: IndicatorWindow): IndicatorResult {
  const config = findConfig(configs, code)
  return buildIndicatorResult(code, evaluateIndicatorItems(code, dataset, w), config, w)
}

export function computeIndicators(dataset: RqiSourceDataset, configs: IndicatorConfig[], w: IndicatorWindow): IndicatorResult[] {
  return INDICATOR_CODES.map((code) => computeIndicator(code, dataset, configs, w))
}

// ================= 下钻明细 =================

export function buildIndicatorDetail(code: IndicatorCode, dataset: RqiSourceDataset, configs: IndicatorConfig[], w: IndicatorWindow): IndicatorDetailResult {
  const config = findConfig(configs, code)
  const items = evaluateIndicatorItems(code, dataset, w)
  const indicator = buildIndicatorResult(code, items, config, w)
  return {
    indicator,
    numeratorIds: items.filter((i) => i.inNumerator).map((i) => i.id),
    denominatorIds: items.map((i) => i.id),
    items: items.map((i) => ({ ...i, inDenominator: true })),
  }
}

// ================= 月度趋势 =================

export function listDatasetMonths(dataset: RqiSourceDataset): string[] {
  const set = new Set<string>()
  for (const e of dataset.exams) if (e.startedAt) set.add(monthOf(e.startedAt))
  for (const r of dataset.reports) if (r.reportIssuedAt) set.add(monthOf(r.reportIssuedAt))
  for (const c of dataset.criticalEvents) if (c.foundAt) set.add(monthOf(c.foundAt))
  return [...set].filter(Boolean).sort()
}

export function buildIndicatorTrend(code: IndicatorCode, dataset: RqiSourceDataset, configs: IndicatorConfig[], months = 12): IndicatorTrendPoint[] {
  const config = findConfig(configs, code)
  const all = listDatasetMonths(dataset)
  const target = all.slice(-Math.max(1, months))
  const points: IndicatorTrendPoint[] = []
  for (const month of target) {
    const w = monthWindow(month)
    const items = evaluateIndicatorItems(code, dataset, w)
    if (items.length === 0) continue
    const result = buildIndicatorResult(code, items, config, w)
    points.push({
      month,
      numerator: result.numerator,
      denominator: result.denominator,
      rate: result.rate,
      unit: result.unit,
      target: result.target,
      status: result.status,
    })
  }
  return points
}

// ================= 元数据便捷导出 =================

export function indicatorMetas() {
  return INDICATOR_META.map((m) => ({ ...m }))
}

export function resolveWindow(granularity: RqiGranularity, anchorDate: string): IndicatorWindow {
  const date = dateKey(anchorDate) || '1970-01-01'
  if (granularity === 'year') return yearWindow(date.slice(0, 4))
  if (granularity === 'quarter') {
    const month = Number(date.slice(5, 7))
    const q = Math.min(4, Math.max(1, Math.floor((month - 1) / 3) + 1))
    return quarterWindow(`${date.slice(0, 4)}-Q${q}`)
  }
  return monthWindow(date.slice(0, 7))
}
