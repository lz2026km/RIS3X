import React, { useState } from 'react'
import { Card, Table, Tag, Space, Typography, Row, Col, Statistic, Button } from 'antd'
import { FileText, CheckCircle, Plus } from 'lucide-react'

const { Text } = Typography

interface SrReportItem {
  id: string
  studyInstanceUid: string
  patientName: string
  reportType: string
  title: string
  status: string
  authorName: string
  createdAt: string
}

const mockReports: SrReportItem[] = [
  { id: 'sr-001', studyInstanceUid: '1.2.3.4.5.300', patientName: 'Zhang San', reportType: 'comprehensive', title: 'Chest CT SR Report', status: 'final', authorName: 'Dr. Wang', createdAt: '2026-07-28T12:00:00Z' },
  { id: 'sr-002', studyInstanceUid: '1.2.3.4.5.301', patientName: 'Li Si', reportType: 'measurement', title: 'Cardiac MR Measurement', status: 'draft', authorName: 'Dr. Li', createdAt: '2026-07-27T16:00:00Z' },
]

const typeColor: Record<string, string> = { comprehensive: 'blue', key_object: 'purple', measurement: 'cyan', textural: 'green' }

const SrReportPage: React.FC = () => {
  const [reports] = useState(mockReports)

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id' },
    { title: '患者', dataIndex: 'patientName', key: 'patientName' },
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '类型', dataIndex: 'reportType', key: 'type', render: (v: string) => <Tag color={typeColor[v]}>{v}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'final' ? 'green' : 'orange'}>{v}</Tag> },
    { title: '作者', dataIndex: 'authorName', key: 'author' },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
    { title: '操作', key: 'action', render: () => <Button size="small" icon={<CheckCircle size={14} />}>查看</Button> },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <FileText size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>SR 结构化报告</span>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="总报告" value={reports.length} /></Card></Col>
        <Col span={6}><Card><Statistic title="已定稿" value={reports.filter(r => r.status === 'final').length} /></Card></Col>
        <Col span={6}><Card><Statistic title="草稿" value={reports.filter(r => r.status === 'draft').length} /></Card></Col>
      </Row>
      <Card extra={<Button type="primary" icon={<Plus size={14} />}>新建 SR 报告</Button>}>
        <Table rowKey="id" dataSource={reports} columns={columns} pagination={false} size="small" />
      </Card>
    </div>
  )
}

export default SrReportPage
