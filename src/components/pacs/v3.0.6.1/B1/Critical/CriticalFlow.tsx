/**
 * G005 放射RIS系统 v3.0.6.1 - GE Critical Result 闭环流程
 * 对标:GE Critical Results Workflow - 通知 → 确认 → 闭环
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Card, Row, Col, Steps, Tag, Statistic, Space, Button, Empty } from 'antd'
import { Bell, CheckCircle, Activity } from 'lucide-react'
import { CriticalTimeline } from './CriticalTimeline'
import { CriticalAlert } from './CriticalAlert'
import { EscalationRules } from './EscalationRules'

export interface CriticalFlowItem {
  id: string
  patientName: string
  patientId: string
  finding: string
  category: 'LIFE_THREATENING' | 'URGENT' | 'IMPORTANT'
  triggeredAt: string
  acknowledgedAt?: string
  closedAt?: string
  notifier: string
  acker?: string
  notifMethod: ('PHONE' | 'SMS' | 'APP' | 'EMAIL')[]
  escalationLevel: number
  slaMin: number
}

const MOCK: CriticalFlowItem[] = [
  { id: 'C001', patientName: '王建国', patientId: 'P20240618001', finding: '颅内大动脉闭塞', category: 'LIFE_THREATENING', triggeredAt: '2024-06-18 09:05', acknowledgedAt: '2024-06-18 09:06', closedAt: '2024-06-18 09:35', notifier: 'AI 引擎', acker: '陈医师', notifMethod: ['PHONE', 'APP'], escalationLevel: 0, slaMin: 30 },
  { id: 'C002', patientName: '李美芳', patientId: 'P20240618002', finding: '肺动脉主干栓塞', category: 'LIFE_THREATENING', triggeredAt: '2024-06-18 09:20', acknowledgedAt: '2024-06-18 09:22', notifier: 'AI 引擎', acker: '林医师', notifMethod: ['PHONE'], escalationLevel: 0, slaMin: 30 },
  { id: 'C003', patientName: '张伟', patientId: 'P20240618003', finding: '脾破裂', category: 'URGENT', triggeredAt: '2024-06-18 09:35', notifier: 'AI 引擎', notifMethod: ['APP', 'SMS'], escalationLevel: 1, slaMin: 15 },
  { id: 'C004', patientName: '陈晓敏', patientId: 'P20240618004', finding: '气胸', category: 'URGENT', triggeredAt: '2024-06-18 09:45', notifier: 'AI 引擎', notifMethod: ['APP'], escalationLevel: 0, slaMin: 15 },
]

export interface CriticalFlowProps {
  items?: CriticalFlowItem[]
  onAcknowledge?: (id: string) => void
  onClose?: (id: string) => void
}

export const CriticalFlow: React.FC<CriticalFlowProps> = ({ items, onAcknowledge, onClose }) => {
  const [data] = useState<CriticalFlowItem[]>(items ?? MOCK)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (!selected && data[0]) setSelected(data[0].id)
  }, [data, selected])

  const stats = useMemo(() => {
    return {
      total: data.length,
      open: data.filter((d) => !d.closedAt).length,
      acked: data.filter((d) => d.acknowledgedAt && !d.closedAt).length,
      overdue: data.filter((d) => !d.acknowledgedAt).length,
      avgAckMin: data.filter((d) => d.acknowledgedAt).length
        ? Math.round(
            data.filter((d) => d.acknowledgedAt).reduce((s, d) => {
              const ack = new Date(d.acknowledgedAt!).getTime()
              const tri = new Date(d.triggeredAt).getTime()
              return s + (ack - tri) / 60000
            }, 0) / data.filter((d) => d.acknowledgedAt).length
          )
        : 0,
    }
  }, [data])

  const current = data.find((d) => d.id === selected) ?? data[0]
  const stepIdx = current ? (current.closedAt ? 2 : current.acknowledgedAt ? 1 : 0) : 0

  return (
    <div data-testid="critical-flow">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={5}><Card size="small"><Statistic title="总数" value={stats.total} prefix={<Activity size={14} />} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="待确认" value={stats.overdue} styles={{ content: {  color: '#dc2626'  } }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="已确认未闭环" value={stats.acked} styles={{ content: {  color: '#f59e0b'  } }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="平均确认(分)" value={stats.avgAckMin} styles={{ content: {  color: '#16a34a'  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="已闭环" value={data.filter((d) => d.closedAt).length} styles={{ content: {  color: '#3b82f6'  } }} /></Card></Col>
      </Row>

      <Row gutter={12}>
        <Col span={10}>
          <Card size="small" title="危急值列表">
            {data.length === 0 ? <Empty /> : (
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                {data.map((d) => (
                  <CriticalAlert
                    key={d.id}
                    item={d}
                    selected={d.id === selected}
                    onClick={() => setSelected(d.id)}
                  />
                ))}
              </Space>
            )}
          </Card>
        </Col>
        <Col span={14}>
          <Card size="small" title={current ? `流程:${current.patientName}` : '流程详情'}>
            {current && (
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                <Steps
                  current={stepIdx}
                  items={[
                    { title: '触发', icon: <Bell size={14} />, description: current.triggeredAt },
                    { title: '确认', icon: <CheckCircle size={14} />, description: current.acknowledgedAt ?? '待确认' },
                    { title: '闭环', icon: <CheckCircle size={14} />, description: current.closedAt ?? '未闭环' },
                  ]}
                />
                <CriticalTimeline item={current} />
                <Space>
                  <Tag color="red">{current.category === 'LIFE_THREATENING' ? '危及生命' : current.category === 'URGENT' ? '紧急' : '重要'}</Tag>
                  <Tag color="blue">SLA {current.slaMin} 分钟</Tag>
                  <Tag color="orange">升级层级 L{current.escalationLevel}</Tag>
                </Space>
                <Space>
                  {!current.acknowledgedAt && (
                    <Button type="primary" icon={<CheckCircle size={12} />} onClick={() => onAcknowledge?.(current.id)}>确认</Button>
                  )}
                  {current.acknowledgedAt && !current.closedAt && (
                    <Button type="primary" onClick={() => onClose?.(current.id)}>闭环</Button>
                  )}
                </Space>
              </Space>
            )}
          </Card>
          <div style={{ height: 12 }} />
          <EscalationRules items={data} />
        </Col>
      </Row>
    </div>
  )
}

export default CriticalFlow