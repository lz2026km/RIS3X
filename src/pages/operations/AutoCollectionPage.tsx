import React, { useState } from 'react'
import { Card, Table, Switch, Space, Typography, Row, Col, Statistic, Button, Tag, message } from 'antd'
import { Settings, Play, Pause, CheckCircle } from 'lucide-react'

const { Text } = Typography

interface AutoCollectionRuleItem {
  id: string
  name: string
  triggerType: string
  action: string
  enabled: boolean
  lastRun?: string
  nextRun?: string
  status: string
}

const mockRules: AutoCollectionRuleItem[] = [
  { id: 'ac-001', name: 'DICOM 自动归档', triggerType: 'event', action: 'archive', enabled: true, lastRun: '2026-07-28T10:00:00Z', nextRun: '2026-07-28T11:00:00Z', status: 'active' },
  { id: 'ac-002', name: '危急值自动通知', triggerType: 'event', action: 'notify', enabled: true, lastRun: '2026-07-28T09:30:00Z', status: 'active' },
  { id: 'ac-003', name: '每日质量报告', triggerType: 'schedule', action: 'report', enabled: false, lastRun: '2026-07-27T08:00:00Z', status: 'inactive' },
]

const AutoCollectionPage: React.FC = () => {
  const [rules, setRules] = useState(mockRules)

  const handleToggle = (id: string, checked: boolean) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: checked, status: checked ? 'active' : 'inactive' } : r))
    message.success(checked ? '规则已启用' : '规则已禁用')
  }

  const columns = [
    { title: '规则名', dataIndex: 'name', key: 'name' },
    { title: '触发方式', dataIndex: 'triggerType', key: 'triggerType', render: (v: string) => <Tag>{v}</Tag> },
    { title: '动作', dataIndex: 'action', key: 'action', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'active' ? 'green' : 'default'}>{v}</Tag> },
    { title: '上次执行', dataIndex: 'lastRun', key: 'lastRun', render: (v?: string) => v ? new Date(v).toLocaleString() : '-' },
    { title: '启用', key: 'enabled', render: (_: unknown, r: AutoCollectionRuleItem) => <Switch checked={r.enabled} onChange={(c) => handleToggle(r.id, c)} /> },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Settings size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>自动采集管理</span>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="总规则" value={rules.length} /></Card></Col>
        <Col span={6}><Card><Statistic title="已启用" value={rules.filter(r => r.enabled).length} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="已禁用" value={rules.filter(r => !r.enabled).length} /></Card></Col>
      </Row>
      <Card extra={<Button type="primary" icon={<Play size={14} />}>新建规则</Button>}>
        <Table rowKey="id" dataSource={rules} columns={columns} pagination={false} size="small" />
      </Card>
    </div>
  )
}

export default AutoCollectionPage
