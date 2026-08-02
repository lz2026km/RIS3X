import React, { useState } from 'react'
import { Card, Table, Button, Tag, Space, Typography, Row, Col, Statistic, message, Modal, Input } from 'antd'
import { AlertTriangle, CheckCircle, Bell, ArrowUp } from 'lucide-react'

const { Text } = Typography
const { TextArea } = Input

interface CriticalAlertItem {
  id: string
  patientName: string
  studyId: string
  alertType: string
  severity: string
  title: string
  description: string
  status: string
  createdAt: string
}

const mockAlerts: CriticalAlertItem[] = [
  { id: 'ca-001', patientName: 'Zhang San', studyId: 'STU001', alertType: 'critical_value', severity: 'emergency', title: '危急值: 血钾 6.8', description: '检验结果超出危急值范围', status: 'active', createdAt: '2026-07-28T10:00:00Z' },
  { id: 'ca-002', patientName: 'Li Si', studyId: 'STU002', alertType: 'unexpected_finding', severity: 'critical', title: '意外发现: 气胸', description: '胸部CT发现左侧气胸', status: 'acknowledged', createdAt: '2026-07-27T14:30:00Z' },
  { id: 'ca-003', patientName: 'Wang Wu', studyId: 'STU003', alertType: 'technical_issue', severity: 'warning', title: '技术问题: 运动伪影', description: '扫描过程中患者移动导致伪影', status: 'resolved', createdAt: '2026-07-26T09:00:00Z' },
]

const severityColor: Record<string, string> = { info: 'blue', warning: 'orange', critical: 'red', emergency: 'volcano' }
const statusColor: Record<string, string> = { active: 'red', acknowledged: 'orange', resolved: 'green', escalated: 'purple' }

const CriticalAlertPage: React.FC = () => {
  const [alerts, setAlerts] = useState(mockAlerts)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<CriticalAlertItem | null>(null)
  const [comment, setComment] = useState('')

  const handleAcknowledge = () => {
    if (!selected) return
    setAlerts(prev => prev.map(a => a.id === selected.id ? { ...a, status: 'acknowledged' } : a))
    setDetailOpen(false)
    message.success('已确认')
  }

  const handleEscalate = () => {
    if (!selected) return
    setAlerts(prev => prev.map(a => a.id === selected.id ? { ...a, status: 'escalated' } : a))
    setDetailOpen(false)
    message.success('已上报')
  }

  const columns = [
    { title: '患者', dataIndex: 'patientName', key: 'patientName' },
    { title: '告警类型', dataIndex: 'alertType', key: 'alertType' },
    { title: '严重度', dataIndex: 'severity', key: 'severity', render: (v: string) => <Tag color={severityColor[v]}>{v}</Tag> },
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag> },
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
    { title: '操作', key: 'action', render: (_: unknown, r: CriticalAlertItem) => (
      <Space>
        {r.status === 'active' && <Button size="small" type="primary" icon={<CheckCircle size={14} />} onClick={() => { setSelected(r); setDetailOpen(true) }}>处理</Button>}
        {r.status === 'active' && <Button size="small" icon={<ArrowUp size={14} />} onClick={() => { setSelected(r); handleEscalate() }}>上报</Button>}
      </Space>
    )},
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <AlertTriangle size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>危急值告警</span>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="总告警" value={alerts.length} prefix={<Bell size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="待处理" value={alerts.filter(a => a.status === 'active').length} styles={{ content: {  color: '#ff4d4f'  } }} /></Card></Col>
        <Col span={6}><Card><Statistic title="已确认" value={alerts.filter(a => a.status === 'acknowledged').length} /></Card></Col>
        <Col span={6}><Card><Statistic title="已解决" value={alerts.filter(a => a.status === 'resolved').length} styles={{ content: {  color: '#52c41a'  } }} /></Card></Col>
      </Row>
      <Card>
        <Table rowKey="id" dataSource={alerts} columns={columns} pagination={false} size="small" />
      </Card>
      <Modal title="处理告警" open={detailOpen} onOk={handleAcknowledge} onCancel={() => setDetailOpen(false)} width={600}>
        {selected && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Text strong>标题: </Text><Text>{selected.title}</Text><br />
              <Text strong>描述: </Text><Text>{selected.description}</Text><br />
              <Text strong>严重度: </Text><Tag color={severityColor[selected.severity]}>{selected.severity}</Tag>
            </Card>
            <TextArea placeholder="处理备注" rows={3} value={comment} onChange={e => setComment(e.target.value)} />
          </>
        )}
      </Modal>
    </div>
  )
}

export default CriticalAlertPage
