import React, { useState, useMemo } from 'react'
import { Zap, CheckCircle2, AlertTriangle, FileText, Eye, PenLine, Globe, Settings } from 'lucide-react'
import type { RadiologyReport } from '../../types'
import { formatDateTime } from '../../utils/date';
import { toEnState } from '../../components/report/statusMeta'
import { isDraftOverdue } from './reportUtils'


const PRIMARY = '#1e40af'
const WHITE = '#ffffff'
const GRAY = '#64748b'
const DANGER = '#dc2626'

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



const KANBAN_COLUMNS = [
  {
    key: '草稿组', label: '草稿', Icon: FileText,
    subStatus: ['待分配', '已分配', '书写中'] as readonly string[],
    color: '#1e40af', bg: 'var(--color-info-bg)', border: 'var(--color-info-border)',
  },
  {
    key: '审核组', label: '审核', Icon: Eye,
    subStatus: ['已提交', '初审中', '初审通过', '终审中', '已审核'] as readonly string[],
    color: '#7c2d12', bg: 'rgba(249,115,22,0.12)', border: '#fed7aa',
  },
  {
    key: '签发组', label: '签发', Icon: PenLine,
    subStatus: ['签发中', '已签发'] as readonly string[],
    color: '#be185d', bg: 'rgba(244,114,182,0.12)', border: '#fbcfe8',
  },
  {
    key: '已发布', label: '已发布', Icon: Globe,
    subStatus: ['已发布'] as readonly string[],
    color: '#059669', bg: 'var(--color-success-bg)', border: 'var(--color-success-border)',
  },
  {
    key: '特殊', label: '特殊', Icon: Settings,
    subStatus: ['修订中', '已修订', '已撤回', '已驳回', '已归档'] as readonly string[],
    color: '#475569', bg: 'var(--bg-card)', border: 'var(--border-color)',
  },
]

export interface ReportKanbanViewProps {
  reports: RadiologyReport[]
  onView: (r: RadiologyReport) => void
  onReview: (r: RadiologyReport) => void
}

export default function ReportKanbanView({ reports, onView, onReview }: ReportKanbanViewProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  const columns = useMemo(() => {
    return KANBAN_COLUMNS.map(col => ({
      ...col,
      items: reports.filter(r => (col.subStatus as readonly string[]).includes(r.status)),
    }))
  }, [reports])

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault()
    setDragOverCol(colKey)
  }
  const handleDragLeave = () => setDragOverCol(null)
  const handleDrop = (e: React.DragEvent, _colKey: string) => {
    e.preventDefault()
    setDragOverCol(null)
    setDraggedId(null)
  }
  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverCol(null)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, minHeight: 400 }}>
      {columns.map(col => (
        <div key={col.key} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 14px', borderRadius: '10px 10px 0 0', background: col.bg, border: `1px solid ${col.border}`, borderBottom: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
            <col.Icon size={14} style={{ color: col.color }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: col.color }}>{col.label}</span>
            <span style={{ marginLeft: 'auto', padding: '1px 8px', borderRadius: 10, background: col.color, color: WHITE, fontSize: 12, fontWeight: 700 }}>{col.items.length}</span>
          </div>
          <div onDragOver={e => handleDragOver(e, col.key)} onDragLeave={handleDragLeave} onDrop={e => handleDrop(e, col.key)}
            style={{
              flex: 1, minHeight: 300, padding: 10, borderRadius: '0 0 10px 10px',
              background: dragOverCol === col.key ? `${col.color}08` : 'var(--bg-card)',
              border: `1px solid ${dragOverCol === col.key ? col.color : col.border}`, borderTop: 'none',
              transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: 8,
            }}>
            {col.items.map(r => (
              <div key={r.id} draggable onDragStart={e => handleDragStart(e, r.id)} onDragEnd={handleDragEnd}
                onClick={() => onView(r)}
                style={{
                  background: 'var(--bg-card)', borderRadius: 8,
                  border: draggedId === r.id ? `2px solid ${col.color}` : '1px solid var(--border-color)',
                  padding: '11px 13px', cursor: 'grab', transition: 'all 0.15s',
                  boxShadow: draggedId === r.id ? `0 4px 12px ${col.color}30` : '0 1px 3px rgba(0,0,0,0.06)',
                  opacity: draggedId === r.id && draggedId !== r.id ? 0.5 : 1,
                }}
                onMouseEnter={e => { if (draggedId !== r.id) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 3px 10px rgba(0,0,0,0.1)' }}
                onMouseLeave={e => { if (draggedId !== r.id) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{r.patientName}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {/* [v3.0.6.11-95 Wave2B P1] 草稿超时角标 */}
                    {isDraftOverdue(r.status, r.updatedTime) && (
                      <span style={{ padding: '1px 6px', borderRadius: 4, background: '#fff7ed', color: '#c2410c', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2, border: '1px solid #fdba74' }}>
                        <AlertTriangle size={9} />待提交提醒
                      </span>
                    )}
                    {r.criticalFinding && (
                      <span style={{ padding: '1px 6px', borderRadius: 4, background: 'var(--color-error-bg)', color: DANGER, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Zap size={9} />危急
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 500 }}>{r.examItemName}</div>
                <div style={{ fontSize: 12, color: GRAY, marginBottom: 6 }}>{r.modality} · {r.bodyPart}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>报告: <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{r.reportDoctorName || '-'}</span></div>
                    {r.auditorName && <div style={{ fontSize: 12, color: '#64748b' }}>审核: <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{r.auditorName}</span></div>}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'right' }}>{formatDateTime(r.createdTime)}</div>
                </div>
                <div style={{ marginTop: 7, padding: '5px 8px', borderRadius: 4, background: 'var(--bg-card)', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: 48, overflow: 'hidden' }}>
                  {r.diagnosis ? highlightAnomalies(r.diagnosis.slice(0, 50)) : '(无诊断)'}
                  {r.diagnosis && r.diagnosis.length > 50 ? '…' : ''}
                </div>
                {['SUBMITTED', 'INITIAL_REVIEW'].includes(toEnState(r.status)) && (
                  <button onClick={e => { e.stopPropagation(); onReview(r) }}
                    style={{ marginTop: 8, width: '100%', padding: '5px 0', borderRadius: 5, border: 'none', background: col.color, color: WHITE, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <CheckCircle2 size={11} /> 审核
                  </button>
                )}
              </div>
            ))}
            {col.items.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#cbd5e1', fontSize: 12 }}>
                <div style={{ marginBottom: 4 }}>暂无报告</div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
