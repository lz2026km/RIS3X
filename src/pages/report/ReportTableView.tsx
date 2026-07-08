import React, { useState, useMemo } from 'react'
import {
  FileText, Clock, Eye, Edit3, Printer, Download, ChevronDown, ChevronRight,
  User, AlertTriangle, ShieldCheck, History, CheckCircle, CheckCircle2,
  XCircle, Mic, Sparkles, Zap, BarChart3, Search,
} from 'lucide-react'
import type { RadiologyReport } from '../../types'
import { StatusBadge, StatusTimeline, REPORT_STATUS_META, REPORT_STATUS_ORDER } from '../../components/report'

const PRIMARY = '#1e3a5f'
const PRIMARY_LIGHT = '#2c5282'
const ACCENT = '#3182ce'
const SUCCESS = '#059669'
const WARNING = '#d97706'
const DANGER = '#dc2626'
const PURPLE = '#7c3aed'
const GRAY = '#64748b'
const BG = '#f8fafc'
const WHITE = '#ffffff'

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

function formatDate(dt: string) {
  if (!dt) return '-'
  return dt.length >= 16 ? dt.slice(0, 16) : dt
}

function QualityBadge({ score }: { score?: number }) {
  const [showTooltip, setShowTooltip] = useState(false)
  if (score === undefined || score === null) return <span style={{ color: '#cbd5e1', fontSize: 12 }}>-</span>
  const color = score >= 80 ? '#059669' : score >= 60 ? '#d97706' : '#dc2626'
  const bg = score >= 80 ? '#d1fae5' : score >= 60 ? '#fef3c7' : '#fee2e2'
  const label = score >= 80 ? '优秀' : score >= 60 ? '良好' : '待改进'
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
      <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 12, fontWeight: 700, background: bg, color, cursor: 'help' }}>{score}</span>
      {showTooltip && (
        <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 4, background: '#1e293b', color: '#fff', fontSize: 12, borderRadius: 4, padding: '4px 8px', whiteSpace: 'nowrap', zIndex: 10 }}>
          {label} · 评分: {score}/100
        </div>
      )}
    </div>
  )
}

export interface ReportTableViewProps {
  reports: RadiologyReport[]
  expandedId: string | null
  onToggleExpand: (id: string) => void
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onView: (r: RadiologyReport) => void
  onReview: (r: RadiologyReport) => void
  onPrint: (r: RadiologyReport) => void
  onReject: (r: RadiologyReport) => void
  onExportPDF: (r: RadiologyReport) => void
}

