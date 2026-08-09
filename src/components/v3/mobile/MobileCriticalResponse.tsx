/**
 * G005 放射RIS系统 v3.0.2 - 移动端 危急值响应
 * 对标:医师手机端 危急值快速响应
 */
import { Card, Tag, Space, Button, Empty, Statistic, Row, Col, Input, Badge, message, Modal, Form, Radio, List } from 'antd'
import { Phone, MessageSquare, MapPin, Clock, User, Bell, AlertOctagon, CheckCircle, Volume2, WifiOff } from 'lucide-react'
import React, { useState, useMemo } from 'react'
import { BellOff } from 'lucide-react'

export interface MobileCriticalItem {
  id: string
  patientName: string
  patientId: string
  age: number
  gender: 'M' | 'F'
  modality: string
  bodyPart?: string
  finding: string
  category: 'LIFE_THREATENING' | 'URGENT' | 'IMPORTANT'
  triggeredAt: string
  triggeredBy: string
  state: 'PENDING' | 'NOTIFIED' | 'ACKED' | 'COMPLETED'
  /** 接收方 */
  recipientName: string
  recipientDept: string
  /** 床位 */
  bedNumber?: string
  /** 病情 */
  wardLocation?: string
}

const CATEGORY_META: Record<MobileCriticalItem['category'], { color: string; label: string; sla: number; sound: number }> = {
  LIFE_THREATENING: { color: 'red', label: '危及生命', sla: 300, sound: 3 },
  URGENT: { color: 'orange', label: '紧急', sla: 1800, sound: 2 },
  IMPORTANT: { color: 'gold', label: '重要', sla: 3600, sound: 1 },
}

export interface MobileCriticalResponseProps {
  items: MobileCriticalItem[]
  onAck?: (id: string, responder: string) => void
  onCall?: (id: string) => void
  onMessage?: (id: string, content: string) => void
  /** 当前用户 */
  currentUser: string
  offline?: boolean
}

