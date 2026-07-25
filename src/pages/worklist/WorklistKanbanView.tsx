import React, { useState, useMemo } from 'react'
import { AlertTriangle, Zap, Monitor, Clock, Move, Sparkles } from 'lucide-react'
import { initialModalityDevices } from '../../data/initialData'
import type { RadiologyExam } from '../../types'
import { smartWorklistEngine } from '../../services/worklist/SmartWorklistEngine'
import type { PriorityScore as AIPriorityScore } from '../../types/workflow'

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  '已登记': { bg: '#dbeafe', color: '#2563eb', label: '已登记' },
  '待检查': { bg: '#ede9fe', color: '#7c3aed', label: '待检查' },
  '检查中': { bg: '#fce7f3', color: '#db2777', label: '检查中' },
  '待报告': { bg: '#fef9c3', color: '#ca8a04', label: '待报告' },
  '已报告': { bg: '#d1fae5', color: '#059669', label: '已报告' },
  '已发布': { bg: '#ecfdf5', color: '#047857', label: '已发布' },
  '已暂停': { bg: '#fef3c7', color: '#f59e0b', label: '已暂停' },
  '质控退回': { bg: '#fee2e2', color: '#ef4444', label: '质控退回' },
}

const PRIORITY_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  '普通': { bg: '#f1f5f9', color: '#64748b', label: '普通' },
  '紧急': { bg: '#fef3c7', color: '#d97706', label: '紧急' },
  '危重': { bg: '#fee2e2', color: '#dc2626', label: '危重' },
  '会诊': { bg: '#ede9fe', color: '#7c3aed', label: '会诊' },
}

const KANBAN_COLUMNS = ['已登记', '待检查', '检查中', '待报告', '已报告', '已发布']

const getDeviceById = (deviceId: string) => initialModalityDevices.find(d => d.id === deviceId)

interface SLAInfo {
  elapsedMinutes: number
  status: 'normal' | 'warning' | 'critical'
  color: string
  label: string
}

const getSLAInfo = (createdTime: string): SLAInfo => {
  try {
    const created = new Date(createdTime).getTime()
    const now = Date.now()
    const elapsedMinutes = Math.floor((now - created) / 60000)
    if (elapsedMinutes > 60) return { elapsedMinutes, status: 'critical', color: '#dc2626', label: '>60min' }
    if (elapsedMinutes > 30) return { elapsedMinutes, status: 'warning', color: '#d97706', label: '30-60min' }
    return { elapsedMinutes, status: 'normal', color: '#059669', label: '<30min' }
  } catch {
    return { elapsedMinutes: 0, status: 'normal', color: '#059669', label: '<30min' }
  }
}

interface PriorityScore {
  level: '低' | '普通' | '紧急' | '危重'
  score: number
  color: string
  bg: string
}

const calculatePriority = (exam: RadiologyExam): PriorityScore => {
  const ageScore = exam.age >= 70 ? 30 : exam.age >= 60 ? 20 : exam.age >= 50 ? 10 : 0
  let waitScore = 0
  try {
    const created = new Date(exam.createdTime).getTime()
    const now = Date.now()
    const waitMinutes = (now - created) / 60000
    waitScore = waitMinutes > 120 ? 25 : waitMinutes > 60 ? 15 : waitMinutes > 30 ? 8 : 0
  } catch { /* ignore */ }
  const typeScore = exam.patientType === '急诊' ? 25 : exam.patientType === '住院' ? 15 : 5
  const partScore = exam.bodyPart === '头颅' || exam.bodyPart === '心脏' || exam.bodyPart === '血管' ? 20 : 10
  const totalScore = ageScore + waitScore + typeScore + partScore
  if (totalScore >= 70) return { level: '危重', score: totalScore, color: '#dc2626', bg: '#fee2e2' }
  if (totalScore >= 45) return { level: '紧急', score: totalScore, color: '#d97706', bg: '#fef3c7' }
  if (totalScore >= 25) return { level: '普通', score: totalScore, color: '#64748b', bg: '#f1f5f9' }
  return { level: '低', score: totalScore, color: '#059669', bg: '#d1fae5' }
}

interface KanbanCardProps {
  exam: RadiologyExam
  isDragging: boolean
  draggedExamId: string | null
  onDragStart: (e: React.DragEvent, exam: RadiologyExam) => void
  onDragEnd: () => void
  onRowClick: (exam: RadiologyExam) => void
  smartScore: AIPriorityScore | undefined
}

