import React, { useState, useEffect, useMemo } from 'react'
import {
  FileText, X, User, Stethoscope, Calendar, Activity, Printer, History,
  ShieldCheck, Zap, CheckCircle, Download, FileCheck2, Edit3, MessageSquareText,
  Users, Archive, Target, Link2,
} from 'lucide-react'
import type { RadiologyReport } from '../../types'
import { StatusBadge, StatusTimeline } from '../../components/report'
import { toEnState } from '../../components/report/statusMeta'
import MfaVerifyModal from '../../components/security/MfaVerifyModal'
import { useReportStore } from '../../store'
import { CAN_SUPPLEMENT, CAN_RECTIFY, CAN_REDISTRIBUTE, CAN_ESCALATE, isReportWritable } from './reportUtils'
import { reportApi } from '../../services/api'
import { ErrorBanner } from '../../components/feedback'
import { criticalApi, type CriticalValueDto } from '../../services/api/criticalApi'
import type { AuditTrailEvent } from '../../components/report/StatusTimeline'
import { getCurrentUser } from '../../utils/auth'
import ReportAnnotationPanel from '../../components/report/ReportAnnotationPanel'
// [v3.0.6.11-99 Wave7B] 离线报告包: 检测本地离线副本
import { offlineStorage } from '../../services/pwa/offlineStorage'
import { useNavigate } from 'react-router-dom'
import { t } from '../../i18n/appI18n'

const PRIMARY = 'var(--color-primary-800)'
const WHITE = 'var(--bg-card, #ffffff)'
const GRAY = 'var(--text-secondary, #475569)'

const DANGER = 'var(--color-error-600)'
const SUCCESS = '#059669'





const ANOMALY_KEYWORDS = [
  '结节', '血肿', '占位', '狭窄', '肿块', '转移', '骨折', '渗出',
  '积水', '压迫', '突出', '钙化', '增粗', '模糊', '不张', '增厚',
]

function highlightAnomalies(text: string | undefined): React.ReactNode {
  if (!text) return text
  const parts: React.ReactNode[] = []
  let lastIdx = 0
  const regex = new RegExp(`(${ANOMALY_KEYWORDS.join('|')})`, 'g')
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index))
    parts.push(<span key={match.index} style={{ background: 'var(--color-error-bg)', color: DANGER, fontWeight: 700, borderRadius: 2, padding: '0 2px' }}>{match[0]}</span>)
    lastIdx = regex.lastIndex
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx))
  return parts.length > 0 ? parts : text
}