export const MobileCriticalResponse: React.FC<MobileCriticalResponseProps> = ({ items, onAck, onCall, onMessage, currentUser, offline }) => {
  const [selected, setSelected] = useState<MobileCriticalItem | null>(null)
  const [ackModal, setAckModal] = useState(false)
  const [messageModal, setMessageModal] = useState(false)
  const [ackResponder, setAckResponder] = useState(currentUser)
  const [messageText, setMessageText] = useState('')
  const [notifyMethod, setNotifyMethod] = useState<'CALL' | 'SMS' | 'WECHAT'>('CALL')

  const stats = useMemo(() => {
    return {
      pending: items.filter((i) => i.state === 'PENDING' || i.state === 'NOTIFIED').length,
      lifeThreatening: items.filter((i) => i.category === 'LIFE_THREATENING' && i.state !== 'COMPLETED' && i.state !== 'ACKED').length,
      acked: items.filter((i) => i.state === 'ACKED' || i.state === 'COMPLETED').length,
    }
  }, [items])

  const handleAck = () => {
    if (selected && ackResponder) {
      onAck?.(selected.id, ackResponder)
      setAckModal(false)
      setSelected(null)
      void message.success('已确认接收')
    }
  }

  const handleSendMessage = () => {
    if (selected && messageText) {
      onMessage?.(selected.id, messageText)
      setMessageText('')
      setMessageModal(false)
      void message.success('已发送')
    }
  }

  return (
    <div
      data-testid="mobile-critical-response"
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: 12,
        background: '#f8fafc',
        minHeight: '100vh',
        fontFamily: '-apple-system, sans-serif',
      }}
    >
      {offline && (
        <div style={{ textAlign: 'center', marginBottom: 8 }} data-testid="mob-cv-offline-badge">
          <Tag icon={<WifiOff size={12} />} color="warning">离线模式</Tag>
        </div>
      )}
      <Row gutter={8} style={{ marginBottom: 12 }}>
        <Col span={8}>
          <Card>
            <Statistic title="待响应" value={stats.pending} styles={{ content: {  fontSize: 18, color: '#dc2626'  } }} prefix={<Bell size={14} />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="危及生命" value={stats.lifeThreatening} styles={{ content: {  fontSize: 18, color: '#dc2626'  } }} prefix={<AlertOctagon size={14} />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="已确认" value={stats.acked} styles={{ content: {  fontSize: 18, color: '#16a34a'  } }} prefix={<CheckCircle size={14} />} />
          </Card>
        </Col>
      </Row>

      {stats.lifeThreatening > 0 && (
        <div
          data-testid="mob-critical-alert-banner"
          style={{
            background: '#fee2e2',
            border: '1px solid #dc2626',
            borderRadius: 6,
            padding: 8,
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'pulse 1.5s infinite',
          }}
        >
          <Volume2 size={20} color="#dc2626" />
          <span style={{ fontSize: 14, color: '#dc2626', fontWeight: 600 }}>
            {stats.lifeThreatening} 项危及生命危急值需立即响应
          </span>
        </div>
      )}

      <List
        dataSource={items}
        renderItem={(i) => {
          const c = CATEGORY_META[i.category]
          return (
            <Card
              key={i.id}
              size="small"
              hoverable
              onClick={() => setSelected(i)}
              data-testid={`mob-cv-${i.id}`}
              style={{
                marginBottom: 8,
                borderLeft: `4px solid`,
                borderLeftColor: c.color === 'red' ? '#dc2626' : c.color === 'orange' ? '#ca8a04' : '#ca8a04',
                background: c.color === 'red' ? '#fef2f2' : undefined,
              }}
            >
              <Space size={4} wrap>
                <Badge count={c.label} color={c.color} />
                <Tag color="blue">{i.modality}</Tag>
                {i.bodyPart && <Tag>{i.bodyPart}</Tag>}
                <Tag color={i.state === 'PENDING' ? 'default' : i.state === 'ACKED' ? 'cyan' : i.state === 'COMPLETED' ? 'green' : 'blue'}>
                  {i.state === 'PENDING' ? '待响应' : i.state === 'NOTIFIED' ? '已通知' : i.state === 'ACKED' ? '已确认' : '已完成'}
                </Tag>
              </Space>
              <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
                {i.patientName} <Tag>{i.patientId}</Tag>
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{i.finding}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                <User size={10} /> {i.recipientName} ({i.recipientDept}) · <Clock size={10} /> {i.triggeredAt}
              </div>
            </Card>
          )
        }}
        locale={{ emptyText: <Empty image={<BellOff size={48} style={{opacity:0.4}}/>} description="无危急值" /> }}
      />

      <Modal
        title="危急值详情"
        open={!!selected}
        onCancel={() => setSelected(null)}
        footer={null}
        width={400}
        data-testid="mob-cv-modal"
      >
        {selected && (
          <Space orientation="vertical" size={8} style={{ width: '100%' }}>
            <Card size="small" style={{ background: '#fef2f2' }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{selected.patientName}</div>
              <div style={{ fontSize: 12, color: '#475569' }}>
                {selected.gender === 'M' ? '男' : '女'} · {selected.age}岁 · {selected.modality} {selected.bodyPart ?? ''}
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                <MapPin size={10} /> {selected.wardLocation ?? '门诊'} {selected.bedNumber ? `· 床位 ${selected.bedNumber}` : ''}
              </div>
            </Card>
            <Card size="small" title="发现">
              <div style={{ fontSize: 14, color: '#dc2626', fontWeight: 500 }}>{selected.finding}</div>
            </Card>
            <Card size="small" title="接收方">
              <div style={{ fontSize: 13 }}>
                <strong>{selected.recipientName}</strong> ({selected.recipientDept})
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>触发 {selected.triggeredAt} · {selected.triggeredBy}</div>
            </Card>
            <Space style={{ width: '100%' }} orientation="vertical" size={6}>
              <Button
                type="primary"
                block
                danger
                size="large"
                icon={<CheckCircle size={14} />}
                onClick={() => setAckModal(true)}
                data-testid="mob-cv-ack"
              >
                我已确认
              </Button>
              <Button
                block
                icon={<Phone size={14} />}
                onClick={() => onCall?.(selected.id)}
                data-testid="mob-cv-call"
              >
                一键呼叫
              </Button>
              <Button
                block
                icon={<MessageSquare size={14} />}
                onClick={() => setMessageModal(true)}
                data-testid="mob-cv-msg"
              >
                发送消息
              </Button>
            </Space>
          </Space>
        )}
      </Modal>

      <Modal
        title="确认接收"
        open={ackModal}
        onCancel={() => setAckModal(false)}
        onOk={handleAck}
        data-testid="mob-cv-ack-modal"
      >
        <Form layout="vertical">
          <Form.Item label="确认人">
            <Input
              value={ackResponder}
              onChange={(e) => setAckResponder(e.target.value)}
              data-testid="mob-cv-ack-name"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="发送消息"
        open={messageModal}
        onCancel={() => setMessageModal(false)}
        onOk={handleSendMessage}
        data-testid="mob-cv-msg-modal"
      >
        <Form layout="vertical">
          <Form.Item label="通知方式">
            <Radio.Group
              value={notifyMethod}
              onChange={(e) => setNotifyMethod(e.target.value)}
              options={[
                { value: 'CALL', label: '☎️ 电话' },
                { value: 'SMS', label: '💬 短信' },
                { value: 'WECHAT', label: '📱 微信' },
              ]}
            />
          </Form.Item>
          <Form.Item label="消息内容">
            <Input.TextArea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={4}
              placeholder="请输入消息内容..."
              data-testid="mob-cv-msg-text"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default MobileCriticalResponse