export default function ReportTableView({
  reports, expandedId, onToggleExpand, selectedIds, onToggleSelect,
  onSelectAll, onDeselectAll, onView, onReview, onPrint, onReject, onExportPDF,
}: ReportTableViewProps) {
  const [sortField, setSortField] = useState<string>('createdTime')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const sorted = useMemo(() => {
    return [...reports].sort((a, b) => {
      const av: any = (a as any)[sortField]
      const bv: any = (b as any)[sortField]
      if (!av) return 1
      if (!bv) return -1
      if (sortDir === 'asc') return av > bv ? 1 : -1
      return av < bv ? 1 : -1
    })
  }, [reports, sortField, sortDir])

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, currentPage])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const sortIcon = (field: string) => {
    if (sortField !== field) return null
    return <span style={{ marginLeft: 3 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const colHeaderStyle = (field: string): React.CSSProperties => ({
    padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: PRIMARY,
    borderBottom: `2px solid ${PRIMARY}`, fontSize: 12, whiteSpace: 'nowrap',
    cursor: 'pointer', userSelect: 'none', background: BG,
  })

  return (
    <div style={{ background: WHITE, borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...colHeaderStyle(''), width: 36 }}>
                <input type="checkbox"
                  checked={selectedIds.size === reports.length && reports.length > 0}
                  onChange={selectedIds.size > 0 ? onDeselectAll : onSelectAll}
                  style={{ cursor: 'pointer' }} />
              </th>
              <th style={colHeaderStyle('patientName')} onClick={() => handleSort('patientName')}>
                患者信息{sortIcon('patientName')}
              </th>
              <th style={colHeaderStyle('examItemName')} onClick={() => handleSort('examItemName')}>
                检查项目{sortIcon('examItemName')}
              </th>
              <th style={colHeaderStyle('status')} onClick={() => handleSort('status')}>
                状态{sortIcon('status')}
              </th>
              <th style={colHeaderStyle('reportDoctorName')}>
                报告医生
              </th>
              <th style={colHeaderStyle('auditorName')}>
                审核医生
              </th>
              <th style={colHeaderStyle('createdTime')} onClick={() => handleSort('createdTime')}>
                创建时间{sortIcon('createdTime')}
              </th>
              <th style={colHeaderStyle('qualityScore')}>
                质量
              </th>
              <th style={{ ...colHeaderStyle(''), cursor: 'default' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '40px 12px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <Search size={32} style={{ opacity: 0.5 }} />
                    <div>未找到符合条件的报告</div>
                  </div>
                </td>
              </tr>
            ) : paginated.map((r, idx) => {
              const cfg = STATUS_CONFIG[r.status] || { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' }
              const isExpanded = expandedId === r.id
              return (
                <React.Fragment key={r.id}>
                  <tr style={{ background: idx % 2 === 0 ? WHITE : BG, transition: 'background 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#eff6ff' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? WHITE : BG }}>
                    <td style={{ padding: '10px 12px' }}>
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => onToggleSelect(r.id)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <User size={14} style={{ color: PRIMARY }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {r.patientName}
                            {r.criticalFinding && <Zap size={11} color={DANGER} />}
                          </div>
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.gender} · {r.age}岁 · {r.patientType}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 500, color: '#334155' }}>{r.examItemName}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.modality} · {r.bodyPart}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <StatusBadge status={r.status} size="sm" />
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{r.reportDoctorName || '-'}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{r.auditorName || '-'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#64748b' }}>{formatDate(r.createdTime)}</td>
                    <td style={{ padding: '10px 12px' }}><QualityBadge score={r.qualityScore} /></td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => onView(r)} title="查看"
                          style={{ padding: '4px 7px', borderRadius: 4, border: '1px solid #e2e8f0', background: WHITE, color: GRAY, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Eye size={12} />
                        </button>
                        <button onClick={() => onPrint(r)} title="打印"
                          style={{ padding: '4px 7px', borderRadius: 4, border: '1px solid #e2e8f0', background: WHITE, color: GRAY, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Printer size={12} />
                        </button>
                        <button onClick={() => onExportPDF(r)} title="导出PDF"
                          style={{ padding: '4px 7px', borderRadius: 4, border: '1px solid #e2e8f0', background: WHITE, color: GRAY, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Download size={12} />
                        </button>
                        {r.status === '待审核' && (
                          <button onClick={() => onReview(r)} title="审核"
                            style={{ padding: '4px 7px', borderRadius: 4, border: '1px solid #6d28d9', background: '#ede9fe', color: '#6d28d9', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                            <ShieldCheck size={12} /> 审核
                          </button>
                        )}
                        <button onClick={() => onToggleExpand(r.id)} title="更多"
                          style={{ padding: '4px 7px', borderRadius: 4, border: '1px solid #e2e8f0', background: WHITE, color: GRAY, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={9} style={{ padding: '0 12px 12px', background: '#fafbfc' }}>
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginTop: -4 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                            <div>
                              <div style={{ fontSize: 12, color: GRAY, fontWeight: 600, marginBottom: 4 }}>检查所见</div>
                              <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, background: WHITE, borderRadius: 6, padding: '6px 10px', border: '1px solid #e2e8f0', maxHeight: 80, overflow: 'auto' }}>
                                {highlightAnomalies(r.examFindings) || '(未填写)'}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: GRAY, fontWeight: 600, marginBottom: 4 }}>诊断意见</div>
                              <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, background: WHITE, borderRadius: 6, padding: '6px 10px', border: '1px solid #e2e8f0', maxHeight: 80, overflow: 'auto' }}>
                                {highlightAnomalies(r.diagnosis) || '(未填写)'}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: GRAY }}>
                            <StatusTimeline report={r} />
                            <span style={{ marginLeft: 'auto' }}>报告: {r.reportDoctorName || '-'}</span>
                            {r.auditorName && <span>审核: {r.auditorName}</span>}
                            {r.qualityScore && <span>评分: {r.qualityScore}</span>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderTop: '1px solid #e2e8f0', background: WHITE }}>
        <div style={{ fontSize: 12, color: GRAY }}>
          共 {sorted.length} 条记录，第 {currentPage}/{totalPages} 页
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(1)}
            style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 4, background: WHITE, color: currentPage <= 1 ? '#cbd5e1' : PRIMARY, fontSize: 12, cursor: currentPage <= 1 ? 'not-allowed' : 'pointer' }}>«</button>
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 4, background: WHITE, color: currentPage <= 1 ? '#cbd5e1' : PRIMARY, fontSize: 12, cursor: currentPage <= 1 ? 'not-allowed' : 'pointer' }}>‹</button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let p: number
            if (totalPages <= 5) p = i + 1
            else if (currentPage <= 3) p = i + 1
            else if (currentPage >= totalPages - 2) p = totalPages - 4 + i
            else p = currentPage - 2 + i
            return (
              <button key={p} onClick={() => setCurrentPage(p)}
                style={{
                  minWidth: 28, padding: '4px 6px', borderRadius: 4, border: '1px solid',
                  borderColor: currentPage === p ? PRIMARY : '#e2e8f0',
                  background: currentPage === p ? PRIMARY : WHITE,
                  color: currentPage === p ? WHITE : GRAY,
                  fontSize: 12, cursor: 'pointer', fontWeight: currentPage === p ? 600 : 400,
                }}>{p}</button>
            )
          })}
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 4, background: WHITE, color: currentPage >= totalPages ? '#cbd5e1' : PRIMARY, fontSize: 12, cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer' }}>›</button>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}
            style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 4, background: WHITE, color: currentPage >= totalPages ? '#cbd5e1' : PRIMARY, fontSize: 12, cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer' }}>»</button>
        </div>
      </div>
    </div>
  )
}
