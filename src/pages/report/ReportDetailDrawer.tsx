import React, { useState, useEffect, useMemo } from 'react'
import {
  FileText, X, User, Stethoscope, Calendar, Activity, Printer, History,
  ShieldCheck, Zap, CheckCircle, Download, FileCheck2, Edit3, MessageSquareText,
} from 'lucide-react'
import type { RadiologyReport } from '../../types'
import { StatusBadge, StatusTimeline } from '../../components/report'
import { toEnState } from '../../components/report/statusMeta'
import MfaVerifyModal from '../../components/security/MfaVerifyModal'
import { useReportStore } from '../../store'
import { CAN_SUPPLEMENT, CAN_RECTIFY, CAN_REDISTRIBUTE, CAN_ESCALATE, isReportWritable } from './reportUtils'
import { reportApi } from '../../services/api'
import type { AuditTrailEvent } from '../../components/report/StatusTimeline'
import { getCurrentUser } from '../../utils/auth'
import ReportAnnotationPanel from '../../components/report/ReportAnnotationPanel'
// [v3.0.6.11-99 Wave7B] 离线报告包: 检测本地离线副本
import { offlineStorage } from '../../services/pwa/offlineStorage'

const PRIMARY = '#1e40af'
const WHITE = '#ffffff'
const GRAY = '#64748b'

const DANGER = '#dc2626'
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
}

