/**
 * G005 放射RIS系统 v3.0.2 - 检查工作流看板
 * 对标:RIS 检查流程可视化(Kanban)
 */
import React, { useState, useMemo } from 'react'
import { Card, Tag, Space, Button, Modal, Badge, Statistic, Row, Col, message } from 'antd'
import { Clock, User, AlertCircle, ChevronRight, ListTodo, FileCheck, Activity, ImageIcon } from 'lucide-react'
import { t } from '../../../i18n/appI18n'

export interface ExamWorklistItem {
  id: string
  patientName: string
  patientId: string
  modality: string
  bodyPart?: string
  /** 当前阶段 */
  stage: 'SCHEDULED' | 'CHECKING_IN' | 'IN_EXAM' | 'POST_EXAM' | 'REPORT_PENDING' | 'REPORT_IN_REVIEW' | 'REPORT_APPROVED' | 'RELEASED'
  priority: 'ROUTINE' | 'URGENT' | 'STAT'
  /** 经手医师 */
  technician?: string
  radiologist?: string
  reviewer?: string
  scheduledAt?: string
  checkedInAt?: string
  examStartedAt?: string
  examEndedAt?: string
  reportSubmittedAt?: string
  reportApprovedAt?: string
  releasedAt?: string
  /** 设备 */
  device?: string
  /** 临床信息 */
  clinicalInfo?: string
  /** 危急值 */
  critical?: boolean
}

export interface ExamWorkflowBoardProps {
  items: ExamWorklistItem[]
  onAdvance?: (id: string, toStage: ExamWorklistItem['stage']) => void
  onAssign?: (id: string, role: 'technician' | 'radiologist' | 'reviewer', user: string) => void
  onView?: (id: string) => void
}

const STAGES: { key: ExamWorklistItem['stage']; title: string; color: string; icon: React.ReactNode }[] = [
  { key: 'SCHEDULED', title: t('w9e.examWorkflow.stageScheduled'), color: 'blue', icon: <Clock size={14} /> },
  { key: 'CHECKING_IN', title: t('w9e.examWorkflow.stageCheckingIn'), color: 'cyan', icon: <User size={14} /> },
  { key: 'IN_EXAM', title: t('w9e.examWorkflow.stageInExam'), color: 'gold', icon: <Activity size={14} /> },
  { key: 'POST_EXAM', title: t('w9e.examWorkflow.stagePostExam'), color: 'orange', icon: <ImageIcon size={14} /> },
  { key: 'REPORT_PENDING', title: t('w9e.examWorkflow.stageReportPending'), color: 'purple', icon: <ListTodo size={14} /> },
  { key: 'REPORT_IN_REVIEW', title: t('w9e.examWorkflow.stageReportInReview'), color: 'magenta', icon: <FileCheck size={14} /> },
  { key: 'REPORT_APPROVED', title: t('w9e.examWorkflow.stageReportApproved'), color: 'green', icon: <FileCheck size={14} /> },
  { key: 'RELEASED', title: t('w9e.examWorkflow.stageReleased'), color: 'default', icon: <ChevronRight size={14} /> },
]

const PRIORITY_META = {
  ROUTINE: { color: 'default', label: t('w9e.examWorkflow.priorityRoutine') },
  URGENT: { color: 'orange', label: t('w9e.examWorkflow.priorityUrgent') },
  STAT: { color: 'red', label: t('w9e.examWorkflow.priorityStat') },
} as const

