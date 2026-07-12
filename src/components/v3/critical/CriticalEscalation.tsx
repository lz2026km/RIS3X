/**
 * G005 放射RIS系统 v3.0.1 - 危急值超时升级
 * 对标卫宁危急值闭环 — 5/10/15 分钟三级升级
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card, Tag, Space, Button, Steps, Tooltip, Modal, Select, message } from 'antd'
import { Clock, AlertOctagon, Bell, CheckCircle, Phone, MessageSquare, Mail } from 'lucide-react'

export type EsclateLevel = 0 | 1 | 2 | 3

export interface EscalationEvent {
  level: EsclateLevel
  thresholdMin: number
  label: string
  notifiedTo: string
  notifiedAt?: number
  via: 'sms' | 'phone' | 'wechat' | 'email' | 'system'
  resolved: boolean
}

export interface CriticalEscalationConfig {
  initialNotifiedTo: string
  escalationChain: { thresholdMin: number; target: string; via: 'sms' | 'phone' | 'wechat' | 'email' }[]
  onNotify?: (event: EscalationEvent) => void
  onResolve?: () => void
}

export interface CriticalEscalationProps {
  detectedAt: number
  config: CriticalEscalationConfig
  description: string
  onResolved?: (totalMin: number) => void
}

const ICON_BY_VIA = {
  sms: <MessageSquare size={12} />,
  phone: <Phone size={12} />,
  wechat: <MessageSquare size={12} />,
  email: <Mail size={12} />,
  system: <Bell size={12} />,
}

export const CriticalEscalation: React.FC<CriticalEscalationProps> = ({
  detectedAt,
  config,
  description,
  onResolved,
}) => {
  const [now, setNow] = useState(() => Date.now())
  const [resolved, setResolved] = useState(false)
  const [events, setEvents] = useState<EscalationEvent[]>([
    {
      level: 0,
      thresholdMin: 0,
      label: '已发现',
      notifiedTo: config.initialNotifiedTo,
      notifiedAt: detectedAt,
      via: 'system',
      resolved: false,
    },
  ])
  const [ackOpen, setAckOpen] = useState(false)
  const [ackTo, setAckTo] = useState<string | null>(null)
  const lastTriggered = useRef<EsclateLevel>(0)

  const elapsedMin = Math.floor((now - detectedAt) / 60000)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (resolved) return
    for (const stage of config.escalationChain) {
      if (elapsedMin >= stage.thresholdMin && lastTriggered.current < stage.thresholdMin) {
        lastTriggered.current = stage.thresholdMin as EsclateLevel
        const evt: EscalationEvent = {
          level: stage.thresholdMin as EsclateLevel,
          thresholdMin: stage.thresholdMin,
          label: `${stage.thresholdMin} 分钟未确认 → 升级`,
          notifiedTo: stage.target,
          notifiedAt: Date.now(),
          via: stage.via,
          resolved: false,
        }
        setEvents((prev) => [...prev, evt])
        config.onNotify?.(evt)
        message.warning({
          content: `危急值 ${stage.thresholdMin} 分钟未确认,已通过 ${stage.via} 通知 ${stage.target}`,
          duration: 6,
        })
      }
    }
  }, [elapsedMin, resolved, config])

  const handleResolve = useCallback(() => {
    setResolved(true)
    setEvents((prev) => prev.map((e) => ({ ...e, resolved: true })))
    config.onResolve?.()
    onResolved?.(elapsedMin)
    message.success(`危急值已闭环 (${elapsedMin} 分钟)`)
  }, [elapsedMin, config, onResolved])

  const handleAck = useCallback(() => {
    if (!ackTo) return
    setEvents((prev) => prev.map((e) => (e.notifiedTo === ackTo ? { ...e, resolved: true } : e)))
    setAckOpen(false)
    setAckTo(null)
    message.success(`${ackTo} 已确认`)
  }, [ackTo])

  const colorByLevel: Record<EsclateLevel, string> = {
    0: 'blue',
    1: 'orange',
    2: 'red',
    3: 'magenta',
  }

  return (
    <Card
      data-testid="critical-escalation"
      size="small"
      title={
        <Space>
          <AlertOctagon size={16} color="#dc2626" />
          <span>危急值超时升级</span>
          <Tag color={resolved ? 'green' : 'red'}>{resolved ? '已闭环' : '进行中'}</Tag>
        </Space>
      }
      extra={
        !resolved && (
          <Button
            type="primary"
            danger
            size="small"
            icon={<CheckCircle size={12} />}
            onClick={handleResolve}
            data-testid="escalation-resolve"
          >
            标记闭环
          </Button>
        )
      }
    >
      <div style={{ marginBottom: 12, padding: 8, background: '#fef2f2', borderRadius: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#b91c1c' }}>{description}</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          <Clock size={10} style={{ verticalAlign: 'middle' }} /> 已过 {elapsedMin} 分钟
        </div>
      </div>

      <Steps
        direction="vertical"
        size="small"
        current={events.length - 1}
        items={events.map((e) => ({
          title: (
            <Space>
              <Tag color={colorByLevel[e.level]}>{e.label}</Tag>
              {ICON_BY_VIA[e.via]}
              <span style={{ fontSize: 12 }}>{e.notifiedTo}</span>
              {e.resolved && <Tag color="green">已确认</Tag>}
            </Space>
          ),
          description: e.notifiedAt && (
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {new Date(e.notifiedAt).toLocaleString('zh-CN')}
            </div>
          ),
          status: e.resolved ? 'finish' : e.level === events[events.length - 1]?.level ? 'process' : 'finish',
        }))}
      />

      {!resolved && config.escalationChain.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8' }}>
          升级阈值:
          {config.escalationChain.map((s) => (
            <Tag key={s.thresholdMin} color={colorByLevel[s.thresholdMin as EsclateLevel]}>
              {s.thresholdMin}min → {s.target}
            </Tag>
          ))}
        </div>
      )}

      <Modal
        title="手动确认"
        open={ackOpen}
        onCancel={() => setAckOpen(false)}
        onOk={handleAck}
        okText="确认"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>选择已确认的接收人:</div>
          <Select
            data-testid="escalation-ack-select"
            value={ackTo ?? undefined}
            onChange={setAckTo}
            placeholder="选择"
            style={{ width: '100%' }}
            options={events.map((e) => ({ value: e.notifiedTo, label: e.notifiedTo }))}
          />
        </Space>
      </Modal>
    </Card>
  )
}

export default CriticalEscalation
