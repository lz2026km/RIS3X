/**
 * G005 放射RIS系统 v3.0.2.2 - 危急值实时确认面板
 * 支持 WebSocket 实时推送确认状态
 */
import React, { useMemo } from 'react'
import { Card, Tag, Space, Button, Badge, Statistic, Row, Col, List, Empty } from 'antd'
import { Wifi, WifiOff, CheckCircle, Bell, Activity } from 'lucide-react'

export interface CriticalLiveEvent {
  id: string
  type: 'NEW' | 'ACK' | 'ESCALATE' | 'CLOSE'
  criticalId: string
  at: string
  actor?: string
  detail?: string
}

export interface CriticalValueLive {
  id: string
  patientName: string
  patientId: string
  finding: string
  category: 'LIFE_THREATENING' | 'URGENT' | 'IMPORTANT'
  triggeredAt: string
  acker?: string
  ackedAt?: string
}

export interface CriticalValueAcknowledgmentProps {
  live: CriticalValueLive[]
  events: CriticalLiveEvent[]
  /** WebSocket 连接状态 */
  connected: boolean
  /** 当前用户 */
  currentUser: string
  /** 确认回调 */
  onAck?: (criticalId: string) => void
  /** 升级回调 */
  onEscalate?: (criticalId: string) => void
}

export const CriticalValueAcknowledgment: React.FC<CriticalValueAcknowledgmentProps> = ({
  live,
  events,
  connected,
  currentUser: _currentUser,
  onAck,
  onEscalate,
}) => {
  const stats = useMemo(() => {
    const acked = live.filter((c) => c.acker)
    return {
      total: live.length,
      acked: acked.length,
      pending: live.length - acked.length,
      avgAckTime: 0, // 简化
    }
  }, [live])

  return (
    <Card
      data-testid="critical-value-ack"
      size="small"
      title={
        <Space>
          <Activity size={16} color="#dc2626" />
          <span>危急值实时确认</span>
          <Badge
            status={connected ? 'success' : 'default'}
            text={
              <Space size={4}>
                {connected ? <Wifi size={10} color="#16a34a" /> : <WifiOff size={10} color="#94a3b8" />}
                <span style={{ fontSize: 12 }}>{connected ? '已连接' : '已断开'}</span>
              </Space>
            }
          />
        </Space>
      }
    >
      <Row gutter={8} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Statistic title="待确认" value={stats.pending} styles={{ content: {  color: '#dc2626', fontSize: 16  } }} />
        </Col>
        <Col span={6}>
          <Statistic title="已确认" value={stats.acked} styles={{ content: {  color: '#16a34a', fontSize: 16  } }} />
        </Col>
        <Col span={6}>
          <Statistic title="总事件" value={stats.total} styles={{ content: {  fontSize: 16  } }} />
        </Col>
        <Col span={6}>
          <Statistic title="WS 状态" value={connected ? '✓' : '×'} styles={{ content: {  color: connected ? '#16a34a' : '#dc2626', fontSize: 16  } }} />
        </Col>
      </Row>

      <div data-testid="cva-live" style={{ maxHeight: 240, overflow: 'auto', marginBottom: 8 }}>
        {live.length === 0 ? (
          <Empty description="无活跃危急值" />
        ) : (
          <List
            size="small"
            dataSource={live}
            renderItem={(c) => (
              <List.Item
                key={c.id}
                data-testid={`cva-item-${c.id}`}
                actions={[
                  c.acker ? (
                    <Tag color="green" icon={<CheckCircle size={10} />} data-testid={`cva-acked-${c.id}`}>
                      {c.acker} {c.ackedAt}
                    </Tag>
                  ) : (
                    <Space>
                      <Button
                        size="small"
                        type="primary"
                        onClick={() => onAck?.(c.id)}
                        data-testid={`cva-ack-${c.id}`}
                      >
                        确认
                      </Button>
                      <Button
                        size="small"
                        danger
                        onClick={() => onEscalate?.(c.id)}
                        data-testid={`cva-esc-${c.id}`}
                      >
                        升级
                      </Button>
                    </Space>
                  ),
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Tag color={c.category === 'LIFE_THREATENING' ? 'red' : c.category === 'URGENT' ? 'orange' : 'gold'}>
                        {c.category}
                      </Tag>
                      <span style={{ fontSize: 13 }}>{c.patientName}</span>
                      <Tag>{c.patientId}</Tag>
                    </Space>
                  }
                  description={
                    <div>
                      <div style={{ fontSize: 12 }}>{c.finding}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>触发:{c.triggeredAt}</div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>

      <div data-testid="cva-event-stream" style={{ maxHeight: 120, overflow: 'auto', borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
          <Bell size={10} /> 事件流(最近 10 条)
        </div>
        {events.slice(0, 10).map((e) => (
          <div
            key={e.id}
            data-testid={`cva-event-${e.id}`}
            style={{ fontSize: 12, padding: 2 }}
          >
            <Tag color={e.type === 'NEW' ? 'red' : e.type === 'ACK' ? 'green' : e.type === 'ESCALATE' ? 'orange' : 'default'} style={{ fontSize: 12 }}>
              {e.type}
            </Tag>
            <span style={{ color: '#94a3b8' }}>{e.at}</span>
            {e.actor && <span style={{ marginLeft: 4 }}>· {e.actor}</span>}
            {e.detail && <span style={{ marginLeft: 4, color: '#475569' }}>{e.detail}</span>}
          </div>
        ))}
      </div>
    </Card>
  )
}

export default CriticalValueAcknowledgment
