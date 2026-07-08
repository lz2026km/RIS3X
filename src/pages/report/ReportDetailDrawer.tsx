import React, { useState, useEffect } from 'react'
import {
  FileText, X, User, Stethoscope, Calendar, Activity, Printer, History,
  ShieldCheck, Zap, CheckCircle, AlertTriangle, Edit3, Download,
  ChevronDown, ChevronRight, Clock,
} from 'lucide-react'
import type { RadiologyReport } from '../../types'
import { StatusBadge, StatusTimeline, REPORT_STATUS_META, REPORT_STATUS_ORDER } from '../../components/report'

const PRIMARY = '#1e3a5f'
const WHITE = '#ffffff'
const GRAY = '#64748b'
const BG = '#f8fafc'
const DANGER = '#dc2626'
const SUCCESS = '#059669'
const WARNING = '#d97706'
const ACCENT = '#3182ce'

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  待审核: { label: '待审核', bg: '#ede9fe', color: '#6d28d9', border: '#c4b5fd' },
  已审核: { label: '已审核', bg: '#dbeafe', color: '#2563eb', border: '#93c5fd' },
  已发布: { label: '已发布', bg: '#d1fae5', color: '#047857', border: '#6ee7b7' },
  已修改: { label: '已修改', bg: '#fef3c7', color: '#b45309', border: '#fcd34d' },
  已退回: { label: '已退回', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
  待分配: REPORT_STATUS_META['待分配'],
  已分配: REPORT_STATUS_META['已分配'],
  书写中: REPORT_STATUS_META['书写中'],
  已提交: REPORT_STATUS_META['已提交'],
  初审中: REPORT_STATUS_META['初审中'],
  初审通过: REPORT_STATUS_META['初审通过'],
  终审中: REPORT_STATUS_META['终审中'],
  签发中: REPORT_STATUS_META['签发中'],
  已签发: REPORT_STATUS_META['已签发'],
  修订中: REPORT_STATUS_META['修订中'],
  已修订: REPORT_STATUS_META['已修订'],
  已撤回: REPORT_STATUS_META['已撤回'],
  已归档: REPORT_STATUS_META['已归档'],
}

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
    parts.push(<span key={match.index} style={{ background: '#fee2e2', color: DANGER, fontWeight: 700, borderRadius: 2, padding: '0 2px' }}>{match[0]}</span>)
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
}

