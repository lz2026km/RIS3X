import React, { useState } from 'react'
import { Card, Table, Tag, Space, Typography, Row, Col, Statistic } from 'antd'
import { Globe, Send, CheckCircle, Clock } from 'lucide-react'

const {  } = Typography

interface RemoteReadingItem {
  id: string
  studyId: string
  patientName: string
  modality: string
  referringDoctor: string
  readingDoctor: string
  priority: string
  status: string
  requestedAt: string
  completedAt?: string
}

const mockSessions: RemoteReadingItem[] = [
  { id: 'rr-001', studyId: 'STU050', patientName: '张三', modality: 'CT', referringDoctor: '陈医生', readingDoctor: '王医生', priority: 'urgent', status: 'completed', requestedAt: '2026-07-28T08:00:00Z', completedAt: '2026-07-28T09:30:00Z' },
  { id: 'rr-002', studyId: 'STU051', patientName: '李四', modality: 'MR', referringDoctor: '刘医生', readingDoctor: '李医生', priority: 'routine', status: 'in_progress', requestedAt: '2026-07-28T10:00:00Z' },
  { id: 'rr-003', studyId: 'STU052', patientName: '王五', modality: 'DX', referringDoctor: '陈医生', readingDoctor: '张医生', priority: 'stat', status: 'pending', requestedAt: '2026-07-28T11:00:00Z' },
]

const priorityColor: Record<string, string> = { routine: 'blue', urgent: 'orange', stat: 'red' }
const statusColor: Record<string, string> = { pending: 'default', in_progress: 'processing', completed: 'green', returned: 'red' }

const RemoteReadingPage: React.FC = () => {
  const [sessions] = useState(mockSessions)

  const columns = [
    { title: '检查号', dataIndex: 'studyId', key: 'studyId' },
    { title: '患者', dataIndex: 'patientName', key: 'patientName' },
    { title: '模态', dataIndex: 'modality', key: 'modality', render: (v: string) => <Tag>{v}</Tag> },
    { title: '申请医生', dataIndex: 'referringDoctor', key: 'referring' },
    { title: '阅片医生', dataIndex: 'readingDoctor', key: 'reading' },
    { title: '优先级', dataIndex: 'priority', key: 'priority', render: (v: string) => <Tag color={priorityColor[v]}>{v}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag> },
    { title: '申请时间', dataIndex: 'requestedAt', key: 'requestedAt', render: (v: string) => new Date(v).toLocaleString() },
    { title: '完成时间', dataIndex: 'completedAt', key: 'completedAt', render: (v?: string) => v ? new Date(v).toLocaleString() : '-' },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Globe size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>远程阅片</span>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="总会诊" value={sessions.length} prefix={<Globe size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="进行中" value={sessions.filter(s => s.status === 'in_progress').length} prefix={<Clock size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="已完成" value={sessions.filter(s => s.status === 'completed').length} prefix={<CheckCircle size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="紧急" value={sessions.filter(s => s.priority === 'stat' || s.priority === 'urgent').length} prefix={<Send size={16} />} styles={{ content: {  color: '#ff4d4f'  } }} /></Card></Col>
      </Row>
      <Card>
        <Table rowKey="id" dataSource={sessions} columns={columns} pagination={false} size="small" />
      </Card>
    </div>
  )
}

export default RemoteReadingPage
