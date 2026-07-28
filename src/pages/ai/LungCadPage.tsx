import React, { useState } from 'react'
import { Card, Table, Button, Tag, Space, Typography, Row, Col, Statistic, message, Modal, Input, Select } from 'antd'
import { Crosshair, CheckCircle, Activity, AlertTriangle } from 'lucide-react'

const { Text } = Typography
const { TextArea } = Input

interface LungNodule {
  id: string
  diameter: number
  density: string
  malignancyRisk: number
  location: string
}

interface LungCadResultItem {
  id: string
  studyId: string
  patientName: string
  modality: string
  noduleCount: number
  nodules: LungNodule[]
  overallRisk: string
  recommendation: string
  status: string
  createdAt: string
}

const mockResults: LungCadResultItem[] = [
  { id: 'lc-001', studyId: 'STU001', patientName: 'Zhang San', modality: 'CT', noduleCount: 3, nodules: [{ id: 'n1', diameter: 8, density: 'partSolid', malignancyRisk: 0.35, location: '右肺上叶' }, { id: 'n2', diameter: 4, density: 'groundGlass', malignancyRisk: 0.12, location: '左肺下叶' }, { id: 'n3', diameter: 3, density: 'solid', malignancyRisk: 0.08, location: '右肺中叶' }], overallRisk: 'moderate', recommendation: '建议3个月随访', status: 'auto', createdAt: '2026-07-28T10:00:00Z' },
  { id: 'lc-002', studyId: 'STU002', patientName: 'Li Si', modality: 'CT', noduleCount: 1, nodules: [{ id: 'n4', diameter: 12, density: 'solid', malignancyRisk: 0.72, location: '右肺上叶' }], overallRisk: 'high', recommendation: '建议穿刺活检', status: 'reviewed', createdAt: '2026-07-27T14:30:00Z' },
]

const riskColor: Record<string, string> = { low: 'green', moderate: 'orange', high: 'red', very_high: 'volcano' }

const LungCadPage: React.FC = () => {
  const [results, setResults] = useState(mockResults)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<LungCadResultItem | null>(null)

  const columns = [
    { title: '检查号', dataIndex: 'studyId', key: 'studyId' },
    { title: '患者', dataIndex: 'patientName', key: 'patientName' },
    { title: '模态', dataIndex: 'modality', key: 'modality' },
    { title: '结节数', dataIndex: 'noduleCount', key: 'noduleCount' },
    { title: '整体风险', dataIndex: 'overallRisk', key: 'overallRisk', render: (v: string) => <Tag color={riskColor[v]}>{v}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'confirmed' ? 'green' : v === 'reviewed' ? 'blue' : 'default'}>{v}</Tag> },
    { title: '操作', key: 'action', render: (_: unknown, r: LungCadResultItem) => (
      <Button size="small" type="primary" icon={<Crosshair size={14} />} onClick={() => { setSelected(r); setDetailOpen(true) }}>查看详情</Button>
    )},
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Crosshair size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>肺结节 AI 检测</span>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="总检测" value={results.length} prefix={<Activity size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="高风险" value={results.filter(r => r.overallRisk === 'high' || r.overallRisk === 'very_high').length} prefix={<AlertTriangle size={16} />} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="已复核" value={results.filter(r => r.status === 'reviewed' || r.status === 'confirmed').length} prefix={<CheckCircle size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="总结节数" value={results.reduce((s, r) => s + r.noduleCount, 0)} prefix={<Crosshair size={16} />} /></Card></Col>
      </Row>
      <Card>
        <Table rowKey="id" dataSource={results} columns={columns} pagination={false} size="small" />
      </Card>
      <Modal title={`肺结节检测 - ${selected?.patientName}`} open={detailOpen} onCancel={() => setDetailOpen(false)} width={800} footer={null}>
        {selected && (
          <>
            <Table rowKey="id" dataSource={selected.nodules} size="small" pagination={false} columns={[
              { title: '位置', dataIndex: 'location', key: 'location' },
              { title: '直径(mm)', dataIndex: 'diameter', key: 'diameter' },
              { title: '密度', dataIndex: 'density', key: 'density' },
              { title: '恶性风险', dataIndex: 'malignancyRisk', key: 'malignancyRisk', render: (v: number) => `${(v * 100).toFixed(0)}%` },
            ]} />
            <Card size="small" style={{ marginTop: 16 }}>
              <Text strong>建议: </Text><Text>{selected.recommendation}</Text>
            </Card>
          </>
        )}
      </Modal>
    </div>
  )
}

export default LungCadPage
