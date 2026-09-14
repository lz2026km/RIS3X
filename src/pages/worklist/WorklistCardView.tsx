import React, { useCallback, useState } from 'react'
import {
  Scan, Monitor, Radio, Clock, AlertTriangle,
  CheckSquare, Square, Images, LayoutGrid,
} from 'lucide-react'
import { initialModalityDevices, initialExamRooms } from '../../data/initialData'
import type { RadiologyExam } from '../../types'
import { displayExamStatus } from '../../utils/statusMaps'
import { t } from '../../i18n/appI18n'

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  'SCHEDULED': { bg: '#3b82f622', color: '#3b82f6', label: t('worklistStatus.scheduled') },
  'ARRIVED': { bg: '#8b5cf622', color: '#7c3aed', label: t('worklistStatus.arrived') },
  'IN_PROGRESS': { bg: '#ec489922', color: '#db2777', label: t('worklistStatus.inProgress') },
  'COMPLETED': { bg: '#22c55e22', color: '#059669', label: t('worklistStatus.completed') },
  'CANCELLED': { bg: '#ef444422', color: '#ef4444', label: t('worklistStatus.cancelled') },
  '已登记': { bg: '#3b82f622', color: '#3b82f6', label: t('worklistStatus.scheduled') },
  '待检查': { bg: '#8b5cf622', color: '#7c3aed', label: t('worklistStatus.pending') },
  '检查中': { bg: '#ec489922', color: '#db2777', label: t('worklistStatus.inProgress') },
  '待报告': { bg: '#f59e0b22', color: '#ca8a04', label: t('worklistStatus.pendingReport') },
  '已报告': { bg: '#22c55e22', color: '#059669', label: t('worklistStatus.reported') },
  '已发布': { bg: '#22c55e22', color: '#047857', label: t('worklistStatus.published') },
  '已暂停': { bg: '#f59e0b22', color: '#f59e0b', label: t('worklistStatus.paused') },
  '质控退回': { bg: '#ef444422', color: '#ef4444', label: t('worklistStatus.qcReturned') },
}

const PRIORITY_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  '普通': { bg: 'var(--bg-deep)', color: 'var(--text-secondary)', label: t('worklistPriority.normal') },
  '紧急': { bg: '#f59e0b22', color: '#f59e0b', label: t('worklistPriority.urgent') },
  '危重': { bg: '#ef444422', color: '#ef4444', label: t('worklistPriority.critical') },
  '会诊': { bg: '#8b5cf622', color: '#7c3aed', label: t('worklistPriority.consult') },
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
  if (totalScore >= 70) return { level: '危重', score: totalScore, color: '#ef4444', bg: '#ef444422' }
  if (totalScore >= 45) return { level: '紧急', score: totalScore, color: '#f59e0b', bg: '#f59e0b22' }
  if (totalScore >= 25) return { level: '普通', score: totalScore, color: 'var(--text-secondary)', bg: 'var(--bg-deep)' }
  return { level: '低', score: totalScore, color: '#059669', bg: '#22c55e22' }
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
  const [visibleCount, setVisibleCount] = useState(20)
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
      {exams.slice(0, visibleCount).map(exam => {
        const device = getDeviceById(exam.deviceId ?? '')
        const room = getRoomById(exam.roomId ?? '')
        const sc = STATUS_CONFIG[exam.status] || { bg: 'var(--bg-deep)', color: 'var(--text-secondary)', label: displayExamStatus(exam.status) }
        const pc = PRIORITY_CONFIG[exam.priority] || PRIORITY_CONFIG['普通']!
        const isSelected = selectedIds.has(exam.id)

        return (
          <div
            key={exam.id}
            onClick={() => onRowClick(exam)}
            style={{
              background: 'var(--bg-card)',
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
              borderBottom: '1px solid var(--border-light)',
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
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {exam.gender} · {exam.age}{t('worklistCard.ageUnit')} · <span style={{
                      background: exam.patientType === '急诊' ? 'var(--color-error-bg)' : exam.patientType === '住院' ? 'var(--color-info-bg)' : 'var(--bg-deep)',
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
                background: 'var(--bg-card)',
                borderRadius: 8,
                padding: '10px 12px',
                marginBottom: 10,
              }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13, marginBottom: 6 }}>
                  {exam.examItemName}
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                  fontSize: 12,
                  color: 'var(--text-secondary)',
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
                color: 'var(--text-secondary)',
              }}>
                <span style={{ fontFamily: 'monospace' }}>{exam.accessionNumber}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Images size={11} />
                  {exam.imagesAcquired} {t('worklistCard.imagesUnit')}
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
          color: 'var(--text-secondary)',
        }}>
          <LayoutGrid size={48} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.4 }} />
          <div style={{ fontSize: 14, fontWeight: 500 }}>{t('worklistCard.noRecords')}</div>
        </div>
      )}
      {visibleCount < exams.length && (
        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '12px 0' }}>
          <button
            onClick={() => setVisibleCount(c => c + 20)}
            style={{
              padding: '8px 24px',
              background: 'var(--bg-card)',
              color: '#1e40af',
              border: '1px solid #1e40af',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {t('worklistCard.loadMore', { count: exams.length - visibleCount })}
          </button>
        </div>
      )}
    </div>
  )
})
