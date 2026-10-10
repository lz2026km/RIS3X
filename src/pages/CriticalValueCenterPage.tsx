/**
 * @deprecated [v3.0.6.11-104 Wave 5B] 危急值多入口收敛: 本页面已内嵌为 `/critical-value` 的 "危急值中心" Tab。
 * 旧路由 `/critical-value-center` 保留 redirect → `/critical-value?tab=center`。请勿新增直接引用。
 */
// ============================================================
// G005 放射科RIS系统 v3.0.5.0 - 危急值中心 R3
// 路由 /critical-value-center - 危急值统一入口
// 聚合 CriticalValuePage / CriticalValueRulePage / CriticalValueStatsPage
// [W2-A] listCenter 中心列表 / autoDetect 自动检测 / closeLoop 闭环
// ============================================================

import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { AlertOctagon, Bell, BarChart3, Settings, Activity, TrendingUp, ShieldAlert, Save, Plus, Edit3, Trash2, RefreshCw, ScanSearch, CheckCircle2, Eye } from 'lucide-react'
import { message, Switch, Modal, Input, Select, Popconfirm } from 'antd'
import { CRITICAL_RULES } from '../data/criticalValueMock'
import { DataTable } from '../components/common'
import { criticalApi, type CriticalStatsDto } from '../services/api/criticalApi'
import { criticalExtApi, type CriticalChannelDto, type CriticalExtRuleDto, type CriticalExtTimelineDto, type CriticalExtCenterDto } from '../services/api'
import { invalidateApiCache } from '../services/api/client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { ChartContainer, chartDefaults } from '../components/charts'
import { t } from '../i18n/appI18n'

// [W2-A] 列表双形状归一化: MSW 裸数组 / 后端 { items, total }
function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.items)) return obj.items as T[]
    if (Array.isArray(obj.timeline)) return obj.timeline as T[]
  }
  return []
}

const SEVERITY_OPTIONS = ['CRITICAL', 'URGENT', 'HIGH', 'MEDIUM', 'LOW']

// [W2-A] 中心列表状态/严重度徽标
function centerStatusBadge(status: string) {
  const s = String(status ?? '').toUpperCase()
  if (['CLOSED_LOOP', 'RESOLVED', 'CLOSED'].includes(s)) return 'bg-green-100 text-green-700'
  if (['PENDING', 'DISCOVERED'].includes(s)) return 'bg-red-100 text-red-700'
  if (['ACKNOWLEDGED', 'RECEIPTED'].includes(s)) return 'bg-blue-100 text-blue-700'
  if (['NOTIFIED', 'VOICE_CALLED'].includes(s)) return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-600'
}

function severityBadge(severity: string) {
  const s = String(severity ?? '').toUpperCase()
  if (s.includes('CRITICAL') || severity === '危急' || severity === '危及生命') return 'bg-red-100 text-red-700'
  if (s.includes('URGENT') || s.includes('HIGH')) return 'bg-orange-100 text-orange-700'
  return 'bg-amber-100 text-amber-700'
}

const fmtDateTime = (v: unknown) => String(v ?? '').replace('T', ' ').slice(0, 19)

