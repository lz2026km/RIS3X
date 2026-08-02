/**
 * G005 放射RIS系统 v3.0.2 - 报告审核工作台
 * 对标:GE Centricity 审核界面 / 飞利浦 IntelliSpace
 */
import React, { useState, useMemo } from 'react'
import { Card, List, Tag, Space, Button, Empty, Badge, Drawer, Descriptions, Input, Statistic, Row, Col, Modal } from 'antd'
import { CheckCircle, XCircle, Edit3, MessageSquare, Clock, FileText, User, AlertCircle } from 'lucide-react'

export interface ReportForReview {
  id: string
  patientName: string
  patientId: string
  modality: string
  bodyPart?: string
  studyDate: string
  studyTime: string
  author: string
  authorAt: string
  state: 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'AMENDED'
  priority: 'ROUTINE' | 'URGENT' | 'STAT'
  findings: string
  conclusion: string
  critical?: boolean
  radsCategory?: string
  reviewComment?: string
  reviewer?: string
  reviewedAt?: string
}

export interface ReportReviewCenterProps {
  reports: ReportForReview[]
  onAction?: (id: string, action: 'approve' | 'reject' | 'amend' | 'comment', data?: { comment?: string }) => void
}

const STATE_META = {
  SUBMITTED: { color: 'blue', label: '待审核' },
  IN_REVIEW: { color: 'gold', label: '审核中' },
  APPROVED: { color: 'green', label: '已通过' },
  REJECTED: { color: 'red', label: '已退回' },
  AMENDED: { color: 'purple', label: '已修订' },
} as const

const PRIORITY_META = {
  ROUTINE: { color: 'default', label: '常规' },
  URGENT: { color: 'orange', label: '加急' },
  STAT: { color: 'red', label: '急诊' },
} as const