export default function ReportDetailDrawer({ report, onClose, onReview, onPrint, onExportPDF, onGenerateSr, onRevise, onRepublish, onRequestApproval, onDeliver, onCritical, onCompare, onCreateFollowUp, onSupplement, onRectify, onRedistribute, onEscalate, onWrite, onOpen360, onOfflineSave }: ReportDetailDrawerProps) {
  const [tab, setTab] = useState<'content' | 'history' | 'print' | 'timeline' | 'annotations'>('content')
  const [_showHistory, setShowHistory] = useState(false)
  const [showMfa, setShowMfa] = useState(false)
  const [pendingReviewReport, setPendingReviewReport] = useState<RadiologyReport | null>(null)
  // [v3.0.6.11-95 Wave2B P1] 状态时间线真实化: reportApi.auditTrail 数据驱动
  const [timelineTrail, setTimelineTrail] = useState<AuditTrailEvent[] | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  // [v3.0.6.11-99 Wave7B] 离线副本检测: 打开详情时查询 IndexedDB 是否有本地快照
  const [offlineSaved, setOfflineSaved] = useState(false)

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
    void (async () => {
      try {
        const res = await reportApi.auditTrail(report.id)
        if (cancelled) return
        const d = res.data as unknown
        const list = Array.isArray(d) ? d : (d as { events?: unknown } | null)?.events
        setTimelineTrail(Array.isArray(list) ? (list as AuditTrailEvent[]) : null)
      } catch {
        if (!cancelled) setTimelineTrail(null)
      } finally {
        if (!cancelled) setTimelineLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [report, tab])

  // [v3.0.6.11-99 Wave 2A 报告批注] 详情批注 Tab 当前用户 (JWT/本地会话回退)
  const drawerUser = useMemo(() => {
    const mem = getCurrentUser()
    if (mem?.id) return { id: mem.id, name: mem.name || '当前用户' }
    try {
      const raw = localStorage.getItem('ris_current_user')
      if (raw) {
        const u = JSON.parse(raw)
        if (u?.id) return { id: String(u.id), name: String(u.fullName ?? u.username ?? '当前用户') }
      }
    } catch { /* 忽略 */ }
    return { id: 'A001', name: '当前用户' }
  }, [])

  const reportStatus = (report?.status as string) || '待分配'
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
      alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div className="print-area-inner" onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-card)', borderRadius: 12, width: '100%', maxWidth: 880,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div className="no-print" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <FileText size={18} style={{ color: PRIMARY }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: PRIMARY }}>报告详情</div>
            <div style={{ fontSize: 12, color: GRAY, marginTop: 1 }}>{report.reportId} · {report.accessionNumber}</div>
          </div>
          <StatusBadge status={reportStatus} size="md" />
          {/* [v3.0.6.11-99 Wave7B] 离线副本标注 */}
          {offlineSaved && (
            <span style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontSize: 12, fontWeight: 600, border: '1px solid #fcd34d' }}>
              ✓ 离线副本
            </span>
          )}
          <button onClick={onClose} style={{ padding: 6, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', color: GRAY, display: 'flex', alignItems: 'center' }}><X size={16} /></button>
        </div>

        <div style={{ padding: '12px 20px', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, flexShrink: 0 }}>
          {[
            { icon: <User size={13} />, label: '患者', value: `${report.patientName} (${report.gender}/${report.age}岁/${report.patientType})` },
            { icon: <Stethoscope size={13} />, label: '检查', value: `${report.examItemName} (${report.modality})` },
            { icon: <Calendar size={13} />, label: '检查日期', value: report.examDate },
            { icon: <Activity size={13} />, label: '设备', value: report.deviceName?.split('（')[0] || '-' },
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
            { key: 'content', label: '报告内容', icon: <FileText size={13} /> },
            { key: 'timeline', label: '状态时间线', icon: <Activity size={13} />, badge: 'R0' },
            { key: 'history', label: '历史版本', icon: <History size={13} /> },
            { key: 'print', label: '打印预览', icon: <Printer size={13} /> },
            { key: 'annotations', label: '批注', icon: <MessageSquareText size={13} /> },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              style={{
                padding: '10px 16px', border: 'none', background: 'transparent',
                color: tab === t.key ? PRIMARY : GRAY, fontWeight: tab === t.key ? 700 : 500,
                fontSize: 13, cursor: 'pointer',
                borderBottom: `2px solid ${tab === t.key ? PRIMARY : 'transparent'}`,
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: -1,
              }}>
              {t.icon}{t.label}
              {t.badge && <span style={{ fontSize: 12, padding: '1px 4px', background: '#10b981', color: '#fff', borderRadius: 3 }}>{t.badge}</span>}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {tab === 'timeline' && (
            <div>
              <div style={{ marginBottom: 16, padding: 12, background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Activity size={14} color="#1e40af" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-info)' }}>v1.0.1 报告全生命周期</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-info)', lineHeight: 1.6 }}>
                  本报告当前处于 <StatusBadge status={reportStatus} size="sm" showIcon={false} /> 状态。
                  系统支持 14 态状态机：待分配 → 已分配 → 书写中 → 已提交 → 初审中 → 初审通过 → 终审中 → 已审核 → 签发中 → 已签发 → 已发布 → 修订中 → 已修订 / 已撤回 / 已驳回 / 已归档。
                </div>
              </div>
              {timelineLoading ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 12 }}>审计轨迹加载中…</div>
              ) : (
                <StatusTimeline report={report} auditTrail={timelineTrail ?? undefined} />
              )}
            </div>
          )}

          {tab === 'content' && (
            <div>
              {report.criticalFinding && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Zap size={16} style={{ color: DANGER, flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: DANGER, marginBottom: 3 }}>⚠ 危急值报告</div>
                    <div style={{ fontSize: 12, color: 'var(--color-error)' }}>{report.criticalFindingDetails || report.diagnosis}</div>
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '14px 16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>检查所见</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{highlightAnomalies(report.examFindings) || '(未填写)'}</div>
                </div>
                <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '14px 16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>诊断意见</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontWeight: 600 }}>{highlightAnomalies(report.diagnosis) || '(未填写)'}</div>
                  {report.impression && report.impression !== report.diagnosis && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, marginTop: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>印象</div>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{highlightAnomalies(report.impression)}</div>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { label: '临床病史', value: report.clinicalHistory },
                  { label: '比较参考', value: report.comparisonWithPrior },
                  { label: '建议', value: report.recommendations },
                ].filter(s => s.value).map(s => (
                  <div key={s.label} style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: GRAY, marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: 'var(--color-success-bg)', borderRadius: 8, padding: '12px 16px', border: '1px solid var(--color-success-border)', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: SUCCESS, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <ShieldCheck size={13} /> 报告签名信息
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <div><div style={{ fontSize: 12, color: GRAY, marginBottom: 2 }}>报告医生</div><div style={{ fontSize: 12, fontWeight: 600, color: '#1e40af' }}>{report.reportDoctorName || '-'}</div></div>
                  <div><div style={{ fontSize: 12, color: GRAY, marginBottom: 2 }}>签名时间</div><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{report.signedTime ? formatDateFull(report.signedTime) : '-'}</div></div>
                  <div><div style={{ fontSize: 12, color: GRAY, marginBottom: 2 }}>审核医生</div><div style={{ fontSize: 12, fontWeight: 600, color: '#1e40af' }}>{report.auditorName || '-'}</div></div>
                  <div><div style={{ fontSize: 12, color: GRAY, marginBottom: 2 }}>审核时间</div><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{report.approvedTime ? formatDateFull(report.approvedTime) : '-'}</div></div>
                  <div><div style={{ fontSize: 12, color: GRAY, marginBottom: 2 }}>质量评分</div><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{report.qualityScore ? `${report.qualityScore}分` : '-'}</div></div>
                  <div><div style={{ fontSize: 12, color: GRAY, marginBottom: 2 }}>发布人</div><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{report.publishedBy || '-'}</div></div>
                </div>
                {report.auditSuggestion && (
                  <div style={{ marginTop: 8, padding: '7px 10px', background: 'var(--bg-card)', borderRadius: 5, border: '1px solid var(--color-success-border)' }}>
                    <div style={{ fontSize: 12, color: GRAY, marginBottom: 2 }}>审核意见</div>
                    <div style={{ fontSize: 12, color: 'var(--color-success)' }}>{report.auditSuggestion}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <History size={15} style={{ color: PRIMARY }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>报告历史版本</span>
                <span style={{ fontSize: 12, color: GRAY }}>共 {historyVersions.length} 个版本</span>
              </div>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 15, top: 0, bottom: 0, width: 2, background: 'var(--border-color)' }} />
                {historyVersions.map((v, i) => (
                  <div key={v.version} style={{ display: 'flex', gap: 16, marginBottom: 24, position: 'relative' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: i === 0 ? PRIMARY : 'var(--border-color)', border: `2px solid ${i === 0 ? PRIMARY : 'var(--border-color)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: WHITE, fontSize: 12, fontWeight: 700, flexShrink: 0, zIndex: 1 }}>{i + 1}</div>
                    <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: 8, padding: '12px 16px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{v.version}</span>
                        <span style={{ fontSize: 12, color: GRAY, marginLeft: 'auto' }}>{v.time}</span>
                        <span style={{ fontSize: 12, color: GRAY }}>by {v.doctor}</span>
                      </div>
                      {v.changes && <div style={{ fontSize: 12, color: 'var(--color-success)', marginBottom: 6, background: 'var(--color-success-bg)', padding: '4px 8px', borderRadius: 4 }}>变更: {v.changes}</div>}
                      {v.content && <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6, background: 'var(--bg-card)', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-color)' }}>{v.content}</div>}
                    </div>
                  </div>
                ))}
              </div>
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

          {tab === 'print' && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Printer size={48} style={{ color: '#cbd5e1', marginBottom: 16 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>打印预览</div>
              <p style={{ fontSize: 12, color: GRAY, marginBottom: 16 }}>点击下方按钮打印当前报告</p>
              <button onClick={() => onPrint(report)} style={{ padding: '10px 32px', borderRadius: 8, border: 'none', background: PRIMARY, color: WHITE, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <Printer size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> 打印
              </button>
            </div>
          )}
        </div>

        <div className="no-print" style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          {/* [v3.0.6.11-95 Wave2B P1] 报告列表 → 书写页入口 (可写态: 继续书写; 已发布/已签署: 查看) */}
          {onWrite && (
            <button onClick={() => onWrite(report)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#1e40af', color: WHITE, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Edit3 size={14} /> {isReportWritable(toEnState(report.status)) ? '继续书写' : '查看'}
            </button>
          )}
          {/* [v3.0.6.11-95 Wave3B P1] 患者画像入口 → /patients/:id/360 */}
          {onOpen360 && report.patientId && (
            <button onClick={() => onOpen360(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #7c3aed', background: 'var(--bg-card)', color: '#7c3aed', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Activity size={12} /> 患者画像 360
            </button>
          )}
          {toEnState(report.status) === 'WRITING' && (
            <button onClick={async () => { await useReportStore.getState().submit(report.id); onClose(); }} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#3182ce', color: WHITE, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={14} /> 提交审核
            </button>
          )}
          {['SUBMITTED', 'INITIAL_REVIEW'].includes(toEnState(report.status)) && (
            <button onClick={() => { setPendingReviewReport(report); setShowMfa(true); }} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#6d28d9', color: WHITE, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={14} /> 审核报告
            </button>
          )}
          <button onClick={() => onExportPDF(report)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: GRAY, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> 导出PDF
          </button>
          {/* [v3.0.6.11-99 Wave7B] 离线报告包: 保存 HTML 快照 (断网可浏览) */}
          {onOfflineSave && (
            <button onClick={() => onOfflineSave(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #0891b2', background: 'var(--color-info-bg)', color: 'var(--color-info)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Download size={13} /> {offlineSaved ? '更新离线副本' : '离线保存'}
            </button>
          )}
          {onGenerateSr && (
            <button onClick={() => onGenerateSr(report)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #0891b2', background: 'var(--color-info-bg)', color: 'var(--color-info)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileCheck2 size={14} /> 生成SR
            </button>
          )}
          {onCompare && (
            <button onClick={() => onCompare(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #f59e0b', background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <History size={13} /> 版本对比
            </button>
          )}
          {onRevise && (
            <button onClick={() => onRevise(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #f59e0b', background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <History size={13} /> 修订
            </button>
          )}
          {onRepublish && (
            <button onClick={() => onRepublish(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #10b981', background: 'var(--color-success-bg)', color: 'var(--color-success)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <CheckCircle size={13} /> 补发
            </button>
          )}
          {onRequestApproval && (
            <button onClick={() => onRequestApproval(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #7c3aed', background: 'rgba(124,58,237,0.12)', color: '#7c3aed', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <ShieldCheck size={13} /> 审批导出
            </button>
          )}
          {onDeliver && (
            <button onClick={() => onDeliver(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #07c160', background: 'rgba(7,193,96,0.12)', color: 'var(--color-success)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <FileCheck2 size={13} /> 分发
            </button>
          )}
          {onCritical && (
            <button onClick={() => onCritical(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #dc2626', background: 'var(--color-error-bg)', color: 'var(--color-error)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Zap size={13} /> 转危急值
            </button>
          )}
          {onCreateFollowUp && (
            <button onClick={() => onCreateFollowUp(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #0891b2', background: 'var(--color-info-bg)', color: 'var(--color-info)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Activity size={13} /> 创建随访
            </button>
          )}
          {/* [v3.0.6.11-92 Wave1B P0] 报告特殊态按钮 (按状态启用, 对齐 backend REPORT_TRANSITIONS) */}
          {onSupplement && CAN_SUPPLEMENT.includes(toEnState(report.status)) && (
            <button onClick={() => onSupplement(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #0891b2', background: 'var(--color-info-bg)', color: 'var(--color-info)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <FileText size={13} /> 补充报告
            </button>
          )}
          {onRectify && CAN_RECTIFY.includes(toEnState(report.status)) && (
            <button onClick={() => onRectify(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #f59e0b', background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <History size={13} /> 整改
            </button>
          )}
          {onRedistribute && CAN_REDISTRIBUTE.includes(toEnState(report.status)) && (
            <button onClick={() => onRedistribute(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #7c3aed', background: 'rgba(124,58,237,0.12)', color: '#7c3aed', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Activity size={13} /> 跨院区重分配
            </button>
          )}
          {onEscalate && CAN_ESCALATE.includes(toEnState(report.status)) && (
            <button onClick={() => onEscalate(report)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #dc2626', background: 'var(--color-error-bg)', color: 'var(--color-error)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Zap size={13} /> 升级
            </button>
          )}
          <button onClick={() => onPrint(report)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: GRAY, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Printer size={14} /> 打印
          </button>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: GRAY, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>关闭</button>
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
    </div>
  )
}
