/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 2B - 放射影像质控国标指标 (2024 版) (/qc/rqi-2024)
 *
 * 依据: 国卫办医政函〔2024〕150 号 附件4 《放射影像专业医疗质量控制指标 (2024 年版)》
 *   - 7 条国标指标卡片 (比率/单位/分子/分母/目标/达标状态/环比)
 *   - 达标总览 (达标数/总数 + 达标率 + 环形进度)
 *   - 明细下钻 (分子/分母清单, 字段按指标类型自适应)
 *   - 月度趋势 (选中指标折线 + 目标参考线)
 *   - 目标值配置抽屉 (PUT /rqi-2024/config)
 *   - 40 条扩展质控指标 (结构/过程/结果 分组 + 搜索)
 * 数据源: rqi2024Api (后端 /rqi-2024 + /quality-indicators 或 MSW/seed 回退, 响应带 source 徽标)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import dayjs from 'dayjs'
import {
  Activity,
  RefreshCw,
  Database,
  HardDrive,
  Download,
  Settings2,
  Search,
  TrendingUp,
  Target,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ListChecks,
} from 'lucide-react'
import { Button, Tag, Space, Input, InputNumber, Drawer, message, Tabs, Select } from 'antd'
import type { TableColumnsType } from 'antd'
import { PageContainer } from '../../components/common/PageContainer'
import { PageHeader } from '../../components/common/PageHeader'
import { StatCard, StatCardGrid } from '../../components/common/StatCard'
import { DataTable } from '../../components/common/DataTable'
import { StateView } from '../../components/common/StateView'
import { EmptyState } from '../../components/common/EmptyState'
import { FormField } from '../../components/common/FormField'
import { DashboardCard } from '../../components/dashboard/DashboardCard'
import { ProgressRing } from '../../components/dashboard/ProgressRing'
import { TrendChart } from '../../components/dashboard/TrendChart'
import {
  rqi2024Api,
  type RqiIndicator,
  type RqiIndicatorStatus,
  type RqiIndicatorCode,
  type RqiIndicatorConfig,
  type RqiGranularity,
  type RqiCategoryKey,
  type RqiDetailItem,
  type RqiDetailResult,
  type RqiIndicatorUnit,
  type RqiMomItem,
  type RqiQualityIndicator,
  type RqiTrendResult,
  type RqiWindowParams,
} from '../../services/api/rqi2024Api'
// [G005 W9-QC] 40 指标实时计算引擎
import {
  qualityScoringCenterApi,
  type ComputedSnapshot,
  type ComputedDashboard,
  type ComputedIndicator,
} from '../../services/api/qualityScoringCenterApi'
import { t } from '../../i18n/appI18n'

// ================= 元数据 =================

const STATUS_META: Record<RqiIndicatorStatus, { tag: string; stat: string; icon: typeof CheckCircle2 }> = {
  pass: { tag: 'green', stat: 'success', icon: CheckCircle2 },
  warn: { tag: 'orange', stat: 'warning', icon: AlertTriangle },
  fail: { tag: 'red', stat: 'error', icon: XCircle },
}

const KIND_LABELS: Record<RqiDetailItem['kind'], string> = {
  exam: t('rqi2024.kind.exam'),
  report: t('rqi2024.kind.report'),
  critical: t('rqi2024.kind.critical'),
  contrast: t('rqi2024.kind.contrast'),
}

const EXT_CATEGORY_KEYS: RqiCategoryKey[] = ['structure', 'process', 'outcome']

const DETAIL_FIELD_LABELS: Record<string, string> = {
  accessionNumber: t('rqi2024.field.accessionNumber'),
  modality: t('rqi2024.field.modality'),
  bodyPart: t('rqi2024.field.bodyPart'),
  startedAt: t('rqi2024.field.startedAt'),
  hasArtifact: t('rqi2024.field.hasArtifact'),
  artifactNote: t('rqi2024.field.artifactNote'),
  dimension: t('rqi2024.field.dimension'),
  isEmergency: t('rqi2024.field.isEmergency'),
  examStartedAt: t('rqi2024.field.examStartedAt'),
  reportIssuedAt: t('rqi2024.field.reportIssuedAt'),
  minutes: t('rqi2024.field.minutes'),
  hasRadiologistSignature: t('rqi2024.field.hasRadiologistSignature'),
  conclusionMatchesFindings: t('rqi2024.field.conclusionMatchesFindings'),
  hasObviousError: t('rqi2024.field.hasObviousError'),
  errorNote: t('rqi2024.field.errorNote'),
  criticalId: t('rqi2024.field.criticalId'),
  diagnosis: t('rqi2024.field.diagnosis'),
  category: t('rqi2024.field.category'),
  foundAt: t('rqi2024.field.foundAt'),
  notifiedAt: t('rqi2024.field.notifiedAt'),
  hasTimeRecord: t('rqi2024.field.hasTimeRecord'),
  hasContentRecord: t('rqi2024.field.hasContentRecord'),
  hasSignerRecord: t('rqi2024.field.hasSignerRecord'),
  contrastExtravasation: t('rqi2024.field.contrastExtravasation'),
  radsCategory: t('rqi2024.field.radsCategory'),
}