const CriticalValueCenterPage: React.FC = () => {
  const [stats, setStats] = useState<CriticalStatsDto | null>(null)
  const [rulesCount, setRulesCount] = useState(CRITICAL_RULES.length)
  // [W5] 通知通道开关配置
  const [channels, setChannels] = useState<CriticalChannelDto[]>([])
  const [savingChannels, setSavingChannels] = useState(false)
  // [W2-A] 规则完整 CRUD (createRule/updateRule/deleteRule)
  const [rules, setRules] = useState<CriticalExtRuleDto[]>([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [ruleModal, setRuleModal] = useState<{ open: boolean; editing: CriticalExtRuleDto | null }>({ open: false, editing: null })
  const [ruleForm, setRuleForm] = useState({ name: '', condition: '', action: '', severity: 'HIGH', enabled: true })
  const [ruleSaving, setRuleSaving] = useState(false)
  // [W2-A] 统计: getSummary / getTimeline
  const [summary, setSummary] = useState<{ todayCount?: number; weeklyCount?: number; monthlyCount?: number; avgResponseTime?: number } | null>(null)
  const [timeline, setTimeline] = useState<CriticalExtTimelineDto[]>([])
  // [G005 W1-C] 统计卡: criticalExtApi.getStats() → { total, byState, bySeverity } (后端 critical-ext.controller)
  const [extCards, setExtCards] = useState<{ pending: number; notified: number; resolved: number; escalated: number } | null>(null)
  // [W2-A] 中心列表 listCenter / 自动检测 autoDetect / 闭环 closeLoop
  const [center, setCenter] = useState<CriticalExtCenterDto[]>([])
  const [centerLoading, setCenterLoading] = useState(false)
  const [centerError, setCenterError] = useState('')
  const [detectModalOpen, setDetectModalOpen] = useState(false)
  const [detectForm, setDetectForm] = useState({ examId: '', reportContent: '' })
  const [detecting, setDetecting] = useState(false)
  const [closeTarget, setCloseTarget] = useState<CriticalExtCenterDto | null>(null)
  const [closeForm, setCloseForm] = useState({ resolution: '', resolvedBy: '' })
  const [closing, setClosing] = useState(false)
  // [G005 W1-C] 中心详情: getCenterItem (GET /critical-ext/center/:id)
  const [detailTarget, setDetailTarget] = useState<CriticalExtCenterDto | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  // [G005 W1-C] 中心详情查看 (后端 getCriticalCenterItem)
  const handleViewDetail = async (c: CriticalExtCenterDto) => {
    setDetailTarget(c)
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const res = await criticalExtApi.getCenterItem(c.id)
      if (res.success && res.data) setDetailTarget(res.data as CriticalExtCenterDto)
      else if (res.success) setDetailTarget(c)
    } catch {
      setDetailTarget(c)
    } finally {
      setDetailLoading(false)
    }
  }

  // [W2-A] GET /critical-ext/center
  const loadCenter = useCallback(async () => {
    setCenterLoading(true)
    setCenterError('')
    try {
      const res = await criticalExtApi.listCenter()
      if (res.success) setCenter(asList<CriticalExtCenterDto>(res.data))
      else setCenterError(res.error?.message ?? t('criticalCenter.centerLoadFailed'))
    } catch (e) {
      setCenterError((e as Error)?.message ?? t('criticalCenter.centerLoadFailed'))
    } finally {
      setCenterLoading(false)
    }
  }, [])

  // [W2-A] POST /critical-ext/auto-detect (对齐后端 AutoDetectCriticalSchema)
  const handleAutoDetect = async () => {
    if (!detectForm.examId.trim() || !detectForm.reportContent.trim()) {
      message.warning(t('criticalCenter.examIdAndContentRequired'))
      return
    }
    setDetecting(true)
    try {
      const res = await criticalExtApi.autoDetect({ examId: detectForm.examId.trim(), reportContent: detectForm.reportContent.trim() })
      if (res.success) {
        message.success(`自动检测已触发 (${res.data?.id ?? detectForm.examId})`)
        setDetectModalOpen(false)
        setDetectForm({ examId: '', reportContent: '' })
        await invalidateApiCache('/critical-ext/center')
        await loadCenter()
      } else {
        message.error(res.error?.message ?? t('criticalCenter.autoDetectFailed'))
      }
    } catch {
      message.error(t('criticalCenter.autoDetectFailed'))
    }
    setDetecting(false)
  }

  // [W2-A] POST /critical-ext/close-loop (对齐后端 CloseCriticalLoopSchema)
  const handleCloseLoop = async () => {
    if (!closeTarget) return
    if (!closeForm.resolution.trim()) {
      message.warning(t('criticalCenter.resolutionRequired'))
      return
    }
    setClosing(true)
    try {
      const res = await criticalExtApi.closeLoop({
        criticalId: closeTarget.id,
        resolution: closeForm.resolution.trim(),
        resolvedBy: closeForm.resolvedBy.trim() || 'current-user',
      })
      if (res.success) {
        message.success(`危急值 ${closeTarget.id} 已闭环`)
        setCloseTarget(null)
        setCloseForm({ resolution: '', resolvedBy: '' })
        await invalidateApiCache('/critical-ext/center')
        await loadCenter()
      } else {
        message.error(res.error?.message ?? t('criticalCenter.closeLoopFailed'))
      }
    } catch {
      message.error(t('criticalCenter.closeLoopFailed'))
    }
    setClosing(false)
  }

  const loadRules = useCallback(async () => {
    setRulesLoading(true)
    try {
      const res = await criticalExtApi.listRules()
      if (res.success) {
        const items = asList<CriticalExtRuleDto>(res.data)
        setRules(items)
        setRulesCount(items.length)
      }
    } catch { /* 保持 mock 兜底 */ }
    setRulesLoading(false)
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const [summaryRes, timelineRes, statsRes] = await Promise.all([
        criticalExtApi.getSummary(),
        criticalExtApi.getTimeline(),
        // [G005 W1-C] 统计卡补接: 后端返回 { total, byState: [{state,_count}], bySeverity }
        criticalExtApi.getStats(),
      ])
      if (statsRes.success && statsRes.data) {
        const raw = statsRes.data as unknown as Record<string, unknown>
        const byState = Array.isArray(raw.byState) ? (raw.byState as Array<{ state?: string; _count?: { id?: number } }>) : []
        const countOf = (states: string[]) => byState
          .filter((b) => b.state && states.includes(String(b.state).toUpperCase()))
          .reduce((s, b) => s + Number(b._count?.id ?? 0), 0)
        setExtCards({
          pending: countOf(['PENDING', 'DISCOVERED']),
          notified: countOf(['NOTIFIED', 'VOICE_CALLED']),
          resolved: countOf(['RESOLVED', 'CLOSED_LOOP', 'CLOSED', 'ACKNOWLEDGED', 'RECEIPTED']),
          escalated: countOf(['ESCALATED']),
        })
      }
      if (summaryRes.success && summaryRes.data && typeof summaryRes.data === 'object') {
        const s = summaryRes.data as unknown as Record<string, unknown>
        if (s.items) {
          // 后端形状 { items, total } → 本周/本月按时间窗粗算兜底
          const items = asList<Record<string, unknown>>(s.items)
          const now = new Date()
          const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay())
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
          setSummary({
            weeklyCount: items.filter((i) => new Date(String(i.triggeredAt ?? i.createdAt ?? '')).getTime() >= startOfWeek.getTime()).length,
            monthlyCount: items.filter((i) => new Date(String(i.triggeredAt ?? i.createdAt ?? '')).getTime() >= startOfMonth.getTime()).length,
          })
        } else {
          setSummary({
            todayCount: typeof s.todayCount === 'number' ? s.todayCount : undefined,
            weeklyCount: typeof s.weeklyCount === 'number' ? s.weeklyCount : undefined,
            monthlyCount: typeof s.monthlyCount === 'number' ? s.monthlyCount : undefined,
            avgResponseTime: typeof s.avgResponseTime === 'number' ? s.avgResponseTime : undefined,
          })
        }
      }
      if (timelineRes.success) {
        const items = asList<CriticalExtTimelineDto>(timelineRes.data)
        setTimeline(items.map((t) => {
          const raw = t as CriticalExtTimelineDto & Record<string, unknown>
          return {
            date: String(raw.time ?? raw.date ?? ''),
            count: Number(raw.count ?? 0),
            resolved: Number(raw.resolved ?? 0),
            escalated: Number(raw.escalated ?? 0),
          }
        }).filter((t) => t.date))
      }
    } catch { /* 统计不可用时保持空态 */ }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [statsRes, rulesRes] = await Promise.all([
          criticalApi.getStats(),
          criticalExtApi.listRules(),
        ])
        if (cancelled) return
        if (statsRes.success && statsRes.data) setStats(statsRes.data)
        // [G005 P1] 列表双形状兼容: MSW 裸数组 / 后端 { items, total }
        const rules = Array.isArray(rulesRes.data) ? rulesRes.data : (rulesRes.data?.items ?? [])
        if (rulesRes.success) { setRules(rules as CriticalExtRuleDto[]); setRulesCount(rules.length) }
      } catch {
        // 保持 mock 常量兜底
      }
    })()
    void (async () => {
      try {
        const res = await criticalExtApi.getChannels()
        if (cancelled || !res.success) return
        const items = Array.isArray(res.data) ? res.data : (res.data?.items ?? [])
        setChannels(items)
      } catch { /* 通道配置加载失败时保持空态 */ }
    })()
    void loadStats()
    void loadCenter()
    return () => { cancelled = true }
  }, [loadStats, loadCenter])

  // [W2-A] 规则保存: 新增 createRule / 编辑 updateRule
  const handleSaveRule = async () => {
    if (!ruleForm.name.trim() || !ruleForm.condition.trim()) {
      message.warning(t('criticalCenter.ruleNameAndConditionRequired'))
      return
    }
    setRuleSaving(true)
    try {
      const payload = { name: ruleForm.name.trim(), condition: ruleForm.condition.trim(), action: ruleForm.action.trim(), severity: ruleForm.severity, enabled: ruleForm.enabled }
      const res = ruleModal.editing
        ? await criticalExtApi.updateRule(ruleModal.editing.id, payload)
        : await criticalExtApi.createRule(payload)
      if (res.success) {
        message.success(ruleModal.editing ? t('criticalCenter.ruleUpdated') : t('criticalCenter.ruleCreated'))
        setRuleModal({ open: false, editing: null })
        // [W2-A] 失效 GET 缓存 (api client 内存缓存 60s), 确保列表刷新
        await invalidateApiCache('/critical-ext/rules')
        await loadRules()
      } else {
        message.error(res.error?.message ?? t('criticalCenter.saveFailed'))
      }
    } catch {
      message.error(t('criticalCenter.saveRuleFailed'))
    }
    setRuleSaving(false)
  }

  // [W2-A] 规则删除
  const handleDeleteRule = async (rule: CriticalExtRuleDto) => {
    try {
      const res = await criticalExtApi.deleteRule(rule.id)
      if (res.success) {
        message.success(t('criticalCenter.ruleDeleted'))
        await invalidateApiCache('/critical-ext/rules')
        await loadRules()
      } else {
        message.error(res.error?.message ?? t('criticalCenter.deleteFailed'))
      }
    } catch {
      message.error(t('criticalCenter.deleteRuleFailed'))
    }
  }

  // [W5] 保存通知通道开关 → PUT /critical-ext/channels (落库 critical_channel_*)
  const handleSaveChannels = async () => {
    setSavingChannels(true)
    try {
      const res = await criticalExtApi.saveChannels(channels)
      if (res.success) {
        const items = Array.isArray(res.data) ? res.data : (res.data?.items ?? [])
        setChannels(items)
        message.success(t('criticalCenter.channelsSaved'))
      } else {
        message.error(res.error?.message || t('criticalCenter.saveChannelsFailed'))
      }
    } catch {
      message.error(t('criticalCenter.saveChannelsFailed'))
    }
    setSavingChannels(false)
  }

  const toggleChannel = (channel: string, enabled: boolean) => {
    setChannels(prev => prev.map(c => (c.channel === channel ? { ...c, enabled } : c)))
  }

  const pending = extCards?.pending ?? stats?.pending ?? 0
  const notified = extCards?.notified ?? stats?.notified ?? 0
  const resolved = extCards?.resolved ?? stats?.resolved ?? 0
  const escalated = extCards?.escalated ?? stats?.escalated ?? 0

  return (
    <div className="p-6 space-y-4" data-testid="critical-value-center-page">
      <div className="flex items-center gap-2">
        <ShieldAlert className="text-red-600" size={28} />
        <h1 className="text-2xl font-bold">{t('criticalCenter.title')}</h1>
      </div>
      <p className="text-gray-600">{t('criticalCenter.subtitle')}</p>

      <div className="grid grid-cols-4 gap-4">
        <Link to="/critical-value" className="rounded-lg border bg-card p-4 hover:shadow-md transition">
          <AlertOctagon className="text-red-600 mb-2" size={24} />
          <div className="text-sm text-gray-500">{t('criticalCenter.pending')}</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{pending}</div>
          <div className="text-xs text-gray-400 mt-1">{t('criticalCenter.toManagement')}</div>
        </Link>
        <Link to="/critical-value" className="rounded-lg border bg-card p-4 hover:shadow-md transition">
          <Bell className="text-amber-600 mb-2" size={24} />
          <div className="text-sm text-gray-500">{t('criticalCenter.notified')}</div>
          <div className="text-2xl font-bold mt-1 text-amber-600">{notified}</div>
          <div className="text-xs text-gray-400 mt-1">{t('criticalCenter.toNotifyStatus')}</div>
        </Link>
        <Link to="/critical-value" className="rounded-lg border bg-card p-4 hover:shadow-md transition">
          <Activity className="text-blue-600 mb-2" size={24} />
          <div className="text-sm text-gray-500">{t('criticalCenter.closed')}</div>
          <div className="text-2xl font-bold mt-1 text-green-600">{resolved}</div>
          <div className="text-xs text-gray-400 mt-1">{t('criticalCenter.toClosedTrend')}</div>
        </Link>
        <Link to="/critical-value" className="rounded-lg border bg-card p-4 hover:shadow-md transition">
          <TrendingUp className="text-orange-600 mb-2" size={24} />
          <div className="text-sm text-gray-500">{t('criticalCenter.overdue')}</div>
          <div className="text-2xl font-bold mt-1 text-orange-600">{escalated}</div>
          <div className="text-xs text-gray-400 mt-1">{t('criticalCenter.toEscalation')}</div>
        </Link>
      </div>

      {/* [W2-A] 汇总统计: getSummary 卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-gray-500">{t('criticalCenter.todayCount')}</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{summary?.todayCount ?? stats?.todayCount ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-gray-500">{t('criticalCenter.weeklyCount')}</div>
          <div className="text-2xl font-bold mt-1 text-amber-600">{summary?.weeklyCount ?? '-'}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-gray-500">{t('criticalCenter.monthlyCount')}</div>
          <div className="text-2xl font-bold mt-1 text-blue-600">{summary?.monthlyCount ?? '-'}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-gray-500">{t('criticalCenter.avgResponse')}</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">{summary?.avgResponseTime ?? '-'}</div>
        </div>
      </div>

      {/* [W2-A] 危急值中心列表: listCenter + 自动检测 autoDetect + 闭环 closeLoop */}
      <div className="rounded-lg border bg-card p-4" data-testid="critical-center-list">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <AlertOctagon size={16} className="text-red-600" /> {t('criticalCenter.centerListTitle')} ({center.length})
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setDetectModalOpen(true)}
              className="inline-flex items-center gap-1 rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              <ScanSearch size={12} /> {t('criticalCenter.autoDetect')}
            </button>
            <button
              onClick={() => void loadCenter()}
              disabled={centerLoading}
              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-card px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={12} /> {centerLoading ? t('criticalCenter.loading') : t('criticalCenter.refresh')}
            </button>
          </div>
        </div>
        {centerError && <div className="text-xs text-red-600 mb-2">{centerError}</div>}
        {center.length > 0 ? (
          <DataTable
            dataSource={center}
            rowKey="id"
            pagination={false}
            columns={[
              { title: t('criticalCenter.colEventId'), dataIndex: 'id', render: (v: string) => <span className="font-mono text-xs text-slate-500">{v}</span> },
              { title: t('criticalCenter.colPatient'), dataIndex: 'patientName', render: (v: string) => <span className="font-medium text-slate-800">{v || '-'}</span> },
              { title: t('criticalCenter.colFinding'), dataIndex: 'finding', render: (v: string) => <span className="text-xs text-slate-600">{v || '-'}</span> },
              {
                title: t('criticalCenter.colSeverity'), dataIndex: 'severity',
                render: (v: string) => <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${severityBadge(v)}`}>{v || 'HIGH'}</span>,
              },
              {
                title: t('criticalCenter.colStatus'), key: 'status',
                render: (_: unknown, c: CriticalExtCenterDto) => {
                  const stateField = String((c as unknown as Record<string, unknown>).state ?? '')
                  const status = String(c.status ?? stateField ?? '').toUpperCase()
                  return <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${centerStatusBadge(status)}`}>{status || 'PENDING'}</span>
                },
              },
              { title: t('criticalCenter.colTriggeredAt'), dataIndex: 'triggeredAt', render: (v: unknown) => <span className="text-xs text-slate-600">{fmtDateTime(v)}</span> },
              { title: t('criticalCenter.colDepartment'), dataIndex: 'department', render: (v: string) => <span className="text-xs text-slate-600">{v || '-'}</span> },
              {
                title: t('criticalCenter.colActions'), key: 'actions',
                render: (_: unknown, c: CriticalExtCenterDto) => {
                  const stateField = String((c as unknown as Record<string, unknown>).state ?? '')
                  const status = String(c.status ?? stateField ?? '').toUpperCase()
                  const closed = ['CLOSED_LOOP', 'RESOLVED', 'CLOSED'].includes(status)
                  return (
                    <div className="flex gap-2">
                      <button
                        onClick={() => void handleViewDetail(c)}
                        className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                      >
                        <Eye size={11} /> {t('criticalCenter.detail')}
                      </button>
                      <button
                        onClick={() => { setCloseTarget(c); setCloseForm({ resolution: '', resolvedBy: '' }) }}
                        disabled={closed}
                        className="inline-flex items-center gap-1 rounded border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <CheckCircle2 size={11} /> {closed ? t('criticalCenter.closedState') : t('criticalCenter.closeLoop')}
                      </button>
                    </div>
                  )
                },
              },
            ]}
          />
        ) : (
          <div className="text-xs text-gray-400 py-3">
            {centerLoading ? t('criticalCenter.centerLoading') : t('criticalCenter.centerEmpty')}
          </div>
        )}
      </div>

      {/* [G005 W1-C] 中心详情 Modal: GET /critical-ext/center/:id (getCenterItem) */}
      <Modal
        title={`危急值详情 - ${detailTarget?.id ?? ''}`}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={520}
      >
        {detailLoading && <div className="text-xs text-gray-400 py-3">{t('criticalCenter.detailLoading')}</div>}
        {!detailLoading && detailTarget && (
          <div className="space-y-2 py-1 text-sm">
            {[
              [t('criticalCenter.colEventId'), detailTarget.id],
              [t('criticalCenter.colPatient'), detailTarget.patientName],
              [t('criticalCenter.colFinding'), detailTarget.finding],
              [t('criticalCenter.colSeverity'), detailTarget.severity],
              [t('criticalCenter.colStatus'), String((detailTarget as unknown as Record<string, unknown>).state ?? detailTarget.status ?? '')],
              [t('criticalCenter.colTriggeredAt'), fmtDateTime(detailTarget.triggeredAt)],
              [t('criticalCenter.colDepartment'), detailTarget.department],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <div className="w-20 flex-shrink-0 text-xs text-gray-500 pt-0.5">{k}</div>
                <div className="text-slate-800 break-all">{v || '-'}</div>
              </div>
            ))}
            {!!(detailTarget as unknown as Record<string, unknown>).closedBy && (
              <div className="flex gap-3">
                <div className="w-20 flex-shrink-0 text-xs text-gray-500 pt-0.5">{t('criticalCenter.closedBy')}</div>
                <div className="text-slate-800">{String((detailTarget as unknown as Record<string, unknown>).closedBy)}</div>
              </div>
            )}
            {!!(detailTarget as unknown as Record<string, unknown>).resolvedAt && (
              <div className="flex gap-3">
                <div className="w-20 flex-shrink-0 text-xs text-gray-500 pt-0.5">{t('criticalCenter.closedAt')}</div>
                <div className="text-slate-800">{fmtDateTime((detailTarget as unknown as Record<string, unknown>).resolvedAt)}</div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* [W2-A] 自动检测 Modal: POST /critical-ext/auto-detect */}
      <Modal
        title={t('criticalCenter.autoDetectTitle')}
        open={detectModalOpen}
        onOk={() => void handleAutoDetect()}
        onCancel={() => setDetectModalOpen(false)}
        confirmLoading={detecting}
        okText={t('criticalCenter.triggerDetect')}
        cancelText={t('criticalCenter.cancel')}
        width={480}
      >
        <div className="space-y-3 py-1">
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-600">{t('criticalCenter.examIdLabel')}</div>
            <Input
              value={detectForm.examId}
              onChange={(e) => setDetectForm((f) => ({ ...f, examId: e.target.value }))}
              placeholder={t('criticalCenter.examIdPlaceholder')}
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-600">{t('criticalCenter.reportContentLabel')}</div>
            <Input.TextArea
              rows={4}
              value={detectForm.reportContent}
              onChange={(e) => setDetectForm((f) => ({ ...f, reportContent: e.target.value }))}
              placeholder={t('criticalCenter.reportContentPlaceholder')}
            />
          </div>
        </div>
      </Modal>

      {/* [W2-A] 闭环 Modal: POST /critical-ext/close-loop */}
      <Modal
        title={`闭环危急值 - ${closeTarget?.id ?? ''}`}
        open={closeTarget !== null}
        onOk={() => void handleCloseLoop()}
        onCancel={() => setCloseTarget(null)}
        confirmLoading={closing}
        okText={t('criticalCenter.submitCloseLoop')}
        cancelText={t('criticalCenter.cancel')}
        width={480}
      >
        {closeTarget && (
          <div className="space-y-3 py-1">
            <div className="text-xs text-slate-500">
              {t('criticalCenter.patientLabel')} <strong className="text-slate-800">{closeTarget.patientName || '-'}</strong> · {t('criticalCenter.findingLabel')}{closeTarget.finding || '-'}」
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-600">{t('criticalCenter.resolutionLabel')}</div>
              <Input.TextArea
                rows={3}
                value={closeForm.resolution}
                onChange={(e) => setCloseForm((f) => ({ ...f, resolution: e.target.value }))}
                placeholder={t('criticalCenter.resolutionPlaceholder')}
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-600">{t('criticalCenter.resolvedByLabel')}</div>
              <Input
                value={closeForm.resolvedBy}
                onChange={(e) => setCloseForm((f) => ({ ...f, resolvedBy: e.target.value }))}
                placeholder={t('criticalCenter.resolvedByPlaceholder')}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* [W2-A] 趋势图: getTimeline */}
      {timeline.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">{t('criticalCenter.trendTitle')} ({timeline.length} {t('criticalCenter.daysUnit')})</h2>
            <button onClick={() => void loadStats()} className="inline-flex items-center gap-1 rounded border border-slate-300 bg-card px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
              <RefreshCw size={12} /> {t('criticalCenter.refresh')}
            </button>
          </div>
          <ChartContainer type="line" height={220}>
            <LineChart data={timeline} margin={chartDefaults.margin}>
              <CartesianGrid {...chartDefaults.grid} />
              <XAxis dataKey="date" {...chartDefaults.axis} />
              <YAxis allowDecimals={false} {...chartDefaults.axis} />
              <Tooltip {...chartDefaults.tooltip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="count" name={t('criticalCenter.legendTriggered')} stroke="var(--color-error-600)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="resolved" name={t('criticalCenter.legendResolved')} stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="escalated" name={t('criticalCenter.legendEscalated')} stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ChartContainer>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Link to="/critical-value" className="rounded-lg border bg-card p-5 hover:shadow-md transition flex items-start gap-3">
          <AlertOctagon className="text-red-600 flex-shrink-0" size={28} />
          <div>
            <h3 className="font-semibold">{t('criticalCenter.navManagement')}</h3>
            <p className="text-sm text-gray-500 mt-1">{t('criticalCenter.navManagementDesc')}</p>
          </div>
        </Link>
        <Link to="/critical-value-rule" className="rounded-lg border bg-card p-5 hover:shadow-md transition flex items-start gap-3">
          <Settings className="text-blue-600 flex-shrink-0" size={28} />
          <div>
            <h3 className="font-semibold">{t('criticalCenter.navRule')}</h3>
            <p className="text-sm text-gray-500 mt-1">{t('criticalCenter.navRuleDesc')}</p>
          </div>
        </Link>
        <Link to="/critical-value-stats" className="rounded-lg border bg-card p-5 hover:shadow-md transition flex items-start gap-3">
          <BarChart3 className="text-green-600 flex-shrink-0" size={28} />
          <div>
            <h3 className="font-semibold">{t('criticalCenter.navStats')}</h3>
            <p className="text-sm text-gray-500 mt-1">{t('criticalCenter.navStatsDesc')}</p>
          </div>
        </Link>
      </div>

      {/* [W2-A] 规则库完整 CRUD: listRules / createRule / updateRule / deleteRule */}
      <div className="rounded-lg border bg-card p-4" data-testid="critical-rule-crud">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">{t('criticalCenter.ruleLibraryTitle')} ({rulesCount} {t('criticalCenter.itemsUnit')})</h2>
          <div className="flex gap-2">
            <button
              onClick={() => { setRuleModal({ open: true, editing: null }); setRuleForm({ name: '', condition: '', action: '', severity: 'HIGH', enabled: true }) }}
              className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Plus size={12} /> {t('criticalCenter.addRule')}
            </button>
            <button onClick={() => void loadRules()} disabled={rulesLoading} className="inline-flex items-center gap-1 rounded border border-slate-300 bg-card px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw size={12} /> {rulesLoading ? t('criticalCenter.loading') : t('criticalCenter.refresh')}
            </button>
          </div>
        </div>
        {rules.length > 0 ? (
          <DataTable
            dataSource={rules}
            rowKey="id"
            pagination={false}
            columns={[
              { title: t('criticalCenter.colRuleName'), dataIndex: 'name', render: (v: string) => <span className="font-medium text-slate-800">{v}</span> },
              { title: t('criticalCenter.colCondition'), dataIndex: 'condition', render: (v: string) => <span className="font-mono text-xs text-slate-600">{v}</span> },
              { title: t('criticalCenter.colAction'), dataIndex: 'action', render: (v: string) => <span className="text-xs text-slate-600">{v || '-'}</span> },
              {
                title: t('criticalCenter.colSeverity'), dataIndex: 'severity',
                render: (v: string) => <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${String(v).includes('CRITICAL') ? 'bg-red-100 text-red-700' : String(v).includes('URGENT') ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>{v || 'HIGH'}</span>,
              },
              {
                title: t('criticalCenter.colStatus'), dataIndex: 'enabled',
                render: (v: boolean) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${v ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{v ? t('criticalCenter.enabledState') : t('criticalCenter.disabledState')}</span>,
              },
              {
                title: t('criticalCenter.colActions'), key: 'actions',
                render: (_: unknown, r: CriticalExtRuleDto) => (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setRuleModal({ open: true, editing: r }); setRuleForm({ name: r.name, condition: r.condition, action: r.action ?? '', severity: r.severity || 'HIGH', enabled: r.enabled }) }}
                      className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                    >
                      <Edit3 size={11} /> {t('criticalCenter.edit')}
                    </button>
                    <Popconfirm title={t('criticalCenter.deleteRule')} description={`确定删除规则 "${r.name}" 吗?`} onConfirm={() => void handleDeleteRule(r)} okText={t('criticalCenter.delete')} cancelText={t('criticalCenter.cancel')} okButtonProps={{ danger: true }}>
                      <button className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">
                        <Trash2 size={11} /> {t('criticalCenter.delete')}
                      </button>
                    </Popconfirm>
                  </div>
                ),
              },
            ]}
          />
        ) : (
          <div className="text-xs text-gray-400 py-3">{t('criticalCenter.ruleLibraryEmpty')}</div>
        )}
      </div>

      {/* 规则编辑/新增 Modal */}
      <Modal
        title={ruleModal.editing ? `编辑规则 - ${ruleModal.editing.name}` : t('criticalCenter.newRuleTitle')}
        open={ruleModal.open}
        onOk={() => void handleSaveRule()}
        onCancel={() => setRuleModal({ open: false, editing: null })}
        confirmLoading={ruleSaving}
        okText={t('criticalCenter.save')}
        cancelText={t('criticalCenter.cancel')}
        width={520}
      >
        <div className="space-y-3 py-1">
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-600">{t('criticalCenter.ruleNameLabel')}</div>
            <Input value={ruleForm.name} onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))} placeholder={t('criticalCenter.ruleNamePlaceholder')} />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-600">{t('criticalCenter.conditionLabel')}</div>
            <Input value={ruleForm.condition} onChange={(e) => setRuleForm((f) => ({ ...f, condition: e.target.value }))} placeholder={t('criticalCenter.conditionPlaceholder')} />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-600">{t('criticalCenter.actionLabel')}</div>
            <Input value={ruleForm.action} onChange={(e) => setRuleForm((f) => ({ ...f, action: e.target.value }))} placeholder={t('criticalCenter.actionPlaceholder')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-600">{t('criticalCenter.severityLabel')}</div>
              <Select
                className="w-full"
                value={ruleForm.severity}
                onChange={(v) => setRuleForm((f) => ({ ...f, severity: v }))}
                options={SEVERITY_OPTIONS.map((s) => ({ value: s, label: s }))}
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-600">{t('criticalCenter.enabledLabel')}</div>
              <Switch checked={ruleForm.enabled} onChange={(v) => setRuleForm((f) => ({ ...f, enabled: v }))} />
            </div>
          </div>
        </div>
      </Modal>

      {/* [W5] 通知通道开关配置: 落库 critical_channel_<CHANNEL>, 后端据此判定投递结果 */}
      <div className="rounded-lg border bg-card p-4" data-testid="critical-channel-config">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">{t('criticalCenter.channelConfigTitle')}</h2>
          <button
            onClick={() => void handleSaveChannels()}
            disabled={savingChannels}
            className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={12} /> {savingChannels ? t('criticalCenter.saving') : t('criticalCenter.save')}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {channels.map((c) => (
            <div key={c.channel} className="flex items-center justify-between rounded border p-3 bg-slate-50">
              <div>
                <div className="text-sm font-semibold">{c.label}</div>
                <div className="text-xs text-gray-400 font-mono">{c.channel}</div>
              </div>
              <Switch size="small" checked={c.enabled} onChange={(v) => toggleChannel(c.channel, v)} />
            </div>
          ))}
          {channels.length === 0 && (
            <div className="text-xs text-gray-400 col-span-full py-2">{t('criticalCenter.channelsUnavailable')}</div>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {t('criticalCenter.channelHint')}
        </p>
      </div>
    </div>
  )
}

export default CriticalValueCenterPage
