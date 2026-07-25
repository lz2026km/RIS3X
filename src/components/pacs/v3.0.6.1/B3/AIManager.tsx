/**
 * G005 放射RIS系统 v3.0.6.1 - Philips IntelliSpace AI Manager
 * AI 算法编排 (肺结节 / 乳腺 / 骨折 / Covid)
 */
import React, { useMemo, useState } from 'react'
import { Card, Row, Col, Tag, Statistic, Table, Space, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Brain, Zap, CheckCircle, AlertCircle } from 'lucide-react'

export type AIModelStatus = '在线' | '训练中' | '灰度' | '下线'

export interface AIModelRef {
  id: string
  name: string
  category: string
  accuracy: number
  inferenceMs: number
  version: string
  status: AIModelStatus
  vendor: string
}

const MOCK_MODELS: AIModelRef[] = [
  { id: 'M001', name: '肺结节检测', category: '肺结节', accuracy: 0.962, inferenceMs: 1820, version: 'v3.2.1', status: '在线', vendor: 'Philips' },
  { id: 'M002', name: '乳腺肿块 BI-RADS', category: '乳腺', accuracy: 0.934, inferenceMs: 2150, version: 'v2.8.0', status: '在线', vendor: 'Philips' },
  { id: 'M003', name: '肋骨骨折定位', category: '骨折', accuracy: 0.918, inferenceMs: 1340, version: 'v1.6.4', status: '灰度', vendor: 'Philips' },
  { id: 'M004', name: 'Covid-19 肺实变', category: 'Covid', accuracy: 0.901, inferenceMs: 1980, version: 'v2.1.0', status: '训练中', vendor: 'Philips' },
  { id: 'M005', name: '气胸量化评估', category: '肺结节', accuracy: 0.945, inferenceMs: 1120, version: 'v1.9.2', status: '在线', vendor: 'Philips' },
]

const STATUS_META: Record<AIModelStatus, { color: string }> = {
  在线: { color: 'green' },
  训练中: { color: 'blue' },
  灰度: { color: 'orange' },
  下线: { color: 'default' },
}

export interface AIManagerProps {
  models?: AIModelRef[]
}

export const AIManager: React.FC<AIManagerProps> = ({ models = MOCK_MODELS }) => {
  const [list] = useState<AIModelRef[]>(models)

  const stats = useMemo(() => {
    const total = list.length
    const online = list.filter((m) => m.status === '在线').length
    const avgAcc = total ? list.reduce((s, m) => s + m.accuracy, 0) / total : 0
    const avgInf = total ? list.reduce((s, m) => s + m.inferenceMs, 0) / total : 0
    return { total, online, avgAcc, avgInf }
  }, [list])

  const columns: ColumnsType<AIModelRef> = [
    { title: '模型', dataIndex: 'name', width: 150 },
    {
      title: '类别', dataIndex: 'category', width: 90,
      render: (v: string) => <Tag color="purple">{v}</Tag>,
    },
    {
      title: '准确率', dataIndex: 'accuracy', width: 100,
      render: (v: number) => (
        <Tag color={v >= 0.95 ? 'green' : v >= 0.9 ? 'blue' : 'orange'}>{(v * 100).toFixed(1)}%</Tag>
      ),
    },
    {
      title: '推理时间', dataIndex: 'inferenceMs', width: 110,
      render: (v: number) => `${v} ms`,
    },
    { title: '版本', dataIndex: 'version', width: 90 },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (v: AIModelStatus) => <Tag color={STATUS_META[v].color}>{v}</Tag>,
    },
    { title: '厂商', dataIndex: 'vendor', width: 80 },
  ]

  return (
    <div data-testid="ai-manager">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="模型总数" value={stats.total} prefix={<Brain size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="在线模型"
              value={stats.online}
              prefix={<CheckCircle size={14} color="#16a34a" />}
              valueStyle={{ color: '#16a34a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="平均准确率"
              value={stats.avgAcc * 100}
              precision={1}
              suffix="%"
              prefix={<Zap size={14} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="平均推理时间"
              value={stats.avgInf}
              precision={0}
              suffix="ms"
              prefix={<AlertCircle size={14} color="#f59e0b" />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title={
          <Space>
            <Brain size={14} />
            <span>Philips AI 算法编排</span>
            <Tag color="blue">IntelliSpace AI</Tag>
          </Space>
        }
      >
        <Table<AIModelRef>
          size="small"
          rowKey="id"
          columns={columns}
          dataSource={list}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无 AI 模型" /> }}
        />
      </Card>
    </div>
  )
}

export default AIManager