export const ReportReviewCenter: React.FC<ReportReviewCenterProps> = ({ reports, onAction }) => {
  const [selected, setSelected] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectComment, setRejectComment] = useState('')

  const counts = useMemo(() => {
    return {
      pending: reports.filter((r) => r.state === 'SUBMITTED' || r.state === 'IN_REVIEW').length,
      critical: reports.filter((r) => r.critical).length,
      approved: reports.filter((r) => r.state === 'APPROVED').length,
      rejected: reports.filter((r) => r.state === 'REJECTED').length,
    }
  }, [reports])

  // 默认按 priority STAT 排前
  const sorted = useMemo(() => {
    return [...reports].sort((a, b) => {
      const order = { STAT: 0, URGENT: 1, ROUTINE: 2 }
      return order[a.priority] - order[b.priority]
    })
  }, [reports])

  const current = selected ? reports.find((r) => r.id === selected) : null

  return (
    <div data-testid="report-review-center">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card>
            <Statistic title="待审核" value={counts.pending} prefix={<Clock size={14} color="#3b82f6" />} styles={{ content: {  color: '#3b82f6'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="危急值" value={counts.critical} prefix={<AlertCircle size={14} color="#dc2626" />} styles={{ content: {  color: '#dc2626'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已通过" value={counts.approved} prefix={<CheckCircle size={14} color="#16a34a" />} styles={{ content: {  color: '#16a34a'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已退回" value={counts.rejected} prefix={<XCircle size={14} color="#ef4444" />} styles={{ content: {  color: '#ef4444'  } }} />
          </Card>
        </Col>
      </Row>

      <List
        dataSource={sorted}
        renderItem={(r) => {
          const state = STATE_META[r.state]
          const pri = PRIORITY_META[r.priority]
          return (
            <List.Item
              key={r.id}
              data-testid={`review-item-${r.id}`}
              actions={[
                <Button key="open" size="small" onClick={() => setSelected(r.id)} data-testid={`detail-${r.id}`}>
                  详情
                </Button>,
                <Button
                  key="approve"
                  size="small"
                  type="primary"
                  icon={<CheckCircle size={12} />}
                  disabled={r.state === 'APPROVED'}
                  onClick={() => onAction?.(r.id, 'approve')}
                  data-testid={`approve-${r.id}`}
                >
                  通过
                </Button>,
                <Button
                  key="reject"
                  size="small"
                  danger
                  icon={<XCircle size={12} />}
                  disabled={r.state === 'REJECTED'}
                  onClick={() => {
                    setSelected(r.id)
                    setRejectModal(true)
                  }}
                  data-testid={`reject-${r.id}`}
                >
                  退回
                </Button>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <Badge count={r.priority === 'STAT' ? '急诊' : 0} color="red">
                    <FileText size={32} color={r.critical ? '#dc2626' : '#64748b'} />
                  </Badge>
                }
                title={
                  <Space>
                    <span>{r.patientName}</span>
                    <Tag>{r.patientId}</Tag>
                    <Tag color="blue">{r.modality}</Tag>
                    {r.bodyPart && <Tag>{r.bodyPart}</Tag>}
                    <Tag color={pri.color}>{pri.label}</Tag>
                    <Tag color={state.color}>{state.label}</Tag>
                    {r.critical && <Tag color="red" icon={<AlertCircle size={10} />}>危急值</Tag>}
                    {r.radsCategory && <Tag color="purple">{r.radsCategory}</Tag>}
                  </Space>
                }
                description={
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      <User size={10} /> 报告医师:{r.author} · {r.authorAt}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 2 }}>结论:{r.conclusion.slice(0, 100)}</div>
                  </div>
                }
              />
            </List.Item>
          )
        }}
        locale={{ emptyText: <Empty description="无报告" /> }}
      />

      <Drawer
        title={current ? `报告详情 · ${current.patientName}` : '详情'}
        open={!!selected}
        onClose={() => setSelected(null)}
        width={680}
      >
        {current && (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="姓名">{current.patientName}</Descriptions.Item>
              <Descriptions.Item label="ID">{current.patientId}</Descriptions.Item>
              <Descriptions.Item label="检查">{current.modality} {current.bodyPart ?? ''}</Descriptions.Item>
              <Descriptions.Item label="时间">{current.studyDate} {current.studyTime}</Descriptions.Item>
              <Descriptions.Item label="报告医师" span={2}>
                {current.author} · {current.authorAt}
              </Descriptions.Item>
              <Descriptions.Item label="状态" span={2}>
                <Tag color={STATE_META[current.state].color}>{STATE_META[current.state].label}</Tag>
                <Tag color={PRIORITY_META[current.priority].color}>{PRIORITY_META[current.priority].label}</Tag>
                {current.critical && <Tag color="red">危急值</Tag>}
                {current.radsCategory && <Tag color="purple">{current.radsCategory}</Tag>}
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title="所见">
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{current.findings}</div>
            </Card>
            <Card size="small" title="结论">
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{current.conclusion}</div>
            </Card>
            {current.reviewComment && (
              <Card size="small" title="审核意见" data-testid="review-comment-card">
                <div style={{ fontSize: 13 }}>{current.reviewComment}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  {current.reviewer} · {current.reviewedAt}
                </div>
              </Card>
            )}
            <Card size="small" title="审核操作">
              <Input.TextArea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="审核意见(选填)"
                rows={3}
                data-testid="review-comment-input"
              />
              <Space style={{ marginTop: 8 }}>
                <Button
                  type="primary"
                  icon={<CheckCircle size={12} />}
                  onClick={() => {
                    onAction?.(current.id, 'approve', { comment })
                    setSelected(null)
                    setComment('')
                  }}
                  data-testid="review-approve"
                >
                  通过
                </Button>
                <Button
                  danger
                  icon={<XCircle size={12} />}
                  onClick={() => setRejectModal(true)}
                  data-testid="review-reject"
                >
                  退回
                </Button>
                <Button
                  icon={<Edit3 size={12} />}
                  onClick={() => onAction?.(current.id, 'amend', { comment })}
                  data-testid="review-amend"
                >
                  修订
                </Button>
                <Button
                  icon={<MessageSquare size={12} />}
                  onClick={() => onAction?.(current.id, 'comment', { comment })}
                  data-testid="review-comment"
                >
                  评论
                </Button>
              </Space>
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal
        title="退回报告"
        open={rejectModal}
        onCancel={() => setRejectModal(false)}
        onOk={() => {
          if (current) {
            onAction?.(current.id, 'reject', { comment: rejectComment })
            setRejectModal(false)
            setRejectComment('')
            setSelected(null)
          }
        }}
        data-testid="reject-modal"
      >
        <p>请填写退回原因,系统将通知报告医师修改:</p>
        <Input.TextArea
          value={rejectComment}
          onChange={(e) => setRejectComment(e.target.value)}
          rows={4}
          placeholder="退回原因..."
          data-testid="reject-reason"
        />
      </Modal>
    </div>
  )
}

export default ReportReviewCenter
