/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 3 - 放射影像质控指标国家上报中心 (/qc/rqi-report-center)
 *
 * 在 rqi-2024 (7 条国标指标) 之上实现「按周期生成上报数据 → 提交 → 回执」闭环:
 *   DRAFT --submit--> SUBMITTED --accept--> ACCEPTED (回执号)
 *                              \--reject--> REJECTED --reopen--> DRAFT (可重报)
 *
 * 区块:
 *   - 顶部 PageHeader + 「新建上报批次」Modal (周期粒度 + period + createdBy)
 *   - 统计卡: 批次总数 / DRAFT / SUBMITTED / ACCEPTED / REJECTED / 按时上报率
 *   - Tab 批次列表: DataTable (批次号/周期/状态/指标数/创建时间/提交时间/回执号/操作) 分页
 *     · 操作: 详情 (Drawer 7 指标明细) / 提交 / 接受-回执号 / 驳回-原因 / 重报 / 导出 CSV/JSON
 *   - Tab 上报历史: DataTable (批次/状态/提交时间/回执/备注)
 * 数据源: rqiReportCenterApi (后端 /rqi-report-center, 内存 overlay + seed 回退)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import dayjs from 'dayjs'
import {
  Activity,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Database,
  Download,
  Eye,
  FileText,
  HardDrive,
  ListChecks,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react'
import { Tag, Space, Select, Input, Drawer, message, Tabs } from 'antd'
import type { TableColumnsType } from 'antd'
import { PageContainer } from '../../components/common/PageContainer'
import { PageHeader } from '../../components/common/PageHeader'
import { StatCard, StatCardGrid } from '../../components/common/StatCard'
import { DataTable } from '../../components/common/DataTable'
import { StateView } from '../../components/common/StateView'
import { EmptyState } from '../../components/common/EmptyState'
import { FormField } from '../../components/common/FormField'
import { ActionButton } from '../../components/common/ActionButton'
import { AppModal } from '../../components/common/AppModal'
import {
  rqiReportCenterApi,
  REPORT_PERIODS,
  type ReportBatchStatus,
  type ReportExportFormat,
  type ReportHistoryItem,
  type ReportPeriod,
  type ReportStatsResult,
  type RqiReportBatch,
  type RqiReportIndicatorEntry,
} from '../../services/api/rqiReportCenterApi'
import type { RqiIndicatorStatus } from '../../services/api/rqi2024Api'
import { getCurrentUser } from '../../utils/auth'
import { t } from '../../i18n/appI18n'

// ================= 元数据 =================

const LIST_PAGE_SIZE = 20
const HISTORY_PAGE_SIZE = 20

/** 状态标签颜色: DRAFT=default, SUBMITTED=processing, ACCEPTED=success, REJECTED=error */
const STATUS_TAG: Record<ReportBatchStatus, 'default' | 'processing' | 'success' | 'error'> = {
  DRAFT: 'default',
  SUBMITTED: 'processing',
  ACCEPTED: 'success',
  REJECTED: 'error',
}

const INDICATOR_STATUS_TAG: Record<RqiIndicatorStatus, string> = {
  pass: 'green',
  warn: 'orange',
  fail: 'red',
}

const statusLabel = (status: ReportBatchStatus) => t(`rqiReport.status.${status}`)

function buildPeriodOptions(granularity: ReportPeriod): string[] {
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

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  const d = dayjs(value)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : value
}

export default function RqiReportCenterPage() {
  // ── 统计 ────────────────────────────────────────────────────
  const [stats, setStats] = useState<ReportStatsResult | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // ── 批次列表 ────────────────────────────────────────────────
  const [batches, setBatches] = useState<RqiReportBatch[]>([])
  const [listTotal, setListTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(LIST_PAGE_SIZE)
  const [statusFilter, setStatusFilter] = useState<ReportBatchStatus | 'ALL'>('ALL')
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  // ── 上报历史 ────────────────────────────────────────────────
  const [history, setHistory] = useState<ReportHistoryItem[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('batches')

  // ── 新建批次 ────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [granularity, setGranularity] = useState<ReportPeriod>('month')
  const [period, setPeriod] = useState<string>(() => buildPeriodOptions('month')[0] ?? '')
  const [createdBy, setCreatedBy] = useState('')
  const [creating, setCreating] = useState(false)

  // ── 批次详情 Drawer ─────────────────────────────────────────
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailBatch, setDetailBatch] = useState<RqiReportBatch | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // ── 回执 (接受 / 驳回) ─────────────────────────────────────
  const [acceptTarget, setAcceptTarget] = useState<RqiReportBatch | null>(null)
  const [receiptNo, setReceiptNo] = useState('')
  const [acceptRemark, setAcceptRemark] = useState('')
  const [accepting, setAccepting] = useState(false)

  const [rejectTarget, setRejectTarget] = useState<RqiReportBatch | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectRemark, setRejectRemark] = useState('')
  const [rejecting, setRejecting] = useState(false)

  // ── 行内操作 / 导出 ────────────────────────────────────────
  const [actingId, setActingId] = useState<string | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)

  const periodOptions = useMemo(() => buildPeriodOptions(granularity), [granularity])

  const statusOptions = useMemo(
    () => [
      { value: 'ALL' as const, label: t('rqiReport.filter.all') },
      { value: 'DRAFT' as const, label: t('rqiReport.status.DRAFT') },
      { value: 'SUBMITTED' as const, label: t('rqiReport.status.SUBMITTED') },
      { value: 'ACCEPTED' as const, label: t('rqiReport.status.ACCEPTED') },
      { value: 'REJECTED' as const, label: t('rqiReport.status.REJECTED') },
    ],
    [],
  )

  // ── 数据加载 ────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    const res = await rqiReportCenterApi.getStats().catch(() => ({ success: false as const }))
    setStats(res.success && res.data ? res.data : null)
    setStatsLoading(false)
  }, [])

  const loadBatches = useCallback(async () => {
    setListLoading(true)
    setListError(null)
    const res = await rqiReportCenterApi
      .listBatches({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        page,
        pageSize,
      })
      .catch(() => ({ success: false as const }))
    if (!res.success || !res.data) {
      setListError(t('rqiReport.loadFailed'))
      setBatches([])
      setListTotal(0)
    } else {
      setBatches(res.data.items)
      setListTotal(res.data.total)
    }
    setListLoading(false)
  }, [statusFilter, page, pageSize])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError(null)
    const res = await rqiReportCenterApi
      .getHistory({ page: historyPage, pageSize: HISTORY_PAGE_SIZE })
      .catch(() => ({ success: false as const }))
    if (!res.success || !res.data) {
      setHistoryError(t('rqiReport.loadFailed'))
      setHistory([])
      setHistoryTotal(0)
    } else {
      setHistory(res.data.items)
      setHistoryTotal(res.data.total)
    }
    setHistoryLoading(false)
  }, [historyPage])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  useEffect(() => {
    void loadBatches()
  }, [loadBatches])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  useEffect(() => {
    setPeriod(buildPeriodOptions(granularity)[0] ?? '')
  }, [granularity])

  const reload = useCallback(async () => {
    await Promise.all([loadStats(), loadBatches(), loadHistory()])
  }, [loadStats, loadBatches, loadHistory])

  // ── 新建批次 ────────────────────────────────────────────────
  const openCreate = useCallback(() => {
    const user = getCurrentUser()
    setGranularity('month')
    setPeriod(buildPeriodOptions('month')[0] ?? '')
    setCreatedBy(user?.name ?? '')
    setCreateOpen(true)
  }, [])

  const handleCreate = useCallback(async () => {
    if (!period || !createdBy.trim()) {
      message.warning(t('rqiReport.createRequired'))
      return
    }
    setCreating(true)
    try {
      const res = await rqiReportCenterApi.createBatch({ period, createdBy: createdBy.trim() })
      if (!res.success || !res.data) throw new Error(res.error?.message ?? t('rqiReport.createFailed'))
      message.success(t('rqiReport.createSuccess'))
      setCreateOpen(false)
      await reload()
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('rqiReport.createFailed'))
    } finally {
      setCreating(false)
    }
  }, [period, createdBy, reload])

  // ── 状态流转 ────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (batch: RqiReportBatch) => {
      setActingId(batch.id)
      try {
        const res = await rqiReportCenterApi.submitBatch(batch.id)
        if (!res.success) throw new Error(res.error?.message ?? t('rqiReport.submitFailed'))
        message.success(t('rqiReport.submitSuccess'))
        await reload()
      } catch (e) {
        message.error(e instanceof Error ? e.message : t('rqiReport.submitFailed'))
      } finally {
        setActingId(null)
      }
    },
    [reload],
  )

  const handleReopen = useCallback(
    async (batch: RqiReportBatch) => {
      setActingId(batch.id)
      try {
        const res = await rqiReportCenterApi.reopenBatch(batch.id)
        if (!res.success) throw new Error(res.error?.message ?? t('rqiReport.reopenFailed'))
        message.success(t('rqiReport.reopenSuccess'))
        await reload()
      } catch (e) {
        message.error(e instanceof Error ? e.message : t('rqiReport.reopenFailed'))
      } finally {
        setActingId(null)
      }
    },
    [reload],
  )

  const openAccept = useCallback((batch: RqiReportBatch) => {
    setReceiptNo('')
    setAcceptRemark('')
    setAcceptTarget(batch)
  }, [])

  const handleAccept = useCallback(async () => {
    if (!acceptTarget) return
    if (!receiptNo.trim()) {
      message.warning(t('rqiReport.acceptRequired'))
      return
    }
    setAccepting(true)
    try {
      const res = await rqiReportCenterApi.acceptBatch(acceptTarget.id, {
        receiptNo: receiptNo.trim(),
        remark: acceptRemark.trim() || undefined,
      })
      if (!res.success) throw new Error(res.error?.message ?? t('rqiReport.acceptFailed'))
      message.success(t('rqiReport.acceptSuccess'))
      setAcceptTarget(null)
      await reload()
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('rqiReport.acceptFailed'))
    } finally {
      setAccepting(false)
    }
  }, [acceptTarget, receiptNo, acceptRemark, reload])

  const openReject = useCallback((batch: RqiReportBatch) => {
    setRejectReason('')
    setRejectRemark('')
    setRejectTarget(batch)
  }, [])

  const handleReject = useCallback(async () => {
    if (!rejectTarget) return
    if (!rejectReason.trim()) {
      message.warning(t('rqiReport.rejectRequired'))
      return
    }
    setRejecting(true)
    try {
      const res = await rqiReportCenterApi.rejectBatch(rejectTarget.id, {
        reason: rejectReason.trim(),
        remark: rejectRemark.trim() || undefined,
      })
      if (!res.success) throw new Error(res.error?.message ?? t('rqiReport.rejectFailed'))
      message.success(t('rqiReport.rejectSuccess'))
      setRejectTarget(null)
      await reload()
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('rqiReport.rejectFailed'))
    } finally {
      setRejecting(false)
    }
  }, [rejectTarget, rejectReason, rejectRemark, reload])

  // ── 详情 ────────────────────────────────────────────────────
  const openDetail = useCallback(async (batch: RqiReportBatch) => {
    setDetailOpen(true)
    setDetailBatch(batch)
    setDetailLoading(true)
    const res = await rqiReportCenterApi
      .getBatch(batch.id)
      .catch(() => ({ success: false as const }))
    if (res.success && res.data) setDetailBatch(res.data)
    setDetailLoading(false)
  }, [])

  // ── 导出 ────────────────────────────────────────────────────
  const handleExport = useCallback(async (batch: RqiReportBatch, format: ReportExportFormat) => {
    setExporting(`${batch.id}:${format}`)
    try {
      const res = await rqiReportCenterApi.exportBatch(batch.id, format)
      if (!res.success || !res.data) throw new Error(res.error?.message ?? t('rqiReport.exportFailed'))
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
      message.success(t('rqiReport.exportSuccess'))
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('rqiReport.exportFailed'))
    } finally {
      setExporting(null)
    }
  }, [])

  // ── 列定义 ──────────────────────────────────────────────────
  const batchColumns = useMemo<TableColumnsType<RqiReportBatch>>(
    () => [
      {
        title: t('rqiReport.col.batchNo'),
        dataIndex: 'id',
        key: 'id',
        width: 150,
        ellipsis: true,
        render: (v: string) => (
          <span style={{ fontFamily: 'monospace', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
            {v}
          </span>
        ),
      },
      {
        title: t('rqiReport.col.period'),
        dataIndex: 'periodLabel',
        key: 'periodLabel',
        width: 120,
        render: (v: string, r) => (
          <Space direction="vertical" size={0}>
            <span style={{ fontWeight: 600 }}>{v}</span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              {t(`rqiReport.granularity.${r.granularity}`)}
            </span>
          </Space>
        ),
      },
      {
        title: t('rqiReport.col.status'),
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (s: ReportBatchStatus) => <Tag color={STATUS_TAG[s]}>{statusLabel(s)}</Tag>,
      },
      {
        title: t('rqiReport.col.indicatorCount'),
        key: 'indicatorCount',
        width: 90,
        align: 'center',
        render: (_, r) => r.indicators?.length ?? 0,
      },
      {
        title: t('rqiReport.col.createdAt'),
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 150,
        render: (v: string) => formatDateTime(v),
      },
      {
        title: t('rqiReport.col.submittedAt'),
        dataIndex: 'submittedAt',
        key: 'submittedAt',
        width: 150,
        render: (v: string | null) => (v ? formatDateTime(v) : t('rqiReport.dash')),
      },
      {
        title: t('rqiReport.col.receiptNo'),
        dataIndex: 'receiptNo',
        key: 'receiptNo',
        width: 130,
        render: (v: string | null) => v ?? t('rqiReport.dash'),
      },
      {
        title: t('rqiReport.col.actions'),
        key: 'actions',
        width: 340,
        fixed: 'right',
        render: (_, r) => (
          <Space size={4} wrap>
            <ActionButton
              action="edit"
              size="compact"
              variant="text"
              icon={<Eye size={14} />}
              onClick={() => void openDetail(r)}
            >
              {t('rqiReport.action.detail')}
            </ActionButton>
            {r.status === 'DRAFT' && (
              <ActionButton
                action="submit"
                size="compact"
                loading={actingId === r.id}
                onClick={() => void handleSubmit(r)}
              >
                {t('rqiReport.action.submit')}
              </ActionButton>
            )}
            {r.status === 'SUBMITTED' && (
              <ActionButton
                action="submit"
                size="compact"
                icon={<CheckCircle2 size={14} />}
                onClick={() => openAccept(r)}
              >
                {t('rqiReport.action.accept')}
              </ActionButton>
            )}
            {r.status === 'SUBMITTED' && (
              <ActionButton
                action="delete"
                size="compact"
                variant="danger"
                icon={<XCircle size={14} />}
                onClick={() => openReject(r)}
              >
                {t('rqiReport.action.reject')}
              </ActionButton>
            )}
            {r.status === 'REJECTED' && (
              <ActionButton
                action="refresh"
                size="compact"
                icon={<RotateCcw size={14} />}
                loading={actingId === r.id}
                onClick={() => void handleReopen(r)}
              >
                {t('rqiReport.action.reopen')}
              </ActionButton>
            )}
            <ActionButton
              action="export"
              size="compact"
              variant="text"
              icon={<Download size={14} />}
              loading={exporting === `${r.id}:csv`}
              onClick={() => void handleExport(r, 'csv')}
            >
              {t('rqiReport.action.exportCsv')}
            </ActionButton>
            <ActionButton
              action="export"
              size="compact"
              variant="text"
              icon={<Download size={14} />}
              loading={exporting === `${r.id}:json`}
              onClick={() => void handleExport(r, 'json')}
            >
              {t('rqiReport.action.exportJson')}
            </ActionButton>
          </Space>
        ),
      },
    ],
    [actingId, exporting, openAccept, openDetail, openReject, handleSubmit, handleReopen, handleExport],
  )

  const historyColumns = useMemo<TableColumnsType<ReportHistoryItem>>(
    () => [
      {
        title: t('rqiReport.history.col.period'),
        dataIndex: 'periodLabel',
        key: 'periodLabel',
        width: 130,
        render: (v: string, r) => (
          <Space direction="vertical" size={0}>
            <span style={{ fontWeight: 600 }}>{v}</span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              {t(`rqiReport.granularity.${r.granularity}`)}
            </span>
          </Space>
        ),
      },
      {
        title: t('rqiReport.history.col.status'),
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (s: ReportBatchStatus) => <Tag color={STATUS_TAG[s]}>{statusLabel(s)}</Tag>,
      },
      {
        title: t('rqiReport.history.col.submittedAt'),
        dataIndex: 'submittedAt',
        key: 'submittedAt',
        width: 150,
        render: (v: string | null) => (v ? formatDateTime(v) : t('rqiReport.dash')),
      },
      {
        title: t('rqiReport.history.col.receiptNo'),
        dataIndex: 'receiptNo',
        key: 'receiptNo',
        width: 140,
        render: (v: string | null) => v ?? t('rqiReport.dash'),
      },
      {
        title: t('rqiReport.history.col.receiptAt'),
        dataIndex: 'receiptAt',
        key: 'receiptAt',
        width: 150,
        render: (v: string | null) => (v ? formatDateTime(v) : t('rqiReport.dash')),
      },
      {
        title: t('rqiReport.history.col.remark'),
        key: 'remark',
        ellipsis: true,
        render: (_, r) => r.remark ?? r.rejectReason ?? t('rqiReport.dash'),
      },
    ],
    [],
  )

  const indicatorColumns = useMemo<TableColumnsType<RqiReportIndicatorEntry>>(
    () => [
      {
        title: t('rqiReport.detail.col.code'),
        dataIndex: 'code',
        key: 'code',
        width: 120,
        render: (v: string) => (
          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>
        ),
      },
      { title: t('rqiReport.detail.col.name'), dataIndex: 'name', key: 'name', ellipsis: true },
      {
        title: t('rqiReport.detail.col.rate'),
        key: 'rate',
        width: 100,
        align: 'right',
        render: (_, r) => `${r.rate}${r.unit}`,
      },
      {
        title: t('rqiReport.detail.col.numerator'),
        dataIndex: 'numerator',
        key: 'numerator',
        width: 80,
        align: 'right',
      },
      {
        title: t('rqiReport.detail.col.denominator'),
        dataIndex: 'denominator',
        key: 'denominator',
        width: 80,
        align: 'right',
      },
      {
        title: t('rqiReport.detail.col.target'),
        key: 'target',
        width: 90,
        align: 'right',
        render: (_, r) => `${r.target}${r.unit}`,
      },
      {
        title: t('rqiReport.detail.col.status'),
        dataIndex: 'status',
        key: 'status',
        width: 90,
        render: (s: RqiIndicatorStatus) => (
          <Tag color={INDICATOR_STATUS_TAG[s]}>{t(`rqi2024.status.${s}`)}</Tag>
        ),
      },
    ],
    [],
  )

  const sourceBadge = stats ? (
    <Tag
      icon={stats.source === 'memory' ? <Database size={12} /> : <HardDrive size={12} />}
      color={stats.source === 'memory' ? 'green' : 'orange'}
    >
      {t(`rqiReport.source.${stats.source}`)}
    </Tag>
  ) : null

  const batchEmpty = !listLoading && !listError && batches.length === 0
  const historyEmpty = !historyLoading && !historyError && history.length === 0

  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader
        icon={<Activity size={20} color="#2563eb" />}
        title={t('rqiReport.title')}
        subtitle={t('rqiReport.subtitle')}
        actions={
          <Space wrap>
            {sourceBadge}
            <ActionButton
              action="create"
              size="compact"
              icon={<Plus size={14} />}
              onClick={openCreate}
            >
              {t('rqiReport.createBatch')}
            </ActionButton>
            <ActionButton
              action="refresh"
              size="compact"
              icon={<RefreshCw size={14} />}
              loading={statsLoading || listLoading}
              onClick={() => void reload()}
            >
              {t('rqiReport.refresh')}
            </ActionButton>
          </Space>
        }
      />

      <div style={{ padding: 24 }}>
        {/* 统计卡 */}
        <StatCardGrid gap={12} minWidth={180} style={{ marginBottom: 16 }}>
          <StatCard
            title={t('rqiReport.stat.total')}
            value={stats?.total ?? 0}
            icon={<ClipboardCheck size={18} />}
            color="primary"
            loading={statsLoading}
            sub={
              stats?.latest
                ? t('rqiReport.stat.latest', { period: stats.latest.periodLabel })
                : t('rqiReport.stat.noLatest')
            }
          />
          <StatCard
            title={t('rqiReport.stat.draft')}
            value={stats?.draftCount ?? 0}
            icon={<FileText size={18} />}
            color="info"
            loading={statsLoading}
          />
          <StatCard
            title={t('rqiReport.stat.submitted')}
            value={stats?.submittedCount ?? 0}
            icon={<Send size={18} />}
            color="warning"
            loading={statsLoading}
          />
          <StatCard
            title={t('rqiReport.stat.accepted')}
            value={stats?.acceptedCount ?? 0}
            icon={<CheckCircle2 size={18} />}
            color="success"
            loading={statsLoading}
          />
          <StatCard
            title={t('rqiReport.stat.rejected')}
            value={stats?.rejectedCount ?? 0}
            icon={<XCircle size={18} />}
            color="error"
            loading={statsLoading}
          />
          <StatCard
            title={t('rqiReport.stat.onTimeRate')}
            value={stats?.onTimeRate ?? 0}
            suffix="%"
            icon={<Clock size={18} />}
            color="primary"
            loading={statsLoading}
            sub={`${stats?.onTimeCount ?? 0} / ${stats?.reportableCount ?? 0}`}
          />
        </StatCardGrid>

        {/* Tab: 批次列表 / 上报历史 */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'batches',
              label: (
                <span>
                  <ListChecks size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />
                  {t('rqiReport.tab.batches')}
                </span>
              ),
              children: (
                <div>
                  <div style={{ marginBottom: 12 }}>
                    <Space size={8}>
                      <span style={{ fontSize: 13, color: '#64748b' }}>
                        {t('rqiReport.filter.status')}
                      </span>
                      <Select
                        size="small"
                        style={{ width: 150 }}
                        value={statusFilter}
                        onChange={(v) => {
                          setStatusFilter(v as ReportBatchStatus | 'ALL')
                          setPage(1)
                        }}
                        options={statusOptions}
                      />
                    </Space>
                  </div>
                  <StateView
                    loading={listLoading}
                    error={listError}
                    empty={batchEmpty}
                    onRetry={() => void loadBatches()}
                    retryText={t('rqiReport.retry')}
                    emptyDescription={t('rqiReport.empty')}
                    minHeight={280}
                  >
                    <DataTable<RqiReportBatch>
                      rowKey="id"
                      columns={batchColumns}
                      dataSource={batches}
                      pageSize={pageSize}
                      emptyText={t('rqiReport.empty')}
                      scroll={{ x: 'max-content' }}
                      pagination={{
                        current: page,
                        pageSize,
                        total: listTotal,
                        onChange: (p, ps) => {
                          setPage(p)
                          setPageSize(ps)
                        },
                      }}
                    />
                  </StateView>
                </div>
              ),
            },
            {
              key: 'history',
              label: (
                <span>
                  <Clock size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />
                  {t('rqiReport.tab.history')}
                </span>
              ),
              children: (
                <StateView
                  loading={historyLoading}
                  error={historyError}
                  empty={historyEmpty}
                  onRetry={() => void loadHistory()}
                  retryText={t('rqiReport.retry')}
                  emptyDescription={t('rqiReport.history.empty')}
                  minHeight={280}
                >
                  <DataTable<ReportHistoryItem>
                    rowKey="id"
                    columns={historyColumns}
                    dataSource={history}
                    pageSize={HISTORY_PAGE_SIZE}
                    emptyText={t('rqiReport.history.empty')}
                    scroll={{ x: 'max-content' }}
                    pagination={{
                      current: historyPage,
                      pageSize: HISTORY_PAGE_SIZE,
                      total: historyTotal,
                      onChange: (p) => setHistoryPage(p),
                    }}
                  />
                </StateView>
              ),
            },
          ]}
        />
      </div>

      {/* 新建上报批次 Modal */}
      <AppModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('rqiReport.createTitle')}
        subtitle={t('rqiReport.createSubtitle')}
        icon={<Plus size={18} />}
        iconBg="#e0edff"
        iconColor="#2563eb"
        size="md"
        onOk={() => void handleCreate()}
        confirmText={t('rqiReport.create')}
        cancelText={t('rqiReport.cancel')}
        okLoading={creating}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <FormField label={t('rqiReport.periodType')} required labelWidth={90}>
            <Space size={6} wrap>
              {REPORT_PERIODS.map((g) => (
                <ActionButton
                  key={g}
                  action="edit"
                  size="compact"
                  icon={<Calendar size={14} />}
                  variant={granularity === g ? 'primary' : 'default'}
                  onClick={() => setGranularity(g)}
                >
                  {t(`rqiReport.granularity.${g}`)}
                </ActionButton>
              ))}
            </Space>
          </FormField>
          <FormField label={t('rqiReport.period')} required labelWidth={90}>
            <Select
              style={{ width: '100%' }}
              value={period}
              onChange={setPeriod}
              options={periodOptions.map((p) => ({ value: p, label: p }))}
            />
          </FormField>
          <FormField label={t('rqiReport.createdBy')} required labelWidth={90}>
            <Input
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
              placeholder={t('rqiReport.createdByPlaceholder')}
            />
          </FormField>
        </Space>
      </AppModal>

      {/* 批次详情 Drawer */}
      <Drawer
        title={t('rqiReport.detail.title')}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={820}
      >
        {detailLoading && !detailBatch ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
            {t('rqiReport.loading')}
          </div>
        ) : detailBatch ? (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 10,
                marginBottom: 16,
              }}
            >
              <InfoItem label={t('rqiReport.detail.periodLabel')} value={detailBatch.periodLabel} />
              <InfoItem
                label={t('rqiReport.detail.status')}
                value={<Tag color={STATUS_TAG[detailBatch.status]}>{statusLabel(detailBatch.status)}</Tag>}
              />
              <InfoItem label={t('rqiReport.detail.createdBy')} value={detailBatch.createdBy} />
              <InfoItem
                label={t('rqiReport.detail.createdAt')}
                value={formatDateTime(detailBatch.createdAt)}
              />
              <InfoItem
                label={t('rqiReport.detail.submittedAt')}
                value={formatDateTime(detailBatch.submittedAt)}
              />
              <InfoItem
                label={t('rqiReport.detail.receiptAt')}
                value={formatDateTime(detailBatch.receiptAt)}
              />
              <InfoItem
                label={t('rqiReport.detail.receiptNo')}
                value={detailBatch.receiptNo ?? t('rqiReport.dash')}
              />
              <InfoItem
                label={t('rqiReport.detail.dateRange')}
                value={`${detailBatch.dateFrom} ~ ${detailBatch.dateTo}`}
              />
              <InfoItem label={t('rqiReport.detail.fileName')} value={detailBatch.fileName} />
              <InfoItem
                label={t('rqiReport.detail.contentHash')}
                value={detailBatch.contentHash}
              />
              {detailBatch.rejectReason && (
                <InfoItem
                  label={t('rqiReport.detail.rejectReason')}
                  value={detailBatch.rejectReason}
                />
              )}
              {detailBatch.remark && (
                <InfoItem label={t('rqiReport.detail.remark')} value={detailBatch.remark} />
              )}
            </div>

            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
              {t('rqiReport.detail.indicators')}
            </div>
            <DataTable<RqiReportIndicatorEntry>
              rowKey="code"
              columns={indicatorColumns}
              dataSource={detailBatch.indicators}
              pageSize={10}
              emptyText={t('rqiReport.detail.empty')}
              scroll={{ x: 'max-content' }}
            />
          </div>
        ) : (
          <EmptyState type="nodata" description={t('rqiReport.detail.empty')} />
        )}
      </Drawer>

      {/* 接受回执 Modal */}
      <AppModal
        open={Boolean(acceptTarget)}
        onClose={() => setAcceptTarget(null)}
        title={t('rqiReport.acceptTitle')}
        subtitle={acceptTarget?.periodLabel}
        icon={<CheckCircle2 size={18} />}
        iconBg="#dcfce7"
        iconColor="#16a34a"
        size="sm"
        onOk={() => void handleAccept()}
        confirmText={t('rqiReport.action.accept')}
        cancelText={t('rqiReport.cancel')}
        okLoading={accepting}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <FormField label={t('rqiReport.acceptReceiptNo')} required>
            <Input
              value={receiptNo}
              onChange={(e) => setReceiptNo(e.target.value)}
              placeholder={t('rqiReport.acceptReceiptNo')}
            />
          </FormField>
          <FormField label={t('rqiReport.acceptRemark')}>
            <Input.TextArea
              rows={2}
              value={acceptRemark}
              onChange={(e) => setAcceptRemark(e.target.value)}
            />
          </FormField>
        </Space>
      </AppModal>

      {/* 驳回回执 Modal */}
      <AppModal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title={t('rqiReport.rejectTitle')}
        subtitle={rejectTarget?.periodLabel}
        icon={<XCircle size={18} />}
        iconBg="#fee2e2"
        iconColor="#dc2626"
        size="sm"
        onOk={() => void handleReject()}
        confirmText={t('rqiReport.action.reject')}
        cancelText={t('rqiReport.cancel')}
        okLoading={rejecting}
        danger
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <FormField label={t('rqiReport.rejectReason')} required>
            <Input.TextArea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('rqiReport.rejectReason')}
            />
          </FormField>
          <FormField label={t('rqiReport.rejectRemark')}>
            <Input.TextArea
              rows={2}
              value={rejectRemark}
              onChange={(e) => setRejectRemark(e.target.value)}
            />
          </FormField>
        </Space>
      </AppModal>
    </PageContainer>
  )
}

/** 批次详情字段 (label / value 对) */
function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text-primary, #0f172a)', wordBreak: 'break-all' }}>
        {value}
      </div>
    </div>
  )
}