const statusLabel = (s: RqiIndicatorStatus) => t(`rqi2024.status.${s}`)

function buildPeriodOptions(granularity: RqiGranularity): string[] {
  const now = dayjs()
  if (granularity === 'quarter') {
    return Array.from({ length: 8 }, (_, i) => {
      const d = now.subtract(i * 3, 'month')
      return `${d.year()}-Q${Math.floor(d.month() / 3) + 1}`
    })
  }
  if (granularity === 'year') {
    return Array.from({ length: 5 }, (_, i) => String(now.year() - i))
  }
  return Array.from({ length: 12 }, (_, i) => now.subtract(i, 'month').format('YYYY-MM'))
}

function formatFieldValue(value: string | number | boolean | undefined) {
  if (value === undefined || value === null) return <span style={{ color: '#cbd5e1' }}>-</span>
  if (typeof value === 'boolean') {
    return value ? <Tag color="green">{t('rqi2024.yes')}</Tag> : <Tag>{t('rqi2024.no')}</Tag>
  }
  return String(value)
}

export default function RqiIndicatorPage() {
  const [indicators, setIndicators] = useState<RqiIndicator[]>([])
  const [dashboard, setDashboard] = useState<{
    total: number
    passCount: number
    warnCount: number
    failCount: number
    passRate: number
    period: string
    mom: RqiMomItem[]
  } | null>(null)
  const [extended, setExtended] = useState<RqiQualityIndicator[]>([])
  // [G005 W9-QC] 40 指标实时计算引擎 (compute/dashboard) — 替代静态镜像只读口径
  const [computed, setComputed] = useState<ComputedSnapshot | null>(null)
  const [computedDash, setComputedDash] = useState<ComputedDashboard | null>(null)
  // [G005 W4B] 指标快照历史 (GET /quality-indicators/snapshots)
  const [snapshots, setSnapshots] = useState<ComputedSnapshot[]>([])
  const [snapshotDetail, setSnapshotDetail] = useState<ComputedSnapshot | null>(null)
  const [snapshotDetailOpen, setSnapshotDetailOpen] = useState(false)
  const [source, setSource] = useState<'database' | 'seed' | 'offline'>('seed')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [granularity, setGranularity] = useState<RqiGranularity>('month')
  const [period, setPeriod] = useState<string>(() => buildPeriodOptions('month')[0] ?? '')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [selectedCode, setSelectedCode] = useState<RqiIndicatorCode | null>(null)
  const [detail, setDetail] = useState<RqiDetailResult | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [trend, setTrend] = useState<RqiTrendResult | null>(null)
  const [trendLoading, setTrendLoading] = useState(false)

  const [keyword, setKeyword] = useState('')

  const [configOpen, setConfigOpen] = useState(false)
  const [configItems, setConfigItems] = useState<RqiIndicatorConfig[]>([])
  const [configLoading, setConfigLoading] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  const periodOptions = useMemo(() => buildPeriodOptions(granularity), [granularity])

  const queryParams = useMemo<RqiWindowParams>(() => {
    if (dateFrom && dateTo) return { dateFrom, dateTo }
    return { period }
  }, [dateFrom, dateTo, period])

  const rangeActive = Boolean(dateFrom || dateTo)

  // ── 主数据加载 ──────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [indRes, dashRes, extRes, compRes, compDashRes, snapRes] = await Promise.all([
      rqi2024Api.getIndicators(queryParams).catch(() => ({ success: false as const })),
      rqi2024Api.getDashboard(queryParams).catch(() => ({ success: false as const })),
      rqi2024Api.getExtendedIndicators().catch(() => ({ success: false as const })),
      // [G005 W9-QC] 40 指标计算引擎 (可计算指标从真实数据派生)
      qualityScoringCenterApi.computeIndicators(dateFrom && dateTo ? period : period).catch(() => ({ success: false as const })),
      qualityScoringCenterApi.getIndicatorDashboard(dateFrom && dateTo ? period : period).catch(() => ({ success: false as const })),
      // [G005 W4B] 指标快照历史
      qualityScoringCenterApi.listSnapshots().catch(() => ({ success: false as const })),
    ])
    if (compRes.success && compRes.data) setComputed(compRes.data)
    if (compDashRes.success && compDashRes.data) setComputedDash(compDashRes.data)
    if (snapRes.success && Array.isArray(snapRes.data)) setSnapshots(snapRes.data)

    if (!indRes.success && !dashRes.success) {
      setError(t('rqi2024.loadFailed'))
      setSource('offline')
      setIndicators([])
      setDashboard(null)
      setLoading(false)
      return
    }

    if (indRes.success && indRes.data) {
      setIndicators(indRes.data.indicators)
      setSource(indRes.data.source)
      const first = indRes.data.indicators[0]?.code ?? null
      setSelectedCode((prev) => prev ?? first)
    }
    if (dashRes.success && dashRes.data) {
      const d = dashRes.data
      setDashboard({
        total: d.total,
        passCount: d.passCount,
        warnCount: d.warnCount,
        failCount: d.failCount,
        passRate: d.passRate,
        period: d.period,
        mom: d.mom,
      })
      setSource(d.source)
    }
    if (extRes.success && extRes.data?.data) setExtended(extRes.data.data)
    setLoading(false)
  }, [queryParams])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPeriod(buildPeriodOptions(granularity)[0] ?? '')
  }, [granularity])

  // ── 明细 + 趋势 ─────────────────────────────────────────────
  const loadDetail = useCallback(
    async (code: RqiIndicatorCode) => {
      setDetailLoading(true)
      const res = await rqi2024Api.getDetail(code, queryParams).catch(() => ({ success: false as const }))
      setDetail(res.success && res.data ? res.data : null)
      setDetailLoading(false)
    },
    [queryParams],
  )

  const loadTrend = useCallback(async (code: RqiIndicatorCode) => {
    setTrendLoading(true)
    const res = await rqi2024Api.getTrend(code, 12).catch(() => ({ success: false as const }))
    setTrend(res.success && res.data ? res.data : null)
    setTrendLoading(false)
  }, [])

  useEffect(() => {
    if (!selectedCode) {
      setDetail(null)
      setTrend(null)
      return
    }
    void loadDetail(selectedCode)
    void loadTrend(selectedCode)
  }, [selectedCode, loadDetail, loadTrend])

  const selectedIndicator = useMemo(
    () => indicators.find((i) => i.code === selectedCode) ?? detail?.indicator ?? null,
    [indicators, selectedCode, detail],
  )

  // ── 明细动态列 (按指标类型自适应 detail 字段) ────────────────
  const detailColumns = useMemo<TableColumnsType<RqiDetailItem>>(() => {
    const dynamicKeys: string[] = []
    for (const item of detail?.items ?? []) {
      for (const key of Object.keys(item.detail)) {
        if (!dynamicKeys.includes(key)) dynamicKeys.push(key)
      }
    }
    const columns: TableColumnsType<RqiDetailItem> = [
      {
        title: t('rqi2024.detailColLabel'),
        key: 'label',
        width: 220,
        fixed: 'left',
        render: (_, r) => <span style={{ fontWeight: 500 }}>{r.label}</span>,
      },
      {
        title: t('rqi2024.detailColKind'),
        key: 'kind',
        width: 90,
        render: (_, r) => <Tag>{KIND_LABELS[r.kind] ?? r.kind}</Tag>,
      },
      {
        title: t('rqi2024.detailColInNumerator'),
        key: 'inNumerator',
        width: 100,
        align: 'center',
        render: (_, r) =>
          r.inNumerator ? <Tag color="green">{t('rqi2024.yes')}</Tag> : <Tag color="default">{t('rqi2024.no')}</Tag>,
      },
      {
        title: t('rqi2024.detailColInDenominator'),
        key: 'inDenominator',
        width: 100,
        align: 'center',
        render: (_, r) =>
          r.inDenominator ? <Tag color="blue">{t('rqi2024.yes')}</Tag> : <Tag color="default">{t('rqi2024.no')}</Tag>,
      },
    ]
    for (const key of dynamicKeys) {
      columns.push({
        title: DETAIL_FIELD_LABELS[key] ?? key,
        key,
        ellipsis: true,
        render: (_, r) => formatFieldValue(r.detail[key]),
      })
    }
    return columns
  }, [detail])

  const trendData = useMemo<Array<Record<string, string | number>>>(
    () => (trend?.points ?? []).map((p) => ({ month: p.month, rate: p.rate, target: p.target })),
    [trend],
  )

  const trendUnit: RqiIndicatorUnit = indicatorUnit(selectedIndicator)

  const extendedTabs = useMemo(
    () =>
      EXT_CATEGORY_KEYS.map((category) => {
        const rows = extended.filter(
          (e) =>
            e.categoryKey === category &&
            (!keyword ||
              e.name.includes(keyword) ||
              e.nameEn.toLowerCase().includes(keyword.toLowerCase()) ||
              e.code.toLowerCase().includes(keyword.toLowerCase())),
        )
        return { key: category, rows }
      }),
    [extended, keyword],
  )

  const extendedColumns = useMemo<TableColumnsType<RqiQualityIndicator>>(
    () => [
      {
        title: t('rqi2024.extColCode'),
        dataIndex: 'code',
        key: 'code',
        width: 120,
        render: (v: string) => <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{v}</span>,
      },
      {
        title: t('rqi2024.extColName'),
        dataIndex: 'name',
        key: 'name',
        width: 200,
        render: (v: string, r) => (
          <Space direction="vertical" size={2}>
            <span style={{ fontWeight: 500 }}>{v}</span>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>{r.nameEn}</span>
          </Space>
        ),
      },
      { title: t('rqi2024.extColFormula'), dataIndex: 'formula', key: 'formula', ellipsis: true },
      { title: t('rqi2024.extColTarget'), dataIndex: 'target', key: 'target', width: 140 },
      { title: t('rqi2024.extColFrequency'), dataIndex: 'frequency', key: 'frequency', width: 100 },
      { title: t('rqi2024.extColResponsible'), dataIndex: 'responsible', key: 'responsible', width: 120 },
      { title: t('rqi2024.extColThreshold'), dataIndex: 'threshold', key: 'threshold', width: 160 },
    ],
    [],
  )

  // ── 交互 ────────────────────────────────────────────────────
  const openConfig = useCallback(async () => {
    setConfigOpen(true)
    setConfigLoading(true)
    const res = await rqi2024Api.getConfig().catch(() => ({ success: false as const }))
    setConfigItems(res.success && res.data ? res.data.items : [])
    setConfigLoading(false)
  }, [])

  const updateConfigItem = useCallback((code: RqiIndicatorCode, patch: Partial<RqiIndicatorConfig>) => {
    setConfigItems((prev) => prev.map((c) => (c.code === code ? { ...c, ...patch } : c)))
  }, [])

  const handleSaveConfig = useCallback(async () => {
    setConfigSaving(true)
    try {
      const res = await rqi2024Api.updateConfig(
        configItems.map((c) => ({ code: c.code, target: c.target, warnMargin: c.warnMargin })),
      )
      if (!res.success) throw new Error(res.error?.message ?? t('rqi2024.configFailed'))
      message.success(t('rqi2024.configSaved'))
      setConfigOpen(false)
      void load()
      if (selectedCode) {
        void loadDetail(selectedCode)
        void loadTrend(selectedCode)
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('rqi2024.configFailed'))
    } finally {
      setConfigSaving(false)
    }
  }, [configItems, load, loadDetail, loadTrend, selectedCode])

  const handleExport = useCallback(
    async (format: 'csv' | 'json') => {
      setExporting(true)
      try {
        const res = await rqi2024Api.exportIndicators({ format, ...queryParams })
        if (!res.success || !res.data) throw new Error(res.error?.message ?? t('rqi2024.exportFailed'))
        const { content, filename } = res.data
        const blob = new Blob([content], {
          type: format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8',
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        message.success(t('rqi2024.exported'))
      } catch (e) {
        message.error(e instanceof Error ? e.message : t('rqi2024.exportFailed'))
      } finally {
        setExporting(false)
      }
    },
    [queryParams],
  )

  const sourceBadge =
    source === 'database' ? (
      <Tag icon={<Database size={12} />} color="green">
        {t('rqi2024.source.database')}
      </Tag>
    ) : source === 'seed' ? (
      <Tag icon={<HardDrive size={12} />} color="orange">
        {t('rqi2024.source.seed')}
      </Tag>
    ) : (
      <Tag color="red">{t('rqi2024.source.offline')}</Tag>
    )

  const momByCode = useMemo(() => {
    const map = new Map<string, RqiMomItem>()
    for (const m of dashboard?.mom ?? []) map.set(m.code, m)
    return map
  }, [dashboard])

  const improvingCount = useMemo(
    () =>
      (dashboard?.mom ?? []).filter((m) => {
        const ind = indicators.find((i) => i.code === m.code)
        if (!ind || m.trend === 'flat') return false
        return (m.trend === 'up') === (ind.direction === 'higher')
      }).length,
    [dashboard, indicators],
  )

  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader
        icon={<Activity size={20} color="var(--color-primary-600)" />}
        title={t('rqi2024.title')}
        subtitle={t('rqi2024.subtitle')}
        actions={
          <Space wrap>
            {sourceBadge}
            <Button size="small" icon={<Settings2 size={12} />} onClick={() => void openConfig()}>
              {t('rqi2024.config')}
            </Button>
            <Button size="small" icon={<Download size={12} />} loading={exporting} onClick={() => void handleExport('csv')}>
              {t('rqi2024.exportCsv')}
            </Button>
            <Button size="small" icon={<Download size={12} />} loading={exporting} onClick={() => void handleExport('json')}>
              {t('rqi2024.exportJson')}
            </Button>
            <Button size="small" icon={<RefreshCw size={12} />} loading={loading} onClick={() => void load()}>
              {t('rqi2024.refresh')}
            </Button>
          </Space>
        }
      />

      <div style={{ padding: 24 }}>
        {/* 周期选择工具栏 */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Space size={4}>
            {(['month', 'quarter', 'year'] as RqiGranularity[]).map((g) => (
              <Button
                key={g}
                size="small"
                type={granularity === g ? 'primary' : 'default'}
                onClick={() => setGranularity(g)}
                style={{ padding: '0 14px' }}
              >
                {t(`rqi2024.granularity.${g}`)}
              </Button>
            ))}
          </Space>
          <Select
            size="small"
            style={{ width: 140 }}
            value={period}
            onChange={setPeriod}
            options={periodOptions.map((p) => ({ value: p, label: p }))}
            disabled={rangeActive}
          />
          <Space size={6}>
            <span style={{ color: '#64748b', fontSize: 12 }}>{t('rqi2024.dateRange')}</span>
            <Input
              size="small"
              type="date"
              style={{ width: 150 }}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <span style={{ color: '#94a3b8' }}>~</span>
            <Input
              size="small"
              type="date"
              style={{ width: 150 }}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            {rangeActive && (
              <Button
                size="small"
                type="text"
                onClick={() => {
                  setDateFrom('')
                  setDateTo('')
                }}
              >
                {t('rqi2024.clearRange')}
              </Button>
            )}
          </Space>
          {source !== 'offline' && period && !rangeActive && (
            <span style={{ color: '#94a3b8', fontSize: 12, marginLeft: 'auto' }}>
              {t('rqi2024.period')}: {period}
            </span>
          )}
        </div>

        <StateView
          loading={loading}
          error={error}
          empty={!loading && indicators.length === 0}
          onRetry={() => void load()}
          retryText={t('rqi2024.retry')}
          emptyDescription={t('rqi2024.empty')}
          minHeight={320}
        >
          {/* 7 指标卡片 */}
          <StatCardGrid gap={12} minWidth={260}>
            {indicators.map((ind) => {
              const mom = momByCode.get(ind.code)
              const goodTrend = mom
                ? mom.trend === 'flat'
                  ? 'flat'
                  : (mom.trend === 'up') === (ind.direction === 'higher')
                    ? 'up'
                    : 'down'
                : undefined
              const meta = STATUS_META[ind.status]
              const StatusIcon = meta.icon
              const isSelected = ind.code === selectedCode
              return (
                <StatCard
                  key={ind.code}
                  title={
                    <span>
                      {ind.name}{' '}
                      <span style={{ color: '#94a3b8', fontSize: 11, marginLeft: 4 }}>{ind.code}</span>
                    </span>
                  }
                  value={ind.rate}
                  suffix={ind.unit}
                  icon={<StatusIcon size={18} />}
                  color={meta.stat}
                  gradient={isSelected}
                  sub={
                    <span>
                      {t('rqi2024.numerator')} {ind.numerator} / {t('rqi2024.denominator')} {ind.denominator} ·{' '}
                      {t('rqi2024.target')} {ind.target}
                      {ind.unit}
                    </span>
                  }
                  trend={
                    mom
                      ? {
                          value: Math.abs(mom.delta),
                          direction: goodTrend,
                          isUp: goodTrend === 'up',
                        }
                      : undefined
                  }
                  onClick={() => setSelectedCode(ind.code)}
                  style={isSelected ? { outline: '2px solid var(--color-primary-600)', outlineOffset: -1 } : undefined}
                />
              )
            })}
          </StatCardGrid>

          {/* 达标总览 */}
          <div style={{ marginTop: 16 }}>
            <DashboardCard title={t('rqi2024.overview')} icon={<Target size={15} />} extra={<Tag>{dashboard?.period ?? period}</Tag>}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 32 }}>
                <ProgressRing
                  percent={dashboard?.passRate ?? 0}
                  size={120}
                  strokeWidth={12}
                  subLabel={t('rqi2024.passRate')}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
                  <OverviewStat
                    icon={<CheckCircle2 size={18} />}
                    color="var(--color-success-600)"
                    label={t('rqi2024.status.pass')}
                    value={`${dashboard?.passCount ?? 0} / ${dashboard?.total ?? indicators.length}`}
                  />
                  <OverviewStat
                    icon={<AlertTriangle size={18} />}
                    color="var(--color-warning-600)"
                    label={t('rqi2024.status.warn')}
                    value={String(dashboard?.warnCount ?? 0)}
                  />
                  <OverviewStat
                    icon={<XCircle size={18} />}
                    color="var(--color-error-600)"
                    label={t('rqi2024.status.fail')}
                    value={String(dashboard?.failCount ?? 0)}
                  />
                  <OverviewStat
                    icon={<TrendingUp size={18} />}
                    color="var(--color-primary-600)"
                    label={t('rqi2024.momImprove')}
                    value={t('rqi2024.momImproveValue', { count: improvingCount, total: dashboard?.total ?? indicators.length })}
                  />
                </div>
              </div>
            </DashboardCard>
          </div>

          {/* 明细下钻 + 趋势 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 16, marginTop: 16 }}>
            <DashboardCard
              title={
                selectedIndicator
                  ? `${t('rqi2024.detailTitle')} · ${selectedIndicator.name}`
                  : t('rqi2024.detailTitle')
              }
              icon={<ListChecks size={15} />}
              extra={
                selectedIndicator ? (
                  <Space size={6}>
                    <Tag color={STATUS_META[selectedIndicator.status].tag}>{statusLabel(selectedIndicator.status)}</Tag>
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>{selectedIndicator.code}</span>
                  </Space>
                ) : null
              }
            >
              {selectedIndicator && detail ? (
                <DataTable<RqiDetailItem>
                  rowKey={(r) => r.id}
                  columns={detailColumns}
                  dataSource={detail.items}
                  loading={detailLoading}
                  pageSize={10}
                  emptyText={t('rqi2024.detailEmpty')}
                  scroll={{ x: 'max-content' }}
                />
              ) : (
                <EmptyState
                  type="nodata"
                  description={selectedCode ? t('rqi2024.detailEmpty') : t('rqi2024.selectHint')}
                />
              )}
            </DashboardCard>

            <DashboardCard
              title={
                selectedIndicator
                  ? `${t('rqi2024.trendTitle')} · ${selectedIndicator.name}`
                  : t('rqi2024.trendTitle')
              }
              icon={<TrendingUp size={15} />}
              extra={<span style={{ color: '#94a3b8', fontSize: 12 }}>{t('rqi2024.trendMonths')}</span>}
            >
              {selectedIndicator ? (
                <TrendChart
                  type="line"
                  data={trendData}
                  xKey="month"
                  series={[
                    { key: 'rate', name: t('rqi2024.trendRate'), color: 'var(--color-primary-600)' },
                    { key: 'target', name: t('rqi2024.trendTarget'), color: 'var(--color-warning-500)' },
                  ]}
                  loading={trendLoading}
                  height={280}
                  yTickFormatter={(v) => `${v}${trendUnit}`}
                  testId="rqi-trend-chart"
                />
              ) : (
                <EmptyState type="nodata" description={t('rqi2024.selectHint')} />
              )}
            </DashboardCard>
          </div>

          {/* 40 条扩展指标 */}
          <div style={{ marginTop: 16 }}>
            <DashboardCard
              title={t('rqi2024.extendedTitle')}
              icon={<Activity size={15} />}
              extra={
                <Input
                  size="small"
                  allowClear
                  prefix={<Search size={13} color="#94a3b8" />}
                  placeholder={t('rqi2024.extendedSearch')}
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  style={{ width: 220 }}
                />
              }
            >
              <Tabs
                items={extendedTabs.map((tab) => ({
                  key: tab.key,
                  label: `${t(`rqi2024.category.${tab.key}`)} (${tab.rows.length})`,
                  children: (
                    <DataTable<RqiQualityIndicator>
                      rowKey={(r) => r.code}
                      columns={extendedColumns}
                      dataSource={tab.rows}
                      pageSize={10}
                      emptyText={t('rqi2024.extendedEmpty')}
                      scroll={{ x: 'max-content' }}
                    />
                  ),
                }))}
              />
            </DashboardCard>
          </div>

          {/* [G005 W9-QC] 40 指标实时计算引擎 (可从报告/检查/危急值/设备数据派生) */}
          <div style={{ marginTop: 16 }} data-testid="rqi-compute-engine">
            <DashboardCard title={t('rqi2024.computeTitle')} icon={<Activity size={15} />}>
              {computedDash && (
                <StatCardGrid columns={4}>
                  <StatCard title={t('rqi2024.computeTotal')} value={computedDash.total} icon={<Activity size={18} />} color="primary" />
                  <StatCard title={t('rqi2024.computeComputable')} value={computedDash.computableCount} icon={<Target size={18} />} color="info" />
                  <StatCard title={t('rqi2024.computePassRate')} value={computedDash.passRate} suffix="%" icon={<CheckCircle2 size={18} />} color="success" />
                  <StatCard title={t('rqi2024.computePeriod')} value={computedDash.period} icon={<TrendingUp size={18} />} color="warning" />
                </StatCardGrid>
              )}
              {computed && (
                <div style={{ marginTop: 12 }}>
                  <DataTable<ComputedIndicator>
                    rowKey={(r) => r.code}
                    pageSize={10}
                    scroll={{ x: 'max-content' }}
                    emptyText={t('rqi2024.computeEmpty')}
                    columns={[
                      { title: t('rqi2024.extColCode'), dataIndex: 'code', key: 'code', width: 110 },
                      { title: t('rqi2024.extColName'), dataIndex: 'name', key: 'name' },
                      { title: t('rqi2024.computeNumerator'), dataIndex: 'numerator', key: 'numerator', width: 80 },
                      { title: t('rqi2024.computeDenominator'), dataIndex: 'denominator', key: 'denominator', width: 80 },
                      { title: t('rqi2024.computeRate'), key: 'rate', width: 110, render: (_: unknown, r: ComputedIndicator) => `${r.rate}${r.unit}` },
                      { title: t('rqi2024.extColTarget'), dataIndex: 'target', key: 'target', width: 100 },
                      {
                        title: t('rqi2024.computeStatus'), key: 'status', width: 100,
                        render: (_: unknown, r: ComputedIndicator) => {
                          const m = STATUS_META[r.status as RqiIndicatorStatus]
                          if (!m) return <Tag>{r.status}</Tag>
                          const Icon = m.icon
                          return <Tag color={m.tag} icon={<Icon size={12} />}>{statusLabel(r.status as RqiIndicatorStatus)}</Tag>
                        },
                      },
                      {
                        title: t('rqi2024.computeSource'), key: 'computable', width: 100,
                        render: (_: unknown, r: ComputedIndicator) => <Tag color={r.computable ? 'green' : 'default'}>{r.computable ? t('rqi2024.computeDerived') : t('rqi2024.computeEstimated')}</Tag>,
                      },
                    ]}
                    dataSource={computed.indicators}
                  />
                </div>
              )}
            </DashboardCard>
          </div>

          {/* [G005 W4B] 指标快照历史 (GET /quality-indicators/snapshots) */}
          <div style={{ marginTop: 16 }} data-testid="rqi-snapshot-history">
            <DashboardCard
              title={t('w4b.qi.snapshotTitle')}
              icon={<Activity size={15} />}
              extra={<Tag color="blue">{snapshots.length}</Tag>}
            >
              <DataTable<ComputedSnapshot>
                rowKey={(r) => r.id}
                pageSize={10}
                scroll={{ x: 'max-content' }}
                emptyText={t('w4b.qi.empty')}
                columns={[
                  { title: t('w4b.qi.thSnapshotId'), dataIndex: 'id', key: 'id', width: 130 },
                  { title: t('w4b.qi.thPeriod'), dataIndex: 'period', key: 'period', width: 120 },
                  { title: t('w4b.qi.thGeneratedAt'), dataIndex: 'generatedAt', key: 'generatedAt', width: 170, render: (v: string) => v ? v.slice(0, 19).replace('T', ' ') : '-' },
                  { title: t('w4b.qi.thCount'), dataIndex: 'indicatorCount', key: 'indicatorCount', width: 90 },
                  { title: t('w4b.qi.thPersisted'), dataIndex: 'persisted', key: 'persisted', width: 100, render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? t('w4b.qi.yes') : t('w4b.qi.no')}</Tag> },
                  {
                    title: '',
                    key: 'view', width: 90,
                    render: (_: unknown, r: ComputedSnapshot) => (
                      <Button size="small" type="link" onClick={() => { setSnapshotDetail(r); setSnapshotDetailOpen(true) }}>{t('w4b.qi.view')}</Button>
                    ),
                  },
                ]}
                dataSource={snapshots}
              />
            </DashboardCard>
          </div>
        </StateView>
      </div>

      {/* 目标值配置抽屉 */}
      <Drawer
        title={t('rqi2024.configTitle')}
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        width={520}
        extra={
          <Space>
            <Button size="small" onClick={() => setConfigOpen(false)}>
              {t('rqi2024.cancel')}
            </Button>
            <Button size="small" type="primary" loading={configSaving} disabled={configLoading} onClick={() => void handleSaveConfig()}>
              {t('rqi2024.save')}
            </Button>
          </Space>
        }
      >
        <div style={{ color: '#64748b', fontSize: 12, marginBottom: 16 }}>{t('rqi2024.configHint')}</div>
        {configLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>{t('rqi2024.loading')}</div>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {configItems.map((c) => (
              <div
                key={c.code}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 10 }}>
                  {c.name} <span style={{ color: '#94a3b8', fontSize: 11, marginLeft: 4 }}>{c.code}</span>
                </div>
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  <FormField label={`${t('rqi2024.configTarget')} (${c.unit})`} labelWidth={110}>
                    <InputNumber
                      size="small"
                      min={0}
                      step={0.1}
                      value={c.target}
                      onChange={(v) => updateConfigItem(c.code, { target: v ?? 0 })}
                      style={{ width: '100%' }}
                    />
                  </FormField>
                  <FormField label={t('rqi2024.configWarnMargin')} labelWidth={110}>
                    <InputNumber
                      size="small"
                      min={0}
                      step={0.1}
                      value={c.warnMargin}
                      onChange={(v) => updateConfigItem(c.code, { warnMargin: v ?? 0 })}
                      style={{ width: '100%' }}
                    />
                  </FormField>
                </Space>
              </div>
            ))}
          </Space>
        )}
      </Drawer>

      {/* [G005 W4B] 快照指标明细抽屉 */}
      <Drawer
        title={snapshotDetail ? `${t('w4b.qi.detailTitle')} · ${snapshotDetail.id}` : t('w4b.qi.detailTitle')}
        open={snapshotDetailOpen}
        onClose={() => setSnapshotDetailOpen(false)}
        width={720}
      >
        {snapshotDetail && (
          <DataTable<ComputedIndicator>
            rowKey={(r) => r.code}
            pageSize={10}
            scroll={{ x: 'max-content' }}
            emptyText={t('w4b.qi.empty')}
            columns={[
              { title: t('w4b.qi.thCode'), dataIndex: 'code', key: 'code', width: 110 },
              { title: t('w4b.qi.thName'), dataIndex: 'name', key: 'name' },
              { title: t('w4b.qi.thRate'), key: 'rate', width: 110, render: (_: unknown, r: ComputedIndicator) => `${r.rate}${r.unit}` },
              {
                title: t('w4b.qi.thStatus'), key: 'status', width: 100,
                render: (_: unknown, r: ComputedIndicator) => {
                  const m = STATUS_META[r.status as RqiIndicatorStatus]
                  if (!m) return <Tag>{r.status}</Tag>
                  const Icon = m.icon
                  return <Tag color={m.tag} icon={<Icon size={12} />}>{statusLabel(r.status as RqiIndicatorStatus)}</Tag>
                },
              },
            ]}
            dataSource={snapshotDetail.indicators}
          />
        )}
      </Drawer>
    </PageContainer>
  )
}

function indicatorUnit(ind: RqiIndicator | null): RqiIndicatorUnit {
  return ind?.unit ?? '%'
}

function OverviewStat({
  icon,
  color,
  label,
  value,
}: {
  icon: ReactNode
  color: string
  label: string
  value: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span
        style={{
          width: 38,
          height: 38,
          borderRadius: '50%',
          background: `${color}1A`,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div>
        <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color }}>{value}</div>
      </div>
    </div>
  )
}
