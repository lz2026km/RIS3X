import React, { useState } from 'react'
import { Card, Table, Button, Tag, Space, Typography, Row, Col, Statistic } from 'antd'
import { Activity, AlertTriangle, CheckCircle } from 'lucide-react'

const { Text } = Typography

interface FractureFindingItem {
  id: string
  bone: string
  fractureType: string
  location: string
  confidence: number
}

interface FractureCadResultItem {
  id: string
  studyId: string
  patientName: string
  modality: string
  bodyPart: string
  fractureCount: number
  fractures: FractureFindingItem[]
  severity: string
  recommendation: string
  status: string
  createdAt: string
}

const mockResults: FractureCadResultItem[] = [
  { id: 'fc-001', studyId: 'STU020', patientName: 'Chen Ming', modality: 'DX', bodyPart: '踝关节', fractureCount: 1, fractures: [{ id: 'f1', bone: '腓骨', fractureType: 'simple', location: '腓骨远端', confidence: 0.92 }], severity: 'moderate', recommendation: '建议CT进一步评估', status: 'auto', createdAt: '2026-07-28T11:00:00Z' },
  { id: 'fc-002', studyId: 'STU021', patientName: 'Liu Wei', modality: 'CT', bodyPart: '腰椎', fractureCount: 2, fractures: [{ id: 'f2', bone: 'L1椎体', fractureType: 'comminuted', location: 'L1', confidence: 0.88 }, { id: 'f3', bone: 'L2椎体', fractureType: 'simple', location: 'L2', confidence: 0.75 }], severity: 'severe', recommendation: '建议骨科会诊', status: 'reviewed', createdAt: '2026-07-27T16:00:00Z' },
]

const severityColor: Record<string, string> = { mild: 'green', moderate: 'orange', severe: 'red' }

const FractureCadPage: React.FC = () => {
  const [results] = useState(mockResults)

  const columns = [
    { title: '检查号', dataIndex: 'studyId', key: 'studyId' },
    { title: '患者', dataIndex: 'patientName', key: 'patientName' },
    { title: '部位', dataIndex: 'bodyPart', key: 'bodyPart' },
    { title: '骨折数', dataIndex: 'fractureCount', key: 'fractureCount' },
    { title: '严重度', dataIndex: 'severity', key: 'severity', render: (v: string) => <Tag color={severityColor[v]}>{v}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag>{v}</Tag> },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Activity size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>骨折 AI 检测</span>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="总检测" value={results.length} /></Card></Col>
        <Col span={6}><Card><Statistic title="严重骨折" value={results.filter(r => r.severity === 'severe').length} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="已复核" value={results.filter(r => r.status !== 'auto').length} /></Card></Col>
      </Row>
      <Card>
        <Table rowKey="id" dataSource={results} columns={columns} pagination={false} size="small" />
      </Card>
    </div>
  )
}

export default FractureCadPage
