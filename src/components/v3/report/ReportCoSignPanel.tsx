/**
 * G005 放射RIS系统 v3.0.2.2 - 报告双签工作流
 * 对标:美国 ACGME / 中国 JCI 评审要求
 *
 * 流程:住院医师书写 → 主治审核 → 主任签发
 * 状态机:DRAFT → SIGNED_BY_RESIDENT → REVIEWED → SIGNED_BY_DIRECTOR → PUBLISHED
 */
import React, { useState, useMemo, useCallback } from 'react'
import { Card, Steps, Tag, Space, Button, Timeline, Empty, Modal, Input, Alert, Statistic, Row, Col, message } from 'antd'
import { CheckCircle, Clock, User, Shield, Award, AlertCircle, FileSignature, Send, RotateCcw } from 'lucide-react'

export type CoSignState = 'DRAFT' | 'SIGNED_BY_RESIDENT' | 'REVIEWED' | 'SIGNED_BY_DIRECTOR' | 'PUBLISHED' | 'REJECTED'

export interface CoSignEvent {
  id: string
  state: CoSignState
  actor: string
  actorRole: 'RESIDENT' | 'ATTENDING' | 'DIRECTOR' | 'ADMIN'
  at: string
  comment?: string
  /** 签名 hash(SHA-256 of signature image + timestamp) */
  signatureHash?: string
  /** 签名时间(微秒) */
  signatureAt?: string
  /** 签名 IP */
  ip?: string
}

export interface ReportCoSignPanelProps {
  reportId: string
  /** 初始状态(通常为 DRAFT 或 SIGNED_BY_RESIDENT) */
  initialState: CoSignState
  /** 当前医师 */
  currentUser: string
  currentRole: 'RESIDENT' | 'ATTENDING' | 'DIRECTOR' | 'ADMIN'
  /** 事件历史 */
  events: CoSignEvent[]
  /** 签发回调 */
  onSign?: (action: 'sign' | 'reject' | 'publish', comment?: string) => void
}

const STATE_META: Record<CoSignState, { color: string; label: string; step: number }> = {
  DRAFT: { color: 'default', label: '草稿', step: 0 },
  SIGNED_BY_RESIDENT: { color: 'blue', label: '住院医师已签', step: 1 },
  REVIEWED: { color: 'gold', label: '主治已审', step: 2 },
  SIGNED_BY_DIRECTOR: { color: 'purple', label: '主任已签', step: 3 },
  PUBLISHED: { color: 'green', label: '已发布', step: 4 },
  REJECTED: { color: 'red', label: '已退回', step: 0 },
}

const ROLE_META: Record<CoSignEvent['actorRole'], { color: string; label: string; icon: React.ReactNode }> = {
  RESIDENT: { color: 'cyan', label: '住院医师', icon: <User size={12} /> },
  ATTENDING: { color: 'blue', label: '主治', icon: <Shield size={12} /> },
  DIRECTOR: { color: 'magenta', label: '主任', icon: <Award size={12} /> },
  ADMIN: { color: 'red', label: '管理员', icon: <Shield size={12} /> },
}

const STATE_FLOW: CoSignState[] = ['DRAFT', 'SIGNED_BY_RESIDENT', 'REVIEWED', 'SIGNED_BY_DIRECTOR', 'PUBLISHED']

/** 简化 SHA-256 hash */
async function sha256(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(input)
    const buf = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  return 'mock-' + Date.now().toString(36)
}