function formatDateFull(dt: string) {
  if (!dt) return ''
  const d = new Date(dt)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export interface ReportDetailDrawerProps {
  report: RadiologyReport | null
  onClose: () => void
  onReview: (r: RadiologyReport) => void
  onPrint: (r: RadiologyReport) => void
  onExportPDF: (r: RadiologyReport) => void
  onGenerateSr?: (r: RadiologyReport) => void
  // [W2-3] 增强操作
  onRevise?: (r: RadiologyReport) => void
  onRepublish?: (r: RadiologyReport) => void
  onRequestApproval?: (r: RadiologyReport) => void
  onDeliver?: (r: RadiologyReport) => void
  onCritical?: (r: RadiologyReport) => void
  onCompare?: (r: RadiologyReport) => void
  // [v3.0.6.11-92 Wave1B P0] 报告→随访入口
  onCreateFollowUp?: (r: RadiologyReport) => void
  // [v3.0.6.11-92 Wave1B P0] 报告特殊态: 补充报告/整改/跨院区重分配/升级
  onSupplement?: (r: RadiologyReport) => void
  onRectify?: (r: RadiologyReport) => void
  onRedistribute?: (r: RadiologyReport) => void
  onEscalate?: (r: RadiologyReport) => void
  // [v3.0.6.11-95 Wave2B P1] 报告列表 → 书写页入口
  onWrite?: (r: RadiologyReport) => void
  // [v3.0.6.11-95 Wave3B P1] 患者画像入口 → /patients/:id/360
  onOpen360?: (r: RadiologyReport) => void
  // [v3.0.6.11-99 Wave7B] 离线报告包: 保存 HTML 快照 / 展示「离线副本」标注
  onOfflineSave?: (r: RadiologyReport) => void
  // [v3.0.6.11-100 Wave 2A] 发起委员会会诊 → /committee-room?reportId=
  onCommittee?: (r: RadiologyReport) => void
  // [v3.0.6.11-100 Wave 6A (D-4)] 报告→病灶追踪自动建 → POST /lesion-tracking/from-report
  onCreateLesionTracking?: (r: RadiologyReport) => void
}

export default function ReportDetailDrawer({ report, onClose, onReview, onPrint, onExportPDF, onGenerateSr, onRevise, onRepublish, onRequestApproval, onDeliver, onCritical, onCompare, onCreateFollowUp, onSupplement, onRectify, onRedistribute, onEscalate, onWrite, onOpen360, onOfflineSave, onCommittee, onCreateLesionTracking }: ReportDetailDrawerProps) {
  const [tab, setTab] = useState<'content' | 'history' | 'print' | 'timeline' | 'annotations' | 'critical' | 'lesions' | 'related'>('content')
  const [showHistory, setShowHistory] = useState(false)
  const [showMfa, setShowMfa] = useState(false)
  const [pendingReviewReport, setPendingReviewReport] = useState<RadiologyReport | null>(null)
  const navigate = useNavigate()
  // [v3.0.6.11-95 Wave2B P1] 状态时间线真实化: reportApi.auditTrail 数据驱动
  const [timelineTrail, setTimelineTrail] = useState<AuditTrailEvent[] | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  // [v3.0.6.11-99 Wave7B] 离线副本检测: 打开详情时查询 IndexedDB 是否有本地快照
  const [offlineSaved, setOfflineSaved] = useState(false)
  // [G005 Wave 8] 报告→危急值反向引用: 关联危急值列表 (级别/状态/时间)
  const [linkedCritical, setLinkedCritical] = useState<CriticalValueDto[]>([])
  const [criticalLoading, setCriticalLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  // [G005 Wave 8] 报告冷归档策略 (轻量展示)
  const [archivePolicy, setArchivePolicy] = useState<{ enabled?: boolean; archiveAfterDays?: number; targetTier?: string; deleteSourceAfterDays?: number | null; archivedCount?: number } | null>(null)
  // [v3.0.6.11-103 Wave 2A] 冷归档策略编辑: PUT /reports/archive-policy
  const [policyEditOpen, setPolicyEditOpen] = useState(false)
  const [policySaving, setPolicySaving] = useState(false)
  const [policyForm, setPolicyForm] = useState<{ enabled: boolean; archiveAfterDays: number; targetTier: 'archive' | 'cold'; deleteSourceAfterDays: number | null }>({ enabled: true, archiveAfterDays: 30, targetTier: 'archive', deleteSourceAfterDays: null })

  useEffect(() => {
    if (report) { setTab('content'); setShowHistory(false); setTimelineTrail(null); setTimelineLoading(false) }
  }, [report?.id])

  useEffect(() => {
    if (!report) return
    let cancelled = false
    void offlineStorage.hasReport(report.id).then(exists => {
      if (!cancelled) setOfflineSaved(exists)
    }).catch(() => { if (!cancelled) setOfflineSaved(false) })
    return () => { cancelled = true }
  }, [report?.id])

  // [v3.0.6.11-95 Wave2B P1] 进入时间线 Tab 时拉取真实审计轨迹
  useEffect(() => {
    if (!report || tab !== 'timeline') return
    let cancelled = false
    setTimelineLoading(true)
    setLoadError(null)
    void (async () => {
      try {
        const res = await reportApi.auditTrail(report.id)
        if (cancelled) return
        const d = res.data as unknown
        const list = Array.isArray(d) ? d : (d as { events?: unknown } | null)?.events
        setTimelineTrail(Array.isArray(list) ? (list as AuditTrailEvent[]) : null)
        if (!res.success) setLoadError(t('w9.states.error'))
      } catch {
        if (!cancelled) { setTimelineTrail(null); setLoadError(t('w9.states.error')) }
      } finally {
        if (!cancelled) setTimelineLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [report, tab, reloadTick])

  // [G005 Wave 8] 危急值 Tab: 按报告反查关联危急值 (后端 /criticals/for-report/:reportId)
  useEffect(() => {
    if (!report || tab !== 'critical') return
    let cancelled = false
    setCriticalLoading(true)
    void (async () => {
      try {
        const res = await criticalApi.forReport(report.id)
        if (cancelled) return
        const d = res.data as unknown
        const items = Array.isArray(d) ? d : (d as { items?: CriticalValueDto[] } | null)?.items
        setLinkedCritical(Array.isArray(items) ? items : [])
      } catch {
        if (!cancelled) { setLinkedCritical([]); setLoadError(t('w9.states.error')) }
      } finally {
        if (!cancelled) setCriticalLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [report, tab, reloadTick])

  // [G005 Wave 8] 时间线 Tab 轻量展示归档策略 (失败静默)
  useEffect(() => {
    if (!report || tab !== 'timeline') return
    let cancelled = false
    void reportApi.getArchivePolicy().then(res => {
      if (!cancelled && res.success && res.data) setArchivePolicy(res.data as never)
    }).catch(() => { if (!cancelled) setArchivePolicy(null) })
    return () => { cancelled = true }
  }, [report, tab])

  // [v3.0.6.11-103 Wave 2A] 打开策略编辑: 回填当前策略 → PUT /reports/archive-policy
  const openPolicyEdit = () => {
    setPolicyForm({
      enabled: archivePolicy?.enabled ?? true,
      archiveAfterDays: archivePolicy?.archiveAfterDays ?? 30,
      targetTier: (archivePolicy?.targetTier === 'cold' ? 'cold' : 'archive'),
      deleteSourceAfterDays: archivePolicy?.deleteSourceAfterDays ?? null,
    })
    setPolicyEditOpen(true)
  }

  const savePolicy = async () => {
    setPolicySaving(true)
    try {
      const res = await reportApi.updateArchivePolicy({
        enabled: policyForm.enabled,
        archiveAfterDays: policyForm.archiveAfterDays,
        targetTier: policyForm.targetTier,
        deleteSourceAfterDays: policyForm.deleteSourceAfterDays,
      })
      if (res.success && res.data) {
        setArchivePolicy(res.data as never)
        setPolicyEditOpen(false)
      } else {
        alert(res.error?.message ?? t('reportDetail.archiveSaveFailed'))
      }
    } catch {
      alert(t('reportDetail.archiveSaveNetworkError'))
    } finally {
      setPolicySaving(false)
    }
  }

  // [v3.0.6.11-103 Wave 2A] 报告关联病灶列表: GET /reports/:id/lesions
  const [lesionItems, setLesionItems] = useState<Array<Record<string, unknown>>>([])
  const [lesionLoading, setLesionLoading] = useState(false)
  useEffect(() => {
    if (!report || tab !== 'lesions') return
    let cancelled = false
    setLesionLoading(true)
    void reportApi.getReportLesions(report.id).then(res => {
      if (cancelled) return
      const d = res.data as unknown
      const items = Array.isArray(d) ? d : (d as { items?: unknown[] } | null)?.items
      setLesionItems(Array.isArray(items) ? (items as Array<Record<string, unknown>>) : [])
    }).catch(() => { if (!cancelled) setLesionItems([]) })
      .finally(() => { if (!cancelled) setLesionLoading(false) })
    return () => { cancelled = true }
  }, [report, tab])

  // [v3.0.6.11-103 Wave 2A] 报告关联信息: GET /reports/:id/related (检查/患者/既往报告/随访/危急值)
  const [relatedData, setRelatedData] = useState<{
    patient: { id: string; name: string; gender?: string; birthDate?: string; phone?: string } | null
    exam: { id: string; accessionNumber?: string; modality?: string; bodyPart?: string; state?: string } | null
    previousReports: Array<{ id: string; state?: string; findings?: string; conclusion?: string; createdAt?: string; isCritical?: boolean }>
    followUpPlans: Array<{ id: string; planDate?: string; nextDate?: string; status?: string; note?: string }>
    criticalValues: Array<{ id: string; description?: string; severity?: string; state?: string; createdAt?: string; linkedByReport?: boolean }>
  } | null>(null)
  const [relatedLoading, setRelatedLoading] = useState(false)
  useEffect(() => {
    if (!report || tab !== 'related') return
    let cancelled = false
    setRelatedLoading(true)
    void reportApi.getRelated(report.id).then(res => {
      if (cancelled) return
      setRelatedData(res.success && res.data ? res.data as never : null)
    }).catch(() => { if (!cancelled) setRelatedData(null) })
      .finally(() => { if (!cancelled) setRelatedLoading(false) })
    return () => { cancelled = true }
  }, [report, tab])

  // [v3.0.6.11-99 Wave 2A 报告批注] 详情批注 Tab 当前用户 (JWT/本地会话回退)
  const drawerUser = useMemo(() => {
    const mem = getCurrentUser()
    if (mem?.id) return { id: mem.id, name: mem.name || t('reportDetail.currentUser') }
    try {
      const raw = localStorage.getItem('ris_current_user')
      if (raw) {
        const u = JSON.parse(raw)
        if (u?.id) return { id: String(u.id), name: String(u.fullName ?? u.username ?? t('reportDetail.currentUser')) }
      }
    } catch { /* 忽略 */ }
    return { id: 'A001', name: t('reportDetail.currentUser') }
  }, [])

  const reportStatus = (report?.status as string) || t('reportDetail.statusUnassigned')
  if (!report) return null

  

  const historyVersions = [
    { version: 'V2.1', time: '2026-05-01 14:30', doctor: '张海涛', changes: '修改诊断意见，补充建议。', content: '右肺中叶见约1.5cm结节影，边缘毛糙。' },
    { version: 'V2.0', time: '2026-05-01 11:30', doctor: '王秀峰', changes: '审核通过，稍作文字修改。', content: '右肺中叶见约1.2cm结节影，边缘毛糙。' },
    { version: 'V1.0', time: '2026-05-01 10:00', doctor: '张海涛', changes: '初稿书写。', content: '' },
  ]

  return (
    <div className="print-area" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 'var(--space-5, 20px)',
    }} onClick={onClose}>
      <div className="print-area-inner" onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-card)', borderRadius: 12, width: '100%', maxWidth: 880,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div className="no-print" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)', flexShrink: 0 }}>
          <FileText size={18} style={{ color: PRIMARY }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: PRIMARY }}>{t('reportDetail.title')}</div>
            <div style={{ fontSize: 12, color: GRAY, marginTop: 1 }}>{report.reportId} · {report.accessionNumber}</div>
          </div>
          <StatusBadge status={reportStatus} size="md" />
          {/* [v3.0.6.11-99 Wave7B] 离线副本标注 */}
          {offlineSaved && (
            <span style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontSize: 12, fontWeight: 600, border: '1px solid #fcd34d' }}>
              {t('reportDetail.offlineCopy')}
            </span>
          )}
          <button onClick={onClose} style={{ padding: 6, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', color: GRAY, display: 'flex', alignItems: 'center' }}><X size={16} /></button>
        </div>

        <div style={{ padding: '12px 20px', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3, 12px)', flexShrink: 0 }}>
          {[
            { icon: <User size={13} />, label: t('reportDetail.patient'), value: `${report.patientName} (${report.gender}/${report.age}岁/${report.patientType})` },
            { icon: <Stethoscope size={13} />, label: t('reportDetail.exam'), value: `${report.examItemName} (${report.modality})` },
            { icon: <Calendar size={13} />, label: t('reportDetail.examDate'), value: report.examDate },
            { icon: <Activity size={13} />, label: t('reportDetail.device'), value: report.deviceName?.split('（')[0] || '-' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
              <div style={{ color: GRAY, marginTop: 1 }}>{item.icon}</div>
              <div>
                <div style={{ fontSize: 12, color: GRAY, fontWeight: 600, marginBottom: 1 }}>{item.label}</div>
                <div style={{ fontSize: 12, color: PRIMARY, fontWeight: 600, lineHeight: 1.4 }}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="no-print" style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-color)', padding: '0 20px', flexShrink: 0 }}>
          {[
            { key: 'content', label: t('reportDetail.tabContent'), icon: <FileText size={13} /> },
            { key: 'timeline', label: t('reportDetail.tabTimeline'), icon: <Activity size={13} />, badge: 'R0' },
            { key: 'history', label: t('reportDetail.tabHistory'), icon: <History size={13} /> },
            { key: 'print', label: t('reportDetail.tabPrint'), icon: <Printer size={13} /> },
            { key: 'annotations', label: t('reportDetail.tabAnnotations'), icon: <MessageSquareText size={13} /> },
            { key: 'critical', label: t('reportDetail.tabCritical'), icon: <Zap size={13} /> },
            // [v3.0.6.11-103 Wave 2A] 报告关联病灶 (GET /reports/:id/lesions)
            { key: 'lesions', label: t('reportDetail.tabLesions'), icon: <Target size={13} /> },
            // [v3.0.6.11-103 Wave 2A] 报告关联信息 (GET /reports/:id/related)
            { key: 'related', label: t('reportDetail.tabRelated'), icon: <Link2 size={13} /> },
          ].map(tb => (
            <button key={tb.key} onClick={() => setTab(tb.key as any)}
              style={{
                padding: '10px 16px', border: 'none', background: 'transparent',
                color: tab === tb.key ? PRIMARY : GRAY, fontWeight: tab === tb.key ? 700 : 500,
                fontSize: 12, cursor: 'pointer',
                borderBottom: `2px solid ${tab === tb.key ? PRIMARY : 'transparent'}`,
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: -1,
              }}>
              {tb.icon}{tb.label}
              {tb.badge && <span style={{ fontSize: 12, padding: '1px 4px', background: '#10b981', color: '#fff', borderRadius: 3 }}>{tb.badge}</span>}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5, 20px)' }}>
          {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t('w9.states.retry')} />}
          {tab === 'timeline' && (
            <div>
              <div style={{ marginBottom: 'var(--space-4, 16px)', padding: 'var(--space-3, 12px)', background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 6 }}>
                  <Activity size={14} color="var(--color-primary-800)" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-info)' }}>{t('reportDetail.lifecycleTitle')}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-info)', lineHeight: 1.6 }}>
                  {t('reportDetail.currentStatusPrefix')} <StatusBadge status={reportStatus} size="sm" showIcon={false} /> {t('reportDetail.currentStatusSuffix')}
                  {t('reportDetail.statusMachineDesc')}
                </div>
              </div>
              {/* [G005 Wave 8] 报告冷归档策略 (轻量展示) */}
              {archivePolicy && (
                <div style={{ marginBottom: 'var(--space-4, 16px)', padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <Archive size={14} style={{ color: GRAY }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{t('reportDetail.archivePolicyTitleShort')}</span>
                  <span style={{ fontSize: 12, color: GRAY }}>
                    {t('reportDetail.archiveDescPrefix', { days: archivePolicy.archiveAfterDays ?? '-' })}<strong>{archivePolicy.targetTier ?? '-'}</strong>{t('reportDetail.archiveDescSuffix')}
                    {archivePolicy.enabled === false ? t('reportDetail.archiveDisabled') : t('reportDetail.archiveEnabledTag')}
                    {typeof archivePolicy.deleteSourceAfterDays === 'number' ? t('reportDetail.archiveDeleteSource', { days: archivePolicy.deleteSourceAfterDays }) : ''}
                  </span>
                  {toEnState(report.status) === 'PUBLISHED' && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontWeight: 600 }}>
                      {t('reportDetail.archivablePublished')}
                    </span>
                  )}
                  {/* [v3.0.6.11-103 Wave 2A] 策略编辑: PUT /reports/archive-policy */}
                  <button onClick={openPolicyEdit} style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 10px', borderRadius: 5, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--color-primary-800)', fontWeight: 600, cursor: 'pointer' }} data-testid="edit-archive-policy">
                    {t('reportDetail.archivePolicyEdit')}
                  </button>
                </div>
              )}
              {timelineLoading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-5, 20px)', color: 'var(--text-muted, #94a3b8)', fontSize: 12 }}>{t('reportDetail.auditTrailLoading')}</div>
              ) : (
                <StatusTimeline report={report} auditTrail={timelineTrail ?? undefined} />
              )}
            </div>
          )}

          {tab === 'content' && (
            <div>
              {report.criticalFinding && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', marginBottom: 'var(--space-4, 16px)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Zap size={16} style={{ color: DANGER, flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: DANGER, marginBottom: 3 }}>{t('reportDetail.criticalReport')}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-error)' }}>{report.criticalFindingDetails || report.diagnosis}</div>
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-4, 16px)' }}>
                <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '14px 16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 'var(--space-2, 8px)', textTransform: 'uppercase', letterSpacing: 1 }}>{t('reportDetail.examFindings')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{highlightAnomalies(report.examFindings) || t('reportDetail.notFilled')}</div>
                </div>
                <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '14px 16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 'var(--space-2, 8px)', textTransform: 'uppercase', letterSpacing: 1 }}>{t('reportDetail.diagnosis')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontWeight: 600 }}>{highlightAnomalies(report.diagnosis) || t('reportDetail.notFilled')}</div>
                  {report.impression && report.impression !== report.diagnosis && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, marginTop: 'var(--space-3, 12px)', marginBottom: 'var(--space-2, 8px)', textTransform: 'uppercase', letterSpacing: 1 }}>{t('reportDetail.impression')}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{highlightAnomalies(report.impression)}</div>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-4, 16px)' }}>
                {[
                  { label: t('reportDetail.clinicalHistory'), value: report.clinicalHistory },
                  { label: t('reportDetail.comparisonPrior'), value: report.comparisonWithPrior },
                  { label: t('reportDetail.recommendations'), value: report.recommendations },
                ].filter(s => s.value).map(s => (
                  <div key={s.label} style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: GRAY, marginBottom: 'var(--space-1, 4px)' }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: 'var(--color-success-bg)', borderRadius: 8, padding: '12px 16px', border: '1px solid var(--color-success-border)', marginBottom: 'var(--space-4, 16px)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: SUCCESS, marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <ShieldCheck size={13} /> {t('reportDetail.signatureInfo')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <div><div style={{ fontSize: 12, color: GRAY, marginBottom: 2 }}>{t('reportDetail.reportDoctor')}</div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary-800)' }}>{report.reportDoctorName || '-'}</div></div>
                  <div><div style={{ fontSize: 12, color: GRAY, marginBottom: 2 }}>{t('reportDetail.signTime')}</div><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{report.signedTime ? formatDateFull(report.signedTime) : '-'}</div></div>
                  <div><div style={{ fontSize: 12, color: GRAY, marginBottom: 2 }}>{t('reportDetail.auditor')}</div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary-800)' }}>{report.auditorName || '-'}</div></div>
                  <div><div style={{ fontSize: 12, color: GRAY, marginBottom: 2 }}>{t('reportDetail.auditTime')}</div><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{report.approvedTime ? formatDateFull(report.approvedTime) : '-'}</div></div>
                  <div><div style={{ fontSize: 12, color: GRAY, marginBottom: 2 }}>{t('reportDetail.qualityScore')}</div><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{report.qualityScore ? `${report.qualityScore}${t('reportDetail.scoreUnit')}` : '-'}</div></div>
                  <div><div style={{ fontSize: 12, color: GRAY, marginBottom: 2 }}>{t('reportDetail.publisher')}</div><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{report.publishedBy || '-'}</div></div>
                </div>
                {report.auditSuggestion && (
                  <div style={{ marginTop: 'var(--space-2, 8px)', padding: '7px 10px', background: 'var(--bg-card)', borderRadius: 5, border: '1px solid var(--color-success-border)' }}>
                    <div style={{ fontSize: 12, color: GRAY, marginBottom: 2 }}>{t('reportDetail.auditSuggestion')}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-success)' }}>{report.auditSuggestion}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-4, 16px)' }}>
                <History size={15} style={{ color: PRIMARY }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: PRIMARY }}>{t('reportDetail.historyVersions')}</span>
                <span style={{ fontSize: 12, color: GRAY }}>{t('reportDetail.versionCount', { count: historyVersions.length })}</span>
                {/* [G005 W1-Controls P1-10] 历史版本显示/隐藏切换 */}
                <button
                  onClick={() => setShowHistory((v) => !v)}
                  data-testid="toggle-history"
                  style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: showHistory ? PRIMARY : 'var(--bg-card)', color: showHistory ? WHITE : PRIMARY, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  {showHistory ? t('w1Controls.reportDetail.historyHide') : t('w1Controls.reportDetail.historyShow')}
                </button>
              </div>
              {!showHistory ? (
                <div style={{ padding: '18px 16px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-color)', textAlign: 'center', color: GRAY, fontSize: 12 }}>
                  <History size={18} style={{ opacity: 0.35, marginBottom: 6 }} />
                  <div>{t('w1Controls.reportDetail.historyShow')}</div>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 15, top: 0, bottom: 0, width: 2, background: 'var(--border-color)' }} />
                  {historyVersions.map((v, i) => (
                    <div key={v.version} style={{ display: 'flex', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-6, 24px)', position: 'relative' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: i === 0 ? PRIMARY : 'var(--border-color)', border: `2px solid ${i === 0 ? PRIMARY : 'var(--border-color)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: WHITE, fontSize: 12, fontWeight: 700, flexShrink: 0, zIndex: 1 }}>{i + 1}</div>
                      <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: 8, padding: '12px 16px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: PRIMARY }}>{v.version}</span>
                          <span style={{ fontSize: 12, color: GRAY, marginLeft: 'auto' }}>{v.time}</span>
                          <span style={{ fontSize: 12, color: GRAY }}>by {v.doctor}</span>
                        </div>
                        {v.changes && <div style={{ fontSize: 12, color: 'var(--color-success)', marginBottom: 6, background: 'var(--color-success-bg)', padding: '4px 8px', borderRadius: 4 }}>{t('reportDetail.changeLabel')}{v.changes}</div>}
                        {v.content && <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6, background: 'var(--bg-card)', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-color)' }}>{v.content}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'annotations' && (
            <div>
              {/* [v3.0.6.11-99 Wave 2A 报告批注] 报告协作批注 (后端 report-annotation 模块 + MSW 兜底) */}
              <ReportAnnotationPanel
                reportId={report.reportId}
                currentUser={drawerUser}
                maxHeight={440}
                testIdPrefix="detail-annotations"
              />
            </div>
          )}

          {tab === 'critical' && (
            <div>
              {/* [G005 Wave 8] 报告→危急值反向引用: 关联危急值列表 (级别/状态/时间 + 点击跳转 /critical-value) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-3, 12px)' }}>
                <Zap size={15} style={{ color: DANGER }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: PRIMARY }}>{t('reportDetail.linkedCritical')}</span>
                <span style={{ fontSize: 12, color: GRAY }}>{t('reportDetail.reverseRefCount', { count: linkedCritical.length })}</span>
              </div>
              {criticalLoading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-6, 24px)', color: 'var(--text-muted, #94a3b8)', fontSize: 12 }}>{t('reportDetail.criticalLoading')}</div>
              ) : linkedCritical.length === 0 ? (
                <div style={{ padding: '18px 16px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-color)', textAlign: 'center', color: GRAY, fontSize: 12 }}>
                  <Zap size={18} style={{ opacity: 0.35, marginBottom: 6 }} />
                  <div>{t('reportDetail.criticalEmpty')}</div>
                  <div style={{ fontSize: 11, marginTop: 'var(--space-1, 4px)' }}>{t('reportDetail.criticalEmptyHint')}</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
                  {linkedCritical.map((cv) => (
                    <button
                      key={cv.id}
                      onClick={() => navigate('/critical-value')}
                      style={{
                        textAlign: 'left', cursor: 'pointer', padding: '10px 14px', borderRadius: 8,
                        background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)',
                        display: 'flex', alignItems: 'center', gap: 10, transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                    >
                      <Zap size={15} style={{ color: DANGER, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cv.description || cv.finding || t('reportDetail.notFilledDesc')}
                        </div>
                        <div style={{ fontSize: 11, color: GRAY, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span>{t('reportDetail.severityLabel')} <strong style={{ color: DANGER }}>{cv.severity ?? '-'}</strong></span>
                          <span>{t('reportDetail.stateLabel')} {cv.state ?? cv.status ?? '-'}</span>
                          <span>{cv.triggeredAt ? new Date(cv.triggeredAt).toLocaleString('zh-CN') : cv.createdAt ? new Date(cv.createdAt).toLocaleString('zh-CN') : ''}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--color-error-600)', flexShrink: 0 }}>{t('reportDetail.viewArrow')}</span>
                    </button>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-muted, #94a3b8)', lineHeight: 1.6 }}>
                {t('reportDetail.criticalFooterHint')}
              </div>
            </div>
          )}

          {tab === 'lesions' && (
            <div>
              {/* [v3.0.6.11-103 Wave 2A] 报告关联病灶列表 (GET /reports/:id/lesions) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-3, 12px)' }}>
                <Target size={15} style={{ color: '#7c3aed' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: PRIMARY }}>{t('reportDetail.lesionsTitle')}</span>
                <span style={{ fontSize: 12, color: GRAY }}>{t('reportDetail.reverseRefCount', { count: lesionItems.length })}</span>
              </div>
              {lesionLoading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-6, 24px)', color: 'var(--text-muted, #94a3b8)', fontSize: 12 }}>{t('reportDetail.lesionsLoading')}</div>
              ) : lesionItems.length === 0 ? (
                <div style={{ padding: '18px 16px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-color)', textAlign: 'center', color: GRAY, fontSize: 12 }}>
                  <Target size={18} style={{ opacity: 0.35, marginBottom: 6 }} />
                  <div>{t('reportDetail.lesionsEmpty')}</div>
                  <div style={{ fontSize: 11, marginTop: 'var(--space-1, 4px)' }}>{t('reportDetail.lesionsEmptyHint')}</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
                  {lesionItems.map((l, i) => {
                    const name = String(l?.name ?? l?.lesionName ?? l?.site ?? t('reportDetail.lesionName', { index: i + 1 }))
                    const type = String(l?.lesionType ?? l?.type ?? '')
                    const size = String(l?.size ?? l?.maxDiameter ?? l?.diameter ?? '')
                    const status = String(l?.status ?? l?.followupStatus ?? '')
                    const note = String(l?.note ?? l?.description ?? '')
                    return (
                      <div key={String(l?.id ?? i)} style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-1, 4px)' }}>
                          <Target size={13} style={{ color: '#7c3aed', flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{name}</span>
                          {type && <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'rgba(124,58,237,0.1)', color: '#7c3aed', fontWeight: 600 }}>{type}</span>}
                          {status && <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'var(--color-info-bg)', color: 'var(--color-info)', fontWeight: 600, marginLeft: 'auto' }}>{status}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: GRAY, lineHeight: 1.6 }}>
                          {size && <span style={{ marginRight: 'var(--space-3, 12px)' }}>{t('reportDetail.sizeLabel')} <strong style={{ color: 'var(--text-primary)' }}>{size}</strong></span>}
                          {note && <span>{t('reportDetail.noteLabel')} {note}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'related' && (
            <div>
              {/* [v3.0.6.11-103 Wave 2A] 报告关联信息 (GET /reports/:id/related: 检查/患者/既往报告/随访/危急值) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-3, 12px)' }}>
                <Link2 size={15} style={{ color: 'var(--color-info-600)' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: PRIMARY }}>{t('reportDetail.relatedTitle')}</span>
                <span style={{ fontSize: 12, color: GRAY }}>{t('reportDetail.relatedSub')}</span>
              </div>
              {relatedLoading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-6, 24px)', color: 'var(--text-muted, #94a3b8)', fontSize: 12 }}>{t('reportDetail.relatedLoading')}</div>
              ) : !relatedData ? (
                <div style={{ padding: '18px 16px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-color)', textAlign: 'center', color: GRAY, fontSize: 12 }}>
                  <Link2 size={18} style={{ opacity: 0.35, marginBottom: 6 }} />
                  <div>{t('reportDetail.relatedEmpty')}</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
                  {(relatedData.patient || relatedData.exam) && (
                    <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '12px 16px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-info-600)', marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <User size={12} /> {t('reportDetail.patientExam')}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, fontSize: 12 }}>
                        {relatedData.patient && (
                          <>
                            <div><div style={{ color: GRAY, marginBottom: 2 }}>{t('reportDetail.patient')}</div><div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{relatedData.patient.name || '-'} {relatedData.patient.gender ? `(${relatedData.patient.gender})` : ''}</div></div>
                            <div><div style={{ color: GRAY, marginBottom: 2 }}>{t('reportDetail.birthDate')}</div><div style={{ color: 'var(--text-secondary)' }}>{relatedData.patient.birthDate ? new Date(relatedData.patient.birthDate).toLocaleDateString('zh-CN') : '-'}</div></div>
                            <div><div style={{ color: GRAY, marginBottom: 2 }}>{t('reportDetail.phone')}</div><div style={{ color: 'var(--text-secondary)' }}>{relatedData.patient.phone || '-'}</div></div>
                          </>
                        )}
                        {relatedData.exam && (
                          <>
                            <div><div style={{ color: GRAY, marginBottom: 2 }}>{t('reportDetail.accessionNumber')}</div><div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{relatedData.exam.accessionNumber || relatedData.exam.id}</div></div>
                            <div><div style={{ color: GRAY, marginBottom: 2 }}>{t('reportDetail.modalityBodyPart')}</div><div style={{ color: 'var(--text-secondary)' }}>{relatedData.exam.modality || '-'}{relatedData.exam.bodyPart ? ` · ${relatedData.exam.bodyPart}` : ''}</div></div>
                            <div><div style={{ color: GRAY, marginBottom: 2 }}>{t('reportDetail.examState')}</div><div style={{ color: 'var(--text-secondary)' }}>{relatedData.exam.state || '-'}</div></div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {relatedData.previousReports.length > 0 && (
                    <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '12px 16px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-info-600)', marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <History size={12} /> {t('reportDetail.previousReports')} ({relatedData.previousReports.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {relatedData.previousReports.map((p) => (
                          <div key={p.id} style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', fontSize: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 3 }}>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.id}</span>
                              {p.state && <span style={{ fontSize: 11, color: GRAY }}>{p.state}</span>}
                              {p.isCritical && <span style={{ fontSize: 11, padding: '0 5px', borderRadius: 3, background: 'var(--color-error-bg)', color: 'var(--color-error)', fontWeight: 700 }}>{t('reportDetail.criticalTag')}</span>}
                              {p.createdAt && <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', marginLeft: 'auto' }}>{new Date(p.createdAt).toLocaleDateString('zh-CN')}</span>}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6, maxHeight: 40, overflow: 'hidden' }}>
                              {(p.conclusion || p.findings || t('reportDetail.noContent'))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {relatedData.followUpPlans.length > 0 && (
                    <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '12px 16px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-info-600)', marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Calendar size={12} /> {t('reportDetail.followUpPlans')} ({relatedData.followUpPlans.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {relatedData.followUpPlans.map((f) => (
                          <div key={f.id} style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', flexWrap: 'wrap' }}>
                            {f.nextDate && <span>{t('reportDetail.nextFollowUp')} <strong>{new Date(f.nextDate).toLocaleDateString('zh-CN')}</strong></span>}
                            {f.status && <span style={{ color: GRAY }}>{t('reportDetail.stateLabel')} {f.status}</span>}
                            {f.note && <span style={{ color: 'var(--text-secondary)' }}>{f.note}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {relatedData.criticalValues.length > 0 && (
                    <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '12px 16px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: DANGER, marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Zap size={12} /> {t('reportDetail.criticalValues')} ({relatedData.criticalValues.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {relatedData.criticalValues.map((c) => (
                          <div key={c.id} style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, color: DANGER }}>{t('reportDetail.severityLabel')} {c.severity ?? '-'}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{c.description || t('reportDetail.notFilledDesc')}</span>
                            <span style={{ color: GRAY, marginLeft: 'auto' }}>{c.state ?? '-'}{c.createdAt ? ` · ${new Date(c.createdAt).toLocaleDateString('zh-CN')}` : ''}{c.linkedByReport ? t('reportDetail.transferredFromReport') : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'print' && (
            <div style={{ textAlign: 'center', padding: 'var(--space-10, 40px)' }}>
              <Printer size={48} style={{ color: '#cbd5e1', marginBottom: 'var(--space-4, 16px)' }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 'var(--space-2, 8px)' }}>{t('reportDetail.printPreview')}</div>
              <p style={{ fontSize: 12, color: GRAY, marginBottom: 'var(--space-4, 16px)' }}>{t('reportDetail.printHint')}</p>
              <button onClick={() => onPrint(report)} style={{ padding: '10px 32px', borderRadius: 8, border: 'none', background: PRIMARY, color: WHITE, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <Printer size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> {t('reportDetail.print')}
              </button>
            </div>
          )}
        </div>

        <div className="no-print" style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 'var(--space-2, 8px)', justifyContent: 'flex-end', flexShrink: 0 }}>
          {/* [v3.0.6.11-95 Wave2B P1] 报告列表 → 书写页入口 (可写态: 继续书写; 已发布/已签署: 查看) */}
          {onWrite && (
            <button onClick={() => onWrite(report)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--color-primary-800)', color: WHITE, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Edit3 size={14} /> {isReportWritable(toEnState(report.status)) ? t('reportDetail.continueWriting') : t('reportDetail.view')}
            </button>
          )}
          {/* [v3.0.6.11-95 Wave3B P1] 患者画像入口 → /patients/:id/360 */}
          {onOpen360 && report.patientId && (
            <button onClick={() => onOpen360(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #7c3aed', background: 'var(--bg-card)', color: '#7c3aed', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Activity size={12} /> {t('reportDetail.patient360')}
            </button>
          )}
          {toEnState(report.status) === 'WRITING' && (
            <button onClick={async () => { await useReportStore.getState().submit(report.id); onClose(); }} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#3182ce', color: WHITE, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={14} /> {t('reportDetail.submitReview')}
            </button>
          )}
          {['SUBMITTED', 'INITIAL_REVIEW'].includes(toEnState(report.status)) && (
            <button onClick={() => { setPendingReviewReport(report); setShowMfa(true); }} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#6d28d9', color: WHITE, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={14} /> {t('reportDetail.reviewReport')}
            </button>
          )}
          <button onClick={() => onExportPDF(report)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: GRAY, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> {t('reportDetail.exportPdf')}
          </button>
          {/* [v3.0.6.11-99 Wave7B] 离线报告包: 保存 HTML 快照 (断网可浏览) */}
          {onOfflineSave && (
            <button onClick={() => onOfflineSave(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-info-600)', background: 'var(--color-info-bg)', color: 'var(--color-info)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Download size={13} /> {offlineSaved ? t('reportDetail.updateOffline') : t('reportDetail.offlineSave')}
            </button>
          )}
          {onGenerateSr && (
            <button onClick={() => onGenerateSr(report)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--color-info-600)', background: 'var(--color-info-bg)', color: 'var(--color-info)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileCheck2 size={14} /> {t('reportDetail.generateSr')}
            </button>
          )}
          {onCompare && (
            <button onClick={() => onCompare(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-warning-500)', background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <History size={13} /> {t('reportDetail.compareVersions')}
            </button>
          )}
          {onRevise && (
            <button onClick={() => onRevise(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-warning-500)', background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <History size={13} /> {t('reportDetail.revise')}
            </button>
          )}
          {onRepublish && (
            <button onClick={() => onRepublish(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #10b981', background: 'var(--color-success-bg)', color: 'var(--color-success)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <CheckCircle size={13} /> {t('reportDetail.republish')}
            </button>
          )}
          {onRequestApproval && (
            <button onClick={() => onRequestApproval(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #7c3aed', background: 'rgba(124,58,237,0.12)', color: '#7c3aed', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <ShieldCheck size={13} /> {t('reportDetail.approvalExport')}
            </button>
          )}
          {onDeliver && (
            <button onClick={() => onDeliver(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #07c160', background: 'rgba(7,193,96,0.12)', color: 'var(--color-success)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <FileCheck2 size={13} /> {t('reportDetail.deliver')}
            </button>
          )}
          {onCritical && (
            <button onClick={() => onCritical(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-error-600)', background: 'var(--color-error-bg)', color: 'var(--color-error)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Zap size={13} /> {t('reportDetail.toCritical')}
            </button>
          )}
          {onCreateFollowUp && (
            <button onClick={() => onCreateFollowUp(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-info-600)', background: 'var(--color-info-bg)', color: 'var(--color-info)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Activity size={13} /> {t('reportDetail.createFollowUp')}
            </button>
          )}
          {/* [v3.0.6.11-100 Wave 6A (D-4)] 报告→病灶追踪自动建: 从报告文本提取病灶关键词建档 */}
          {onCreateLesionTracking && (
            <button onClick={() => onCreateLesionTracking(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #7c3aed', background: 'rgba(124,58,237,0.12)', color: '#7c3aed', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }} data-testid="detail-create-lesion-tracking">
              <Activity size={13} /> {t('reportDetail.createLesionTracking')}
            </button>
          )}
          {/* [v3.0.6.11-92 Wave1B P0] 报告特殊态按钮 (按状态启用, 对齐 backend REPORT_TRANSITIONS) */}
          {onSupplement && CAN_SUPPLEMENT.includes(toEnState(report.status)) && (
            <button onClick={() => onSupplement(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-info-600)', background: 'var(--color-info-bg)', color: 'var(--color-info)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <FileText size={13} /> {t('reportDetail.supplement')}
            </button>
          )}
          {onRectify && CAN_RECTIFY.includes(toEnState(report.status)) && (
            <button onClick={() => onRectify(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-warning-500)', background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <History size={13} /> {t('reportDetail.rectify')}
            </button>
          )}
          {onRedistribute && CAN_REDISTRIBUTE.includes(toEnState(report.status)) && (
            <button onClick={() => onRedistribute(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #7c3aed', background: 'rgba(124,58,237,0.12)', color: '#7c3aed', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Activity size={13} /> {t('reportDetail.redistribute')}
            </button>
          )}
          {onEscalate && CAN_ESCALATE.includes(toEnState(report.status)) && (
            <button onClick={() => onEscalate(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-error-600)', background: 'var(--color-error-bg)', color: 'var(--color-error)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Zap size={13} /> {t('reportDetail.escalate')}
            </button>
          )}
          {/* [v3.0.6.11-100 Wave 2A] 发起委员会会诊 (多医生合议) → /committee-room?reportId= */}
          {onCommittee && (
            <button onClick={() => onCommittee(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #7c3aed', background: 'rgba(124,58,237,0.12)', color: '#7c3aed', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }} data-testid="detail-committee">
              <Users size={13} /> {t('reportDetail.startCommittee')}
            </button>
          )}
          <button onClick={() => onPrint(report)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: GRAY, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Printer size={14} /> {t('reportDetail.print')}
          </button>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: GRAY, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t('reportDetail.close')}</button>
        </div>
      </div>
      {showMfa && pendingReviewReport && (
        <MfaVerifyModal
          userId="current-user-id"
          onVerified={() => { setShowMfa(false); onReview(pendingReviewReport); setPendingReviewReport(null); }}
          onCancel={() => { setShowMfa(false); setPendingReviewReport(null); }}
          operation="report.approve"
        />
      )}

      {/* [v3.0.6.11-103 Wave 2A] 冷归档策略编辑 Modal: PUT /reports/archive-policy */}
      {policyEditOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-5, 20px)' }} onClick={() => setPolicyEditOpen(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, width: 440, maxWidth: '100%', padding: 'var(--space-5, 20px)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-4, 16px)' }}>
              <Archive size={16} style={{ color: 'var(--color-primary-800)' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{t('reportDetail.archivePolicyTitle')}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', fontSize: 12 }}>
                <input type="checkbox" checked={policyForm.enabled} onChange={(e) => setPolicyForm(f => ({ ...f, enabled: e.target.checked }))} />
                {t('reportDetail.archiveEnabled')}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', fontSize: 12 }}>
                <span style={{ width: 90, color: 'var(--text-secondary, #475569)' }}>{t('reportDetail.archiveDays')}</span>
                <input type="number" min={1} max={36500} value={policyForm.archiveAfterDays} onChange={(e) => setPolicyForm(f => ({ ...f, archiveAfterDays: Number(e.target.value) || 1 }))} style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12 }} />
                <span style={{ color: 'var(--text-muted, #94a3b8)' }}>{t('reportDetail.daysUnit')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', fontSize: 12 }}>
                <span style={{ width: 90, color: 'var(--text-secondary, #475569)' }}>{t('reportDetail.archiveTier')}</span>
                <select value={policyForm.targetTier} onChange={(e) => setPolicyForm(f => ({ ...f, targetTier: e.target.value as 'archive' | 'cold' }))} style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, background: 'var(--bg-card)' }}>
                  <option value="archive">{t('reportDetail.tierArchive')}</option>
                  <option value="cold">{t('reportDetail.tierCold')}</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', fontSize: 12 }}>
                <span style={{ width: 90, color: 'var(--text-secondary, #475569)' }}>{t('reportDetail.archiveDeleteDays')}</span>
                <input type="number" min={0} value={policyForm.deleteSourceAfterDays ?? 0} onChange={(e) => setPolicyForm(f => ({ ...f, deleteSourceAfterDays: Number(e.target.value) > 0 ? Number(e.target.value) : null }))} style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12 }} />
                <span style={{ color: 'var(--text-muted, #94a3b8)' }}>{t('reportDetail.daysAfterNoDelete')}</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2, 8px)', marginTop: 18 }}>
              <button onClick={() => setPolicyEditOpen(false)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary, #475569)', fontSize: 12, cursor: 'pointer' }}>{t('reportDetail.cancel')}</button>
              <button onClick={() => void savePolicy()} disabled={policySaving} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: 'var(--color-primary-800)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }} data-testid="save-archive-policy">
                {policySaving ? t('reportDetail.archiveSaving') : t('reportDetail.archiveSave')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
