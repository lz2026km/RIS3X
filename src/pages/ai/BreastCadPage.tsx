import React, { useState } from 'react'
import { Card, Table, Button, Tag, Space, Typography, Row, Col, Statistic } from 'antd'
import { Activity, CheckCircle, AlertTriangle } from 'lucide-react'

const { Text } = Typography

interface BreastLesionItem {
  id: string
  type: string
  biRads: string
  malignancyRisk: number
  location: string
}

interface BreastCadResultItem {
  id: string
  studyId: string
  patientName: string
  modality: string
  lesionCount: number
  lesions: BreastLesionItem[]
  overallBiRads: string
  recommendation: string
  status: string
  createdAt: string
}

const mockResults: BreastCadResultItem[] = [
  { id: 'bc-001', studyId: 'STU010', patientName: 'Wang Fang', modality: 'MG', lesionCount: 2, lesions: [{ id: 'l1', type: 'mass', biRads: '4a', malignancyRisk: 0.35, location: '左乳外上象限' }, { id: 'l2', type: 'calcification', biRads: '3', malignancyRisk: 0.12, location: '右乳中央区' }], overallBiRads: '4a', recommendation: '建议活检', status: 'auto', createdAt: '2026-07-28T09:00:00Z' },
]

const biRadsColor: Record<string, string> = { '2': 'green', '3': 'blue', '4a': 'orange', '4b': 'volcano', '4c': 'red', '5': 'red' }

const BreastCadPage: React.FC = () => {
  const [results] = useState(mockResults)

  const columns = [
    { title: '检查号', dataIndex: 'studyId', key: 'studyId' },
    { title: '患者', dataIndex: 'patientName', key: 'patientName' },
    { title: '病灶数', dataIndex: 'lesionCount', key: 'lesionCount' },
    { title: 'BI-RADS', dataIndex: 'overallBiRads', key: 'overallBiRads', render: (v: string) => <Tag color={biRadsColor[v]}>{`BI-RADS ${v}`}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag>{v}</Tag> },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Activity size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>乳腺 AI 检测</span>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="总检测" value={results.length} /></Card></Col>
        <Col span={6}><Card><Statistic title="BI-RADS 4+" value={results.filter(r => ['4a', '4b', '4c', '5'].includes(r.overallBiRads)).length} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="已复核" value={results.filter(r => r.status !== 'auto').length} /></Card></Col>
      </Row>
      <Card>
        <Table rowKey="id" dataSource={results} columns={columns} pagination={false} size="small" />
      </Card>
    </div>
  )
}

export default BreastCadPage