const KanbanCard = React.memo(function KanbanCard({
  exam,
  isDragging,
  onDragStart,
  onDragEnd,
  onRowClick,
  smartScore,
}: KanbanCardProps) {
  const device = getDeviceById(exam.deviceId ?? '')
  const pc = PRIORITY_CONFIG[exam.priority] || PRIORITY_CONFIG['普通']!

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, exam)}
      onDragEnd={onDragEnd}
      onClick={() => onRowClick(exam)}
      style={{
        background: '#fff',
        borderRadius: 8,
        padding: '10px 12px',
        marginBottom: 8,
        cursor: 'move',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        opacity: isDragging ? 0.5 : 1,
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        if (!isDragging) {
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }
      }}
      onMouseLeave={e => {
        if (!isDragging) {
          e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)'
          e.currentTarget.style.transform = 'translateY(0)'
        }
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 6,
      }}>
        <div style={{
          fontWeight: 600,
          color: '#1e3a5f',
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          {exam.patientName}
          {exam.priority === '危重' && <AlertTriangle size={10} style={{ color: '#dc2626' }} />}
          {exam.priority === '紧急' && <Zap size={10} style={{ color: '#d97706' }} />}
        </div>
        <Move size={12} style={{ color: '#cbd5e1', flexShrink: 0 }} />
      </div>

      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
        {exam.examItemName}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        color: '#94a3b8',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Monitor size={10} />
          {device?.name?.split('（')[0] || '-'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Clock size={10} />
          {exam.examTime || '-'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        {(() => {
          const sla = getSLAInfo(exam.createdTime)
          const autoPri = calculatePriority(exam)
          const smart = smartScore
          const smartLevel = smart ? smart.level : null
          const smartColor = smartLevel === 'critical' ? '#dc2626' : smartLevel === 'urgent' ? '#d97706' : smartLevel === 'normal' ? '#475569' : '#059669'
          const smartBg = smartLevel === 'critical' ? '#fee2e2' : smartLevel === 'urgent' ? '#fef3c7' : smartLevel === 'normal' ? '#f1f5f9' : '#d1fae5'
          const smartLabel = smartLevel === 'critical' ? '危重' : smartLevel === 'urgent' ? '紧急' : smartLevel === 'normal' ? '普通' : '低'
          return (
            <>
              <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12, fontWeight: 600, color: sla.color }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: sla.color }} />
                {sla.elapsedMinutes}m
              </span>
              <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: autoPri.bg, color: autoPri.color, fontWeight: 600 }}>
                {autoPri.level}
              </span>
              {smart && (
                <span
                  title={`AI 评分 ${smart.score.toFixed(1)} / 100 · ${smart.reasons.join('; ')}`}
                  data-testid="smart-priority-badge"
                  style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: smartBg, color: smartColor, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}
                >
                  <Sparkles size={8} /> AI {smartLabel} {smart.score.toFixed(0)}
                </span>
              )}
            </>
          )
        })()}
      </div>

      <div style={{ height: 2, borderRadius: 1, background: pc.color, marginTop: 8 }} />
    </div>
  )
})

// ============================================================
// KanbanView
// ============================================================
interface KanbanViewProps {
  exams: RadiologyExam[]
  onRowClick: (exam: RadiologyExam) => void
}

export function KanbanView({ exams, onRowClick }: KanbanViewProps) {
  const [draggedExam, setDraggedExam] = useState<RadiologyExam | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [examStatuses, setExamStatuses] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    exams.forEach(e => { map[e.id] = e.status })
    return map
  })

  const smartScores = useMemo(() => {
    const map = new Map<string, AIPriorityScore>()
    smartWorklistEngine.scoreMany(exams).forEach((s) => map.set(s.studyId, s))
    return map
  }, [exams])

  const getColumnExams = (status: string) => exams.filter(e => examStatuses[e.id] === status)

  const handleDragStart = (e: React.DragEvent, exam: RadiologyExam) => {
    setDraggedExam(exam)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault()
    setDragOverColumn(status)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault()
    if (draggedExam) {
      setExamStatuses(prev => ({
        ...prev,
        [draggedExam.id]: targetStatus,
      }))
    }
    setDraggedExam(null)
    setDragOverColumn(null)
  }

  const handleDragEnd = () => {
    setDraggedExam(null)
    setDragOverColumn(null)
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${KANBAN_COLUMNS.length}, minmax(240px, 1fr))`,
      gap: 12,
      overflowX: 'auto',
      paddingBottom: 8,
    }}>
      {KANBAN_COLUMNS.map(status => {
        const columnExams = getColumnExams(status)
        const sc = STATUS_CONFIG[status] || { bg: '#f1f5f9', color: '#64748b' }
        const isOver = dragOverColumn === status

        return (
          <div
            key={status}
            onDragOver={e => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, status)}
            style={{
              background: isOver ? '#f0f7ff' : '#f8fafc',
              borderRadius: 10,
              padding: 12,
              minHeight: 400,
              transition: 'background 0.15s',
              border: isOver ? '2px dashed #1e3a5f' : '2px dashed transparent',
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
              padding: '8px 10px',
              background: '#fff',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: sc.color }} />
                <span style={{ fontWeight: 600, color: '#334155', fontSize: 12 }}>{status}</span>
              </div>
              <div style={{ background: sc.bg, color: sc.color, padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                {columnExams.length}
              </div>
            </div>

            <div style={{ minHeight: 100 }}>
              {columnExams.map(exam => (
                <KanbanCard
                  key={exam.id}
                  exam={exam}
                  isDragging={draggedExam?.id === exam.id}
                  draggedExamId={draggedExam?.id ?? null}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onRowClick={onRowClick}
                  smartScore={smartScores.get(exam.id)}
                />
              ))}
              {columnExams.length === 0 && (
                <div style={{ textAlign: 'center', color: '#cbd5e1', fontSize: 12, padding: '20px 0' }}>
                  暂无记录
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
