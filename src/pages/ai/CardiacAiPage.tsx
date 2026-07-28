import React, { useState } from 'react'
import { Card, Table, Tag, Space, Typography, Row, Col, Statistic } from 'antd'
import { Activity, HeartPulse } from 'lucide-react'

const { Text } = Typography

interface CardiacResultItem {
  id: string
  studyId: string
  patientName: string
  modality: string
  ejectionFraction?: number
  cadRads: string
  stenosisCount: number
  status: string
  createdAt: string
}

const mockResults: CardiacResultItem[] = [
  { id: 'ca-001', studyId: 'STU030', patientName: 'Zhao Jun', modality: 'CT', ejectionFraction: 58, cadRads: '3', stenosisCount: 2, status: 'auto', createdAt: '2026-07-28T08:00:00Z' },
  { id: 'ca-002', studyId: 'STU031', patientName: 'Sun Li', modality: 'CT', ejectionFraction: 42, cadRads: '4', stenosisCount: 3, status: 'reviewed', createdAt: '2026-07-27T15:00:00Z' },
]

const cadRadsColor: Record<string, string> = { '0': 'green', '1': 'green', '2': 'blue', '3': 'orange', '4': 'red', '5': 'volcano' }

const CardiacAiPage: React.FC = () => {
  const [results] = useState(mockResults)

  const columns = [
    { title: '检查号', dataIndex: 'studyId', key: 'studyId' },
    { title: '患者', dataIndex: 'patientName', key: 'patientName' },
    { title: 'EF(%)', dataIndex: 'ejectionFraction', key: 'ef', render: (v?: number) => v != null ? `${v}%` : '-' },
    { title: 'CAD-RADS', dataIndex: 'cadRads', key: 'cadRads', render: (v: string) => <Tag color={cadRadsColor[v]}>{`CAD-RADS ${v}`}</Tag> },
    { title: '狭窄数', dataIndex: 'stenosisCount', key: 'stenosisCount' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag>{v}</Tag> },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <HeartPulse size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>心脏 AI 分析</span>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="总分析" value={results.length} /></Card></Col>
        <Col span={6}><Card><Statistic title="CAD-RADS 3+" value={results.filter(r => ['3', '4', '5'].includes(r.cadRads)).length} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="平均EF" value={`${(results.filter(r => r.ejectionFraction).reduce((s, r) => s + (r.ejectionFraction || 0), 0) / results.filter(r => r.ejectionFraction).length || 0).toFixed(1)}%`} /></Card></Col>
      </Row>
      <Card>
        <Table rowKey="id" dataSource={results} columns={columns} pagination={false} size="small" />
      </Card>
    </div>
  )
}

export default CardiacAiPage
