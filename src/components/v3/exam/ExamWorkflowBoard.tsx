/**
 * G005 放射RIS系统 v3.0.2 - 检查工作流看板
 * 对标:RIS 检查流程可视化(Kanban)
 */
import React, { useState, useMemo } from 'react'
import { Card, Tag, Space, Button, Modal, Badge, Statistic, Row, Col, message } from 'antd'
import { Clock, User, AlertCircle, ChevronRight, ListTodo, FileCheck, Activity, ImageIcon } from 'lucide-react'

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
  { key: 'SCHEDULED', title: '已预约', color: 'blue', icon: <Clock size={14} /> },
  { key: 'CHECKING_IN', title: '签到', color: 'cyan', icon: <User size={14} /> },
  { key: 'IN_EXAM', title: '检查中', color: 'gold', icon: <Activity size={14} /> },
  { key: 'POST_EXAM', title: '检查后', color: 'orange', icon: <ImageIcon size={14} /> },
  { key: 'REPORT_PENDING', title: '待写报告', color: 'purple', icon: <ListTodo size={14} /> },
  { key: 'REPORT_IN_REVIEW', title: '审核中', color: 'magenta', icon: <FileCheck size={14} /> },
  { key: 'REPORT_APPROVED', title: '已审核', color: 'green', icon: <FileCheck size={14} /> },
  { key: 'RELEASED', title: '已发布', color: 'default', icon: <ChevronRight size={14} /> },
]

const PRIORITY_META = {
  ROUTINE: { color: 'default', label: '常规' },
  URGENT: { color: 'orange', label: '加急' },
  STAT: { color: 'red', label: '急诊' },
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
      m[i.stage].push(i)
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
            <Statistic title="总任务" value={stats.total} prefix={<ListTodo size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="急诊" value={stats.stat} styles={{ content: {  color: '#dc2626'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="危急值" value={stats.critical} styles={{ content: {  color: '#dc2626'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="检查中" value={stats.inExam} styles={{ content: {  color: '#ca8a04'  } }} />
          </Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 12, width: '100%' }} wrap>
        <span>优先级:</span>
        {['ALL', 'STAT', 'URGENT', 'ROUTINE'].map((p) => (
          <Tag.CheckableTag
            key={p}
            checked={filterPriority === p}
            onChange={() => setFilterPriority(p)}
            data-testid={`wf-filter-${p}`}
          >
            {p === 'ALL' ? '全部' : p}
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
                background: '#f8fafc',
                borderRadius: 6,
                padding: 8,
                minHeight: 200,
              }}
            >
              <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Space size={4}>
                  {s.icon}
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{s.title}</span>
                  <Badge count={list.length} showZero color={s.color} />
                </Space>
              </div>
              {list.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 12 }}>空</div>
              ) : (
                list.map((i) => {
                  const p = PRIORITY_META[i.priority]
                  return (
                    <Card
                      key={i.id}
                      size="small"
                      hoverable
                      onClick={() => onView?.(i.id)}
                      style={{ marginBottom: 6, borderColor: i.critical ? '#dc2626' : undefined }}
                      data-testid={`wf-item-${i.id}`}
                    >
                      <Space size={4} wrap>
                        <Tag color="blue">{i.modality}</Tag>
                        {i.bodyPart && <Tag>{i.bodyPart}</Tag>}
                        <Tag color={p.color}>{p.label}</Tag>
                        {i.critical && <Tag color="red" icon={<AlertCircle size={10} />}>危急值</Tag>}
                      </Space>
                      <div style={{ fontWeight: 500, fontSize: 13, marginTop: 4 }}>{i.patientName}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{i.patientId}</div>
                      {i.device && (
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                          设备:{i.device}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {i.technician && <span>技 {i.technician}</span>}
                        {i.radiologist && <span>诊 {i.radiologist}</span>}
                        {i.reviewer && <span>审 {i.reviewer}</span>}
                      </div>
                      <Space size={2} style={{ marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
                        {STAGES[STAGES.findIndex((x) => x.key === s.key) + 1] && (
                          <Button
                            size="small"
                            type="text"
                            onClick={() => {
                              const next = STAGES[STAGES.findIndex((x) => x.key === s.key) + 1]
                              onAdvance?.(i.id, next.key)
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
        title="分配"
        open={!!assignModal}
        onCancel={() => setAssignModal(null)}
        onOk={() => {
          if (assignModal && assignValue) {
            onAssign?.(assignModal.id, assignModal.role, assignValue)
            void message.success('已分配')
            setAssignModal(null)
            setAssignValue('')
          }
        }}
        data-testid="wf-assign-modal"
      >
        <p>分配 {assignModal?.role} - {assignModal?.id}</p>
        <input
          type="text"
          value={assignValue}
          onChange={(e) => setAssignValue(e.target.value)}
          placeholder="输入医师/技师姓名"
          style={{ width: '100%', padding: 6, border: '1px solid #d9d9d9', borderRadius: 4 }}
        />
      </Modal>
    </div>
  )
}

export default ExamWorkflowBoard