export const ExamWorkflowBoard: React.FC<ExamWorkflowBoardProps> = ({ items, onAdvance, onAssign, onView }) => {
  const [filterPriority, setFilterPriority] = useState<string>('ALL')
  const [assignModal, setAssignModal] = useState<{ id: string; role: 'technician' | 'radiologist' | 'reviewer' } | null>(null)
  const [assignValue, setAssignValue] = useState('')

  const filtered = useMemo(() => {
    return items.filter((i) => filterPriority === 'ALL' || i.priority === filterPriority)
  }, [items, filterPriority])

  const byStage = useMemo(() => {
    const m: Record<string, ExamWorklistItem[]> = {}
    STAGES.forEach((s) => (m[s.key] = []))
    filtered.forEach((i) => {
      if (!m[i.stage]) m[i.stage] = []
      m[i.stage]!.push(i)
    })
    return m
  }, [filtered])

  const stats = useMemo(() => {
    return {
      total: items.length,
      stat: items.filter((i) => i.priority === 'STAT').length,
      critical: items.filter((i) => i.critical).length,
      inExam: items.filter((i) => i.stage === 'IN_EXAM').length,
    }
  }, [items])

  return (
    <div data-testid="exam-workflow-board" style={{ overflow: 'auto' }}>
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card>
            <Statistic title={t('w9e.examWorkflow.statTotal')} value={stats.total} prefix={<ListTodo size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t('w9e.examWorkflow.statStat')} value={stats.stat} styles={{ content: {  color: 'var(--color-error-600)'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t('w9e.examWorkflow.statCritical')} value={stats.critical} styles={{ content: {  color: 'var(--color-error-600)'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t('w9e.examWorkflow.statInExam')} value={stats.inExam} styles={{ content: {  color: '#ca8a04'  } }} />
          </Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 12, width: '100%' }} wrap>
        <span>{t('w9e.examWorkflow.priorityLabel')}</span>
        {['ALL', 'STAT', 'URGENT', 'ROUTINE'].map((p) => (
          <Tag.CheckableTag
            key={p}
            checked={filterPriority === p}
            onChange={() => setFilterPriority(p)}
            data-testid={`wf-filter-${p}`}
          >
            {p === 'ALL' ? t('w9e.examWorkflow.filterAll') : p}
          </Tag.CheckableTag>
        ))}
      </Space>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
        {STAGES.map((s) => {
          const list = byStage[s.key] ?? []
          return (
            <div
              key={s.key}
              data-testid={`wf-col-${s.key}`}
              style={{
                flex: '0 0 240px',
                background: 'var(--bg-primary)',
                borderRadius: 6,
                padding: 8,
                minHeight: 200,
              }}
            >
              <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Space size={4}>
                  {s.icon}
                  <span style={{ fontWeight: 600, fontSize: 12 }}>{s.title}</span>
                  <Badge count={list.length} showZero color={s.color} />
                </Space>
              </div>
              {list.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 12 }}>{t('w9e.examWorkflow.empty')}</div>
              ) : (
                list.map((i) => {
                  const p = PRIORITY_META[i.priority]
                  return (
                    <Card
                      key={i.id}
                      size="small"
                      hoverable
                      onClick={() => onView?.(i.id)}
                      style={{ marginBottom: 6, borderColor: i.critical ? 'var(--color-error-600)' : undefined }}
                      data-testid={`wf-item-${i.id}`}
                    >
                      <Space size={4} wrap>
                        <Tag color="blue">{i.modality}</Tag>
                        {i.bodyPart && <Tag>{i.bodyPart}</Tag>}
                        <Tag color={p.color}>{p.label}</Tag>
                        {i.critical && <Tag color="red" icon={<AlertCircle size={10} />}>{t('w9e.examWorkflow.critical')}</Tag>}
                      </Space>
                      <div style={{ fontWeight: 500, fontSize: 12, marginTop: 4 }}>{i.patientName}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{i.patientId}</div>
                      {i.device && (
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                          {t('w9e.examWorkflow.devicePrefix')}{i.device}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {i.technician && <span>{t('w9e.examWorkflow.roleTech', { name: i.technician })}</span>}
                        {i.radiologist && <span>{t('w9e.examWorkflow.roleRadio', { name: i.radiologist })}</span>}
                        {i.reviewer && <span>{t('w9e.examWorkflow.roleReview', { name: i.reviewer })}</span>}
                      </div>
                      <Space size={2} style={{ marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
                        {STAGES[STAGES.findIndex((x) => x.key === s.key) + 1] && (
                          <Button
                            size="small"
                            type="text"
                            onClick={() => {
                              const next = STAGES[STAGES.findIndex((x) => x.key === s.key) + 1]
                              if (next) onAdvance?.(i.id, next.key)
                            }}
                            data-testid={`wf-advance-${i.id}`}
                          >
                            →
                          </Button>
                        )}
                      </Space>
                    </Card>
                  )
                })
              )}
            </div>
          )
        })}
      </div>

      <Modal
        title={t('w9e.examWorkflow.assignTitle')}
        open={!!assignModal}
        onCancel={() => setAssignModal(null)}
        onOk={() => {
          if (assignModal && assignValue) {
            onAssign?.(assignModal.id, assignModal.role, assignValue)
            void message.success(t('w9e.examWorkflow.assigned'))
            setAssignModal(null)
            setAssignValue('')
          }
        }}
        data-testid="wf-assign-modal"
      >
        <p>{t('w9e.examWorkflow.assignLine', { role: assignModal?.role ?? '', id: assignModal?.id ?? '' })}</p>
        <input
          type="text"
          value={assignValue}
          onChange={(e) => setAssignValue(e.target.value)}
          placeholder={t('w9e.examWorkflow.assignPlaceholder')}
          style={{ width: '100%', padding: 6, border: '1px solid #d9d9d9', borderRadius: 4 }}
        />
      </Modal>
    </div>
  )
}

export default ExamWorkflowBoard
