/**
 * G005 放射RIS系统 v3.0.2.2 - 临床工作流引擎
 * 对标:Camunda / Activiti — 简化版 BPMN
 *
 * 支持节点:
 *  - UserTask(用户任务)
 *  - ServiceTask(系统任务)
 *  - Gateway(条件分支)
 *  - Timer(定时器)
 */
import React, { useState, useMemo } from 'react'
import { Card, Tag, Space, Button, Empty, Statistic, Row, Col, Steps, Select } from 'antd'
import { GitBranch, Play, Pause, Square, RotateCcw, User, Server, Clock, CheckCircle, XCircle } from 'lucide-react'

export type WorkflowNodeType = 'START' | 'USER_TASK' | 'SERVICE_TASK' | 'GATEWAY' | 'TIMER' | 'END'

export interface WorkflowNode {
  id: string
  type: WorkflowNodeType
  name: string
  /** 关联用户(USER_TASK 必填) */
  assignee?: string
  /** 触发条件(GATEWAY) */
  condition?: string
  /** 超时(小时) */
  timeoutHours?: number
  /** 描述 */
  description?: string
  /** 节点结果(已执行时) */
  result?: 'PASS' | 'FAIL' | 'SKIPPED'
  /** 完成时间 */
  completedAt?: string
}

export interface Workflow {
  id: string
  name: string
  description?: string
  /** 节点列表(已排序) */
  nodes: WorkflowNode[]
  /** 当前激活节点 */
  currentNodeId: string
  /** 状态 */
  state: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED'
  startedAt: string
  completedAt?: string
  /** 上下文变量 */
  context?: Record<string, unknown>
}

const NODE_META: Record<WorkflowNodeType, { color: string; icon: React.ReactNode; label: string }> = {
  START: { color: 'green', icon: <Play size={12} />, label: '开始' },
  USER_TASK: { color: 'blue', icon: <User size={12} />, label: '用户任务' },
  SERVICE_TASK: { color: 'purple', icon: <Server size={12} />, label: '系统任务' },
  GATEWAY: { color: 'gold', icon: <GitBranch size={12} />, label: '条件分支' },
  TIMER: { color: 'cyan', icon: <Clock size={12} />, label: '定时器' },
  END: { color: 'red', icon: <Square size={12} />, label: '结束' },
}

const STATE_META: Record<Workflow['state'], { color: string; label: string; icon: React.ReactNode }> = {
  RUNNING: { color: 'processing', label: '运行中', icon: <Play size={12} /> },
  PAUSED: { color: 'warning', label: '已暂停', icon: <Pause size={12} /> },
  COMPLETED: { color: 'success', label: '已完成', icon: <CheckCircle size={12} /> },
  FAILED: { color: 'error', label: '失败', icon: <XCircle size={12} /> },
}

export interface WorkflowsEngineProps {
  workflows: Workflow[]
  onAction?: (id: string, action: 'start' | 'pause' | 'resume' | 'rollback' | 'complete') => void
}

