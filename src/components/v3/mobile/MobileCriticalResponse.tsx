/**
 * G005 放射RIS系统 v3.0.2 - 移动端 危急值响应
 * 对标:医师手机端 危急值快速响应
 */
import { Card, Tag, Space, Button, Empty, Statistic, Row, Col, Input, Badge, message, Modal, Form, Radio, List } from 'antd'
import { Phone, MessageSquare, MapPin, Clock, User, Bell, AlertOctagon, CheckCircle, Volume2, WifiOff } from 'lucide-react'
import React, { useState, useMemo } from 'react'
import { BellOff } from 'lucide-react'
import { t } from '../../../i18n/appI18n'

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
  LIFE_THREATENING: { color: 'red', label: t('w9e.mobileCritical.catLifeThreatening'), sla: 300, sound: 3 },
  URGENT: { color: 'orange', label: t('w9e.mobileCritical.catUrgent'), sla: 1800, sound: 2 },
  IMPORTANT: { color: 'gold', label: t('w9e.mobileCritical.catImportant'), sla: 3600, sound: 1 },
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
      void message.success(t('w9e.mobileCritical.ackReceived'))
    }
  }

  const handleSendMessage = () => {
    if (selected && messageText) {
      onMessage?.(selected.id, messageText)
      setMessageText('')
      setMessageModal(false)
      void message.success(t('w9e.mobileCritical.sent'))
    }
  }

  return (
    <div
      data-testid="mobile-critical-response"
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: 12,
        background: 'var(--bg-primary)', fontFamily: '-apple-system, sans-serif',
      }}
    >
      {offline && (
        <div style={{ textAlign: 'center', marginBottom: 8 }} data-testid="mob-cv-offline-badge">
          <Tag icon={<WifiOff size={12} />} color="warning">{t('w9e.mobileCritical.offline')}</Tag>
        </div>
      )}
      <Row gutter={8} style={{ marginBottom: 12 }}>
        <Col span={8}>
          <Card>
            <Statistic title={t('w9e.mobileCritical.pendingStat')} value={stats.pending} styles={{ content: {  fontSize: 18, color: '#dc2626'  } }} prefix={<Bell size={14} />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title={t('w9e.mobileCritical.lifeThreatening')} value={stats.lifeThreatening} styles={{ content: {  fontSize: 18, color: '#dc2626'  } }} prefix={<AlertOctagon size={14} />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title={t('w9e.mobileCritical.acked')} value={stats.acked} styles={{ content: {  fontSize: 18, color: '#16a34a'  } }} prefix={<CheckCircle size={14} />} />
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
            {t('w9e.mobileCritical.alertBanner', { count: stats.lifeThreatening })}
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
                  {i.state === 'PENDING' ? t('w9e.mobileCritical.statePending') : i.state === 'NOTIFIED' ? t('w9e.mobileCritical.stateNotified') : i.state === 'ACKED' ? t('w9e.mobileCritical.stateAcked') : t('w9e.mobileCritical.stateCompleted')}
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
        locale={{ emptyText: <Empty image={<BellOff size={48} style={{opacity:0.4}}/>} description={t('w9e.mobileCritical.noCritical')} /> }}
      />

      <Modal
        title={t('w9e.mobileCritical.detailTitle')}
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
                {selected.gender === 'M' ? t('w9e.mobileCritical.male') : t('w9e.mobileCritical.female')} · {t('w9e.mobileCritical.ageSuffix', { age: selected.age })} · {selected.modality} {selected.bodyPart ?? ''}
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                <MapPin size={10} /> {selected.wardLocation ?? t('w9e.mobileCritical.outpatient')} {selected.bedNumber ? t('w9e.mobileCritical.bedSuffix', { bed: selected.bedNumber }) : ''}
              </div>
            </Card>
            <Card size="small" title={t('w9e.mobileCritical.finding')}>
              <div style={{ fontSize: 14, color: '#dc2626', fontWeight: 500 }}>{selected.finding}</div>
            </Card>
            <Card size="small" title={t('w9e.mobileCritical.recipient')}>
              <div style={{ fontSize: 12 }}>
                <strong>{selected.recipientName}</strong> ({selected.recipientDept})
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('w9e.mobileCritical.triggeredPrefix')}{selected.triggeredAt} · {selected.triggeredBy}</div>
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
                {t('w9e.mobileCritical.iAck')}
              </Button>
              <Button
                block
                icon={<Phone size={14} />}
                onClick={() => onCall?.(selected.id)}
                data-testid="mob-cv-call"
              >
                {t('w9e.mobileCritical.oneClickCall')}
              </Button>
              <Button
                block
                icon={<MessageSquare size={14} />}
                onClick={() => setMessageModal(true)}
                data-testid="mob-cv-msg"
              >
                {t('w9e.mobileCritical.sendMessage')}
              </Button>
            </Space>
          </Space>
        )}
      </Modal>

      <Modal
        title={t('w9e.mobileCritical.ackModalTitle')}
        open={ackModal}
        onCancel={() => setAckModal(false)}
        onOk={handleAck}
        data-testid="mob-cv-ack-modal"
      >
        <Form layout="vertical">
          <Form.Item label={t('w9e.mobileCritical.ackPerson')}>
            <Input
              value={ackResponder}
              onChange={(e) => setAckResponder(e.target.value)}
              data-testid="mob-cv-ack-name"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('w9e.mobileCritical.sendMessage')}
        open={messageModal}
        onCancel={() => setMessageModal(false)}
        onOk={handleSendMessage}
        data-testid="mob-cv-msg-modal"
      >
        <Form layout="vertical">
          <Form.Item label={t('w9e.mobileCritical.notifyMethod')}>
            <Radio.Group
              value={notifyMethod}
              onChange={(e) => setNotifyMethod(e.target.value)}
              options={[
                { value: 'CALL', label: t('w9e.mobileCritical.methodCall') },
                { value: 'SMS', label: t('w9e.mobileCritical.methodSms') },
                { value: 'WECHAT', label: t('w9e.mobileCritical.methodWechat') },
              ]}
            />
          </Form.Item>
          <Form.Item label={t('w9e.mobileCritical.msgContent')}>
            <Input.TextArea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={4}
              placeholder={t('w9e.mobileCritical.msgPlaceholder')}
              data-testid="mob-cv-msg-text"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default MobileCriticalResponse
