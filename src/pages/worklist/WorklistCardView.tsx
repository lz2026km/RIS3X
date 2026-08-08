import React, { useCallback } from 'react'
import {
  Scan, Monitor, Radio, Clock, AlertTriangle,
  CheckSquare, Square, Images, LayoutGrid,
} from 'lucide-react'
import { initialModalityDevices, initialExamRooms } from '../../data/initialData'
import type { RadiologyExam } from '../../types'
import { displayExamStatus } from '../../utils/statusMaps'

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  'SCHEDULED': { bg: '#dbeafe', color: '#2563eb', label: '已登记' },
  'ARRIVED': { bg: '#ede9fe', color: '#7c3aed', label: '已报到' },
  'IN_PROGRESS': { bg: '#fce7f3', color: '#db2777', label: '检查中' },
  'COMPLETED': { bg: '#d1fae5', color: '#059669', label: '已完成' },
  'CANCELLED': { bg: '#fee2e2', color: '#ef4444', label: '已取消' },
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

const getDeviceById = (deviceId: string) => initialModalityDevices.find(d => d.id === deviceId)
const getRoomById = (roomId: string) => initialExamRooms.find(r => r.id === roomId)

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

// ============================================================
// CardView
// ============================================================
interface CardViewProps {
  exams: RadiologyExam[]
  selectedIds: Set<string>
  onSelect: (ids: Set<string>) => void
  onRowClick: (exam: RadiologyExam) => void
}

export const CardView = React.memo(function CardView({ exams, selectedIds, onSelect, onRowClick }: CardViewProps) {
  const toggleSelect = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    onSelect(newSet)
  }, [selectedIds, onSelect])

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      gap: 16,
    }}>
      {exams.map(exam => {
        const device = getDeviceById(exam.deviceId ?? '')
        const room = getRoomById(exam.roomId ?? '')
        const sc = STATUS_CONFIG[exam.status] || { bg: '#f1f5f9', color: '#64748b', label: displayExamStatus(exam.status) }
        const pc = PRIORITY_CONFIG[exam.priority] || PRIORITY_CONFIG['普通']!
        const isSelected = selectedIds.has(exam.id)

        return (
          <div
            key={exam.id}
            onClick={() => onRowClick(exam)}
            style={{
              background: '#fff',
              borderRadius: 12,
              border: isSelected ? '2px solid #1e40af' : '1px solid #e2e8f0',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: isSelected ? '0 4px 16px rgba(30,58,95,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
            }}
            onMouseEnter={e => {
              if (!isSelected) {
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }
            }}
            onMouseLeave={e => {
              if (!isSelected) {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'
                e.currentTarget.style.transform = 'translateY(0)'
              }
            }}
          >
            <div style={{
              height: 4,
              background: pc.color,
            }} />

            <div style={{
              padding: '12px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '1px solid #f1f5f9',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  onClick={(e) => toggleSelect(exam.id, e)}
                  style={{
                    cursor: 'pointer',
                    color: isSelected ? '#1e40af' : '#cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#1e40af', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {exam.patientName}
                    {exam.priority === '危重' && <AlertTriangle size={14} style={{ color: '#dc2626' }} />}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {exam.gender} · {exam.age}岁 · <span style={{
                      background: exam.patientType === '急诊' ? '#fee2e2' : exam.patientType === '住院' ? '#dbeafe' : '#f1f5f9',
                      color: exam.patientType === '急诊' ? '#dc2626' : exam.patientType === '住院' ? '#2563eb' : '#64748b',
                      padding: '1px 6px',
                      borderRadius: 4,
                      fontWeight: 600,
                    }}>{exam.patientType}</span>
                  </div>
                </div>
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 4,
              }}>
                <span style={{
                  ...pc,
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                }}>
                  {pc.label}
                </span>
                <span style={{
                  ...sc,
                  padding: '3px 8px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 600,
                }}>
                  {sc.label}
                </span>
              </div>
            </div>

            <div style={{ padding: '12px 14px' }}>
              <div style={{
                background: '#f8fafc',
                borderRadius: 8,
                padding: '10px 12px',
                marginBottom: 10,
              }}>
                <div style={{ fontWeight: 600, color: '#334155', fontSize: 13, marginBottom: 6 }}>
                  {exam.examItemName}
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                  fontSize: 12,
                  color: '#64748b',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Monitor size={11} />
                    {device?.name?.split('（')[0] || '-'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Radio size={11} />
                    {room?.roomNumber || '-'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Scan size={11} />
                    {exam.modality} · {exam.bodyPart}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={11} />
                    {exam.examTime || '-'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {(() => {
                  const sla = getSLAInfo(exam.createdTime)
                  const autoPri = calculatePriority(exam)
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: sla.color, fontWeight: 600 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: sla.color }} />
                        SLA {sla.elapsedMinutes}m
                      </div>
                      <div style={{ fontSize: 12, padding: '1px 5px', borderRadius: 3, background: autoPri.bg, color: autoPri.color, fontWeight: 600 }}>
                        {autoPri.level}
                      </div>
                    </>
                  )
                })()}
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 12,
                color: '#64748b',
              }}>
                <span style={{ fontFamily: 'monospace' }}>{exam.accessionNumber}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Images size={11} />
                  {exam.imagesAcquired} 幅
                </span>
              </div>
            </div>
          </div>
        )
      })}
      {exams.length === 0 && (
        <div style={{
          gridColumn: '1 / -1',
          padding: 60,
          textAlign: 'center',
          color: '#94a3b8',
        }}>
          <LayoutGrid size={48} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.4 }} />
          <div style={{ fontSize: 14, fontWeight: 500 }}>暂无检查记录</div>
        </div>
      )}
    </div>
  )
})