export const WorkflowsEngine: React.FC<WorkflowsEngineProps> = ({ workflows, onAction }) => {
  const [filter, setFilter] = useState<string>('ALL')

  const filtered = useMemo(() => {
    if (filter === 'ALL') return workflows
    return workflows.filter((w) => w.state === filter)
  }, [workflows, filter])

  const stats = useMemo(() => {
    return {
      total: workflows.length,
      running: workflows.filter((w) => w.state === 'RUNNING').length,
      completed: workflows.filter((w) => w.state === 'COMPLETED').length,
      failed: workflows.filter((w) => w.state === 'FAILED').length,
    }
  }, [workflows])

  return (
    <Card
      data-testid="workflows-engine"
      size="small"
      title={
        <Space>
          <GitBranch size={16} color="#1e3a5f" />
          <span>临床工作流引擎</span>
        </Space>
      }
    >
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Statistic title="总工作流" value={stats.total} />
        </Col>
        <Col span={6}>
          <Statistic title="运行中" value={stats.running} styles={{ content: {  color: '#3b82f6'  } }} />
        </Col>
        <Col span={6}>
          <Statistic title="已完成" value={stats.completed} styles={{ content: {  color: '#16a34a'  } }} />
        </Col>
        <Col span={6}>
          <Statistic title="失败" value={stats.failed} styles={{ content: {  color: '#dc2626'  } }} />
        </Col>
      </Row>

      <Space style={{ marginBottom: 12 }}>
        <Select
          value={filter}
          onChange={setFilter}
          style={{ width: 180 }}
          data-testid="we-filter"
          options={[
            { value: 'ALL', label: '全部' },
            { value: 'RUNNING', label: '运行中' },
            { value: 'PAUSED', label: '已暂停' },
            { value: 'COMPLETED', label: '已完成' },
            { value: 'FAILED', label: '失败' },
          ]}
        />
      </Space>

      {filtered.length === 0 ? (
        <Empty description="无工作流" />
      ) : (
        <Space orientation="vertical" size={8} style={{ width: '100%' }} data-testid="we-list">
          {filtered.map((w) => {
            const sm = STATE_META[w.state]
            const currentIdx = w.nodes.findIndex((n) => n.id === w.currentNodeId)
            return (
              <Card
                key={w.id}
                size="small"
                data-testid={`we-workflow-${w.id}`}
                title={
                  <Space>
                    <Tag color={sm.color} icon={sm.icon}>
                      {sm.label}
                    </Tag>
                    <span style={{ fontSize: 13 }}>{w.name}</span>
                    {w.description && <span style={{ fontSize: 12, color: '#94a3b8' }}>{w.description}</span>}
                  </Space>
                }
                extra={
                  <Space>
                    {w.state === 'RUNNING' && (
                      <>
                        <Button
                          size="small"
                          icon={<Pause size={12} />}
                          onClick={() => onAction?.(w.id, 'pause')}
                          data-testid={`we-pause-${w.id}`}
                        >
                          暂停
                        </Button>
                        <Button
                          size="small"
                          type="primary"
                          icon={<CheckCircle size={12} />}
                          onClick={() => onAction?.(w.id, 'complete')}
                          data-testid={`we-complete-${w.id}`}
                        >
                          完成
                        </Button>
                      </>
                    )}
                    {w.state === 'PAUSED' && (
                      <Button
                        size="small"
                        type="primary"
                        icon={<Play size={12} />}
                        onClick={() => onAction?.(w.id, 'resume')}
                        data-testid={`we-resume-${w.id}`}
                      >
                        恢复
                      </Button>
                    )}
                    {(w.state === 'FAILED' || w.state === 'COMPLETED') && (
                      <Button
                        size="small"
                        icon={<RotateCcw size={12} />}
                        onClick={() => onAction?.(w.id, 'rollback')}
                        data-testid={`we-rollback-${w.id}`}
                      >
                        回滚
                      </Button>
                    )}
                  </Space>
                }
              >
                <Steps
                  size="small"
                  current={currentIdx}
                  status={w.state === 'FAILED' ? 'error' : undefined}
                  data-testid={`we-steps-${w.id}`}
                  items={w.nodes.map((n) => {
                    const m = NODE_META[n.type]
                    return {
                      title: n.name,
                      description: (
                        <Space size={2} wrap>
                          <Tag color={m.color} style={{ fontSize: 12 }}>{m.label}</Tag>
                          {n.assignee && <Tag style={{ fontSize: 12 }}>{n.assignee}</Tag>}
                          {n.completedAt && <span style={{ fontSize: 12, color: '#94a3b8' }}>{n.completedAt}</span>}
                        </Space>
                      ),
                      icon: m.icon,
                      status: n.result === 'FAIL' ? 'error' : n.result === 'PASS' ? 'finish' : undefined,
                    }
                  })}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
                  开始:{w.startedAt}
                  {w.completedAt && <> · 完成:{w.completedAt}</>}
                </div>
              </Card>
            )
          })}
        </Space>
      )}
    </Card>
  )
}

export default WorkflowsEngine
