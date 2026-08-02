/**
 * G005 放射RIS系统 v3.0.6.1 - 危急值升级规则 (SLA / 升级层级)
 */
import React, { useMemo } from 'react'
import { Card, Table, Tag, Space, Statistic, Row, Col, Progress } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowUp } from 'lucide-react'
import type { CriticalFlowItem } from './CriticalFlow'

export interface EscalationRule {
  level: number
  category: string
  triggerAfterMin: number
  notifyRoles: string[]
  description: string
}

export interface EscalationRulesProps {
  items: CriticalFlowItem[]
  rules?: EscalationRule[]
}

const DEFAULT_RULES: EscalationRule[] = [
  { level: 0, category: 'LIFE_THREATENING', triggerAfterMin: 0, notifyRoles: ['主治医师', '护士长'], description: '即时电话 + APP 推送' },
  { level: 1, category: 'LIFE_THREATENING', triggerAfterMin: 5, notifyRoles: ['科主任'], description: '未在 5 分钟内确认则升级到科主任' },
  { level: 2, category: 'LIFE_THREATENING', triggerAfterMin: 15, notifyRoles: ['医务科', '分管院长'], description: '15 分钟仍未确认则上报医务科' },
  { level: 0, category: 'URGENT', triggerAfterMin: 0, notifyRoles: ['主治医师'], description: 'APP + 短信' },
  { level: 1, category: 'URGENT', triggerAfterMin: 15, notifyRoles: ['科主任'], description: '15 分钟升级' },
]

export const EscalationRules: React.FC<EscalationRulesProps> = ({ items, rules = DEFAULT_RULES }) => {
  const metrics = useMemo(() => {
    const total = items.length
    const escalated = items.filter((i) => i.escalationLevel > 0).length
    return {
      total,
      escalated,
      ratio: total ? Math.round((escalated / total) * 100) : 0,
    }
  }, [items])

  const columns: ColumnsType<EscalationRule> = [
    { title: '层级', dataIndex: 'level', width: 70, render: (l: number) => <Tag color={l === 0 ? 'blue' : l === 1 ? 'orange' : 'red'}>L{l}</Tag> },
    { title: '类别', dataIndex: 'category', width: 130 },
    { title: '触发', dataIndex: 'triggerAfterMin', width: 90, render: (m: number) => `${m} 分钟` },
    {
      title: '通知角色', dataIndex: 'notifyRoles', width: 200,
      render: (roles: string[]) => <Space wrap>{roles.map((r) => <Tag key={r} color="blue">{r}</Tag>)}</Space>,
    },
    { title: '说明', dataIndex: 'description' },
  ]

  return (
    <Card size="small" title={<Space><ArrowUp size={14} />升级规则 (SLA)</Space>} data-testid="escalation-rules">
      <Row gutter={12} style={{ marginBottom: 8 }}>
        <Col span={8}><Statistic title="本月触发" value={metrics.total} styles={{ content: {  fontSize: 14  } }} /></Col>
        <Col span={8}><Statistic title="已升级" value={metrics.escalated} styles={{ content: {  fontSize: 14, color: '#f59e0b'  } }} /></Col>
        <Col span={8}>
          <div style={{ fontSize: 12, color: '#64748b' }}>升级率</div>
          <Progress percent={metrics.ratio} size="small" strokeColor="#f59e0b" />
        </Col>
      </Row>
      <Table<EscalationRule>
        size="small"
        rowKey={(r) => `${r.level}-${r.category}`}
        columns={columns}
        dataSource={rules}
        pagination={false}
      />
    </Card>
  )
}

export default EscalationRules