export default function ReportDetailDrawer({ report, onClose, onReview, onPrint, onExportPDF }: ReportDetailDrawerProps) {
  const [tab, setTab] = useState<'content' | 'history' | 'print' | 'timeline'>('content')
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (report) { setTab('content'); setShowHistory(false) }
  }, [report?.id])

  const reportStatus = (report?.status as string) || '待分配'
  if (!report) return null

  const cfg = STATUS_CONFIG[report.status] || { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' }

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
        background: WHITE, borderRadius: 12, width: '100%', maxWidth: 880,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div className="no-print" style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <FileText size={18} style={{ color: PRIMARY }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: PRIMARY }}>报告详情</div>
            <div style={{ fontSize: 12, color: GRAY, marginTop: 1 }}>{report.reportId} · {report.accessionNumber}</div>
          </div>
          <StatusBadge status={reportStatus} size="md" />
          <button onClick={onClose} style={{ padding: 6, borderRadius: 6, border: '1px solid #e2e8f0', background: WHITE, cursor: 'pointer', color: GRAY, display: 'flex', alignItems: 'center' }}><X size={16} /></button>
        </div>

        <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, flexShrink: 0 }}>
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

        <div className="no-print" style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e2e8f0', padding: '0 20px', flexShrink: 0 }}>
          {[
            { key: 'content', label: '报告内容', icon: <FileText size={13} /> },
            { key: 'timeline', label: '状态时间线', icon: <Activity size={13} />, badge: 'R0' },
            { key: 'history', label: '历史版本', icon: <History size={13} /> },
            { key: 'print', label: '打印预览', icon: <Printer size={13} /> },
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
              <div style={{ marginBottom: 16, padding: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Activity size={14} color="#1e40af" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>v1.0.1 报告全生命周期</span>
                </div>
                <div style={{ fontSize: 12, color: '#1e3a8a', lineHeight: 1.6 }}>
                  本报告当前处于 <StatusBadge status={reportStatus} size="sm" showIcon={false} /> 状态。
                  系统支持 14 态状态机：待分配 → 已分配 → 书写中 → 已提交 → 初审中 → 初审通过 → 终审中 → 已审核 → 签发中 → 已签发 → 已发布 → 修订中 → 已修订 / 已撤回 / 已驳回 / 已归档。
                </div>
              </div>
              <StatusTimeline report={report} />
            </div>
          )}

          {tab === 'content' && (
            <div>
              {report.criticalFinding && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fff5f5', border: '1px solid #fed7d7', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Zap size={16} style={{ color: DANGER, flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: DANGER, marginBottom: 3 }}>⚠ 危急值报告</div>
                    <div style={{ fontSize: 12, color: '#7f1d1d' }}>{report.criticalFindingDetails || report.diagnosis}</div>
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={{ background: '#fafbfc', borderRadius: 8, padding: '14px 16px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>检查所见</div>
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{highlightAnomalies(report.examFindings) || '(未填写)'}</div>
                </div>
                <div style={{ background: '#fafbfc', borderRadius: 8, padding: '14px 16px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>诊断意见</div>
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontWeight: 600 }}>{highlightAnomalies(report.diagnosis) || '(未填写)'}</div>
                  {report.impression && report.impression !== report.diagnosis && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, marginTop: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>印象</div>
                      <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{highlightAnomalies(report.impression)}</div>
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
                  <div key={s.label} style={{ background: '#fafbfc', borderRadius: 8, padding: '10px 14px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: GRAY, marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>{s.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '12px 16px', border: '1px solid #bbf7d0', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: SUCCESS, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <ShieldCheck size={13} /> 报告签名信息
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <div><div style={{ fontSize: 12, color: GRAY, marginBottom: 2 }}>报告医生</div><div style={{ fontSize: 12, fontWeight: 600, color: '#1e3a5f' }}>{report.reportDoctorName || '-'}</div></div>
                  <div><div style={{ fontSize: 12, color: GRAY, marginBottom: 2 }}>签名时间</div><div style={{ fontSize: 12, color: '#475569' }}>{report.signedTime ? formatDateFull(report.signedTime) : '-'}</div></div>
                  <div><div style={{ fontSize: 12, color: GRAY, marginBottom: 2 }}>审核医生</div><div style={{ fontSize: 12, fontWeight: 600, color: '#1e3a5f' }}>{report.auditorName || '-'}</div></div>
                  <div><div style={{ fontSize: 12, color: GRAY, marginBottom: 2 }}>审核时间</div><div style={{ fontSize: 12, color: '#475569' }}>{report.approvedTime ? formatDateFull(report.approvedTime) : '-'}</div></div>
                  <div><div style={{ fontSize: 12, color: GRAY, marginBottom: 2 }}>质量评分</div><div style={{ fontSize: 12, color: '#475569' }}>{report.qualityScore ? `${report.qualityScore}分` : '-'}</div></div>
                  <div><div style={{ fontSize: 12, color: GRAY, marginBottom: 2 }}>发布人</div><div style={{ fontSize: 12, color: '#475569' }}>{report.publishedBy || '-'}</div></div>
                </div>
                {report.auditSuggestion && (
                  <div style={{ marginTop: 8, padding: '7px 10px', background: WHITE, borderRadius: 5, border: '1px solid #d1fae5' }}>
                    <div style={{ fontSize: 12, color: GRAY, marginBottom: 2 }}>审核意见</div>
                    <div style={{ fontSize: 12, color: '#14532d' }}>{report.auditSuggestion}</div>
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
                <div style={{ position: 'absolute', left: 15, top: 0, bottom: 0, width: 2, background: '#e2e8f0' }} />
                {historyVersions.map((v, i) => (
                  <div key={v.version} style={{ display: 'flex', gap: 16, marginBottom: 24, position: 'relative' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: i === 0 ? PRIMARY : '#e2e8f0', border: `2px solid ${i === 0 ? PRIMARY : '#e2e8f0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: WHITE, fontSize: 12, fontWeight: 700, flexShrink: 0, zIndex: 1 }}>{i + 1}</div>
                    <div style={{ flex: 1, background: '#fafbfc', borderRadius: 8, padding: '12px 16px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{v.version}</span>
                        <span style={{ fontSize: 12, color: GRAY, marginLeft: 'auto' }}>{v.time}</span>
                        <span style={{ fontSize: 12, color: GRAY }}>by {v.doctor}</span>
                      </div>
                      {v.changes && <div style={{ fontSize: 12, color: '#047857', marginBottom: 6, background: '#f0fdf4', padding: '4px 8px', borderRadius: 4 }}>变更: {v.changes}</div>}
                      {v.content && <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, background: WHITE, padding: '6px 10px', borderRadius: 4, border: '1px solid #e2e8f0' }}>{v.content}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'print' && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Printer size={48} style={{ color: '#cbd5e1', marginBottom: 16 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 8 }}>打印预览</div>
              <p style={{ fontSize: 12, color: GRAY, marginBottom: 16 }}>点击下方按钮打印当前报告</p>
              <button onClick={() => onPrint(report)} style={{ padding: '10px 32px', borderRadius: 8, border: 'none', background: PRIMARY, color: WHITE, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <Printer size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> 打印
              </button>
            </div>
          )}
        </div>

        <div className="no-print" style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          {report.status === '待审核' && (
            <button onClick={() => onReview(report)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#6d28d9', color: WHITE, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={14} /> 审核报告
            </button>
          )}
          <button onClick={() => onExportPDF(report)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: WHITE, color: GRAY, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> 导出PDF
          </button>
          <button onClick={() => onPrint(report)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: WHITE, color: GRAY, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Printer size={14} /> 打印
          </button>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: WHITE, color: GRAY, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>关闭</button>
        </div>
      </div>
    </div>
  )
}