export const ReportCoSignPanel: React.FC<ReportCoSignPanelProps> = ({
  reportId,
  initialState,
  currentUser,
  currentRole,
  events,
  onSign,
}) => {
  const [signModal, setSignModal] = useState<{ action: 'sign' | 'reject' | 'publish' } | null>(null)
  const [comment, setComment] = useState('')
  const [signing, setSigning] = useState(false)

  const stateMeta = STATE_META[initialState]
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.at.localeCompare(b.at)),
    [events]
  )

  // 当前可执行的操作
  const canSign = useMemo(() => {
    if (initialState === 'PUBLISHED' || initialState === 'REJECTED') return false
    if (initialState === 'DRAFT' && currentRole === 'RESIDENT') return 'sign'
    if (initialState === 'SIGNED_BY_RESIDENT' && currentRole === 'ATTENDING') return 'sign'
    if (initialState === 'REVIEWED' && currentRole === 'DIRECTOR') return 'sign'
    if (initialState === 'SIGNED_BY_DIRECTOR' && currentRole === 'DIRECTOR') return 'publish'
    if (currentRole === 'ADMIN') return 'sign'
    return false
  }, [initialState, currentRole])

  const handleSign = useCallback(async () => {
    if (!signModal) return
    setSigning(true)
    try {
      const hash = await sha256(`${currentUser}|${signModal.action}|${Date.now()}|${reportId}`)
      void message.success(`签名 hash:${hash.slice(0, 8)}...`)
      onSign?.(signModal.action, comment)
      setSignModal(null)
      setComment('')
    } finally {
      setSigning(false)
    }
  }, [signModal, currentUser, reportId, comment, onSign])

  return (
    <Card
      data-testid="report-co-sign-panel"
      size="small"
      title={
        <Space>
          <FileSignature size={16} color="#1e3a5f" />
          <span>双签工作流</span>
          <Tag color={stateMeta.color} data-testid="rcsp-state">
            {stateMeta.label}
          </Tag>
        </Space>
      }
      extra={
        canSign ? (
          <Space>
            <Button
              size="small"
              danger
              icon={<RotateCcw size={12} />}
              onClick={() => setSignModal({ action: 'reject' })}
              data-testid="rcsp-reject"
            >
              退回
            </Button>
            <Button
              size="small"
              type="primary"
              icon={canSign === 'publish' ? <Send size={12} /> : <CheckCircle size={12} />}
              onClick={() => setSignModal({ action: canSign === 'publish' ? 'publish' : 'sign' })}
              data-testid="rcsp-sign"
            >
              {canSign === 'publish' ? '发布' : '签名'}
            </Button>
          </Space>
        ) : null
      }
    >
      <Steps
        size="small"
        current={stateMeta.step}
        status={initialState === 'REJECTED' ? 'error' : undefined}
        data-testid="rcsp-steps"
        items={STATE_FLOW.map((s, i) => ({
          title: STATE_META[s].label,
          icon: i === stateMeta.step ? <Clock size={14} /> : undefined,
        }))}
      />

      <Row gutter={12} style={{ marginTop: 12, marginBottom: 12 }}>
        <Col span={8}>
          <Statistic
            title="事件总数"
            value={sortedEvents.length}
            prefix={<FileSignature size={14} />}
            styles={{ content: {  fontSize: 16  } }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="当前状态"
            valueRender={() => <Tag color={stateMeta.color}>{stateMeta.label}</Tag>}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="当前用户"
            valueRender={() => (
              <Tag color={ROLE_META[currentRole].color} icon={ROLE_META[currentRole].icon}>
                {currentUser}
              </Tag>
            )}
          />
        </Col>
      </Row>

      {initialState === 'REJECTED' && (
        <Alert
          type="error"
          showIcon
          icon={<AlertCircle size={14} />}
          message="报告已退回"
          description="请检查上一步审核意见并重新提交"
          style={{ marginBottom: 12 }}
        />
      )}

      {!canSign && initialState !== 'PUBLISHED' && initialState !== 'REJECTED' && (
        <Alert
          type="info"
          showIcon
          title={`当前状态 ${stateMeta.label},等待 ${
            initialState === 'DRAFT' ? '住院医师' : initialState === 'SIGNED_BY_RESIDENT' ? '主治' : '主任'
          } 处理`}
          style={{ marginBottom: 12 }}
        />
      )}

      <div data-testid="rcsp-timeline" style={{ maxHeight: 240, overflow: 'auto' }}>
        {sortedEvents.length === 0 ? (
          <Empty description="暂无事件" />
        ) : (
          <Timeline
            items={sortedEvents.map((e) => {
              const m = STATE_META[e.state]
              const r = ROLE_META[e.actorRole]
              return {
                key: e.id,
                color: m.color,
                children: (
                  <div data-testid={`rcsp-event-${e.id}`}>
                    <Space size={4} wrap>
                      <Tag color={m.color}>{m.label}</Tag>
                      <Tag color={r.color} icon={r.icon}>{r.label}</Tag>
                      <User size={10} />
                      <span style={{ fontSize: 12 }}>{e.actor}</span>
                    </Space>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{e.at}</div>
                    {e.comment && (
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                        意见:{e.comment}
                      </div>
                    )}
                    {e.signatureHash && (
                      <div style={{ fontSize: 12, color: '#16a34a', marginTop: 2 }}>
                        签名 hash:{e.signatureHash.slice(0, 16)}...
                      </div>
                    )}
                  </div>
                ),
              }
            })}
          />
        )}
      </div>

      <Modal
        title={signModal?.action === 'reject' ? '退回报告' : signModal?.action === 'publish' ? '发布报告' : '签名'}
        open={!!signModal}
        onCancel={() => setSignModal(null)}
        onOk={handleSign}
        confirmLoading={signing}
        data-testid="rcsp-modal"
      >
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          <div>
            操作人:<Tag color={ROLE_META[currentRole].color}>{currentUser}</Tag>
            <Tag color="blue">{ROLE_META[currentRole].label}</Tag>
          </div>
          <div>
            报告 ID:<code>{reportId}</code>
          </div>
          <Input.TextArea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder={signModal?.action === 'reject' ? '请填写退回原因' : '请填写意见(选填)'}
            data-testid="rcsp-comment"
          />
        </Space>
      </Modal>
    </Card>
  )
}

export default ReportCoSignPanel
