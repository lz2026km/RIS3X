/**
 * G005 放射RIS系统 v3.0.6.1 - Philips Tumor Tracking (肿瘤随访 RECIST)
 */
import React from 'react'
import { Card, Table, Tag, Space, Row, Col, Statistic, Button, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts'

export interface TumorLesion {
  id: string
  examAt: string
  sumDiameter_mm: number
  response: 'CR' | 'PR' | 'SD' | 'PD'
}

const MOCK: TumorLesion[] = [
  { id: 'L1', examAt: '2024-01', sumDiameter_mm: 48, response: 'SD' },
  { id: 'L2', examAt: '2024-02', sumDiameter_mm: 42, response: 'PR' },
  { id: 'L3', examAt: '2024-03', sumDiameter_mm: 36, response: 'PR' },
  { id: 'L4', examAt: '2024-04', sumDiameter_mm: 30, response: 'PR' },
  { id: 'L5', examAt: '2024-05', sumDiameter_mm: 28, response: 'PR' },
  { id: 'L6', examAt: '2024-06', sumDiameter_mm: 32, response: 'PD' },
]

export interface TumorTrackingProps {
  lesions?: TumorLesion[]
}

const RESP_META = {
  CR: { color: 'green', label: '完全缓解' },
  PR: { color: 'blue', label: '部分缓解' },
  SD: { color: 'default', label: '稳定' },
  PD: { color: 'red', label: '进展' },
}

export const TumorTracking: React.FC<TumorTrackingProps> = ({ lesions = MOCK }) => {
  const baseline = lesions[0]?.sumDiameter_mm ?? 1
  const current = lesions[lesions.length - 1]?.sumDiameter_mm ?? 0
  const change = ((current - baseline) / baseline) * 100
  const trendUp = change > 0

  const columns: ColumnsType<TumorLesion> = [
    { title: '检查时间', dataIndex: 'examAt', width: 100 },
    { title: '总径 (mm)', dataIndex: 'sumDiameter_mm', width: 110 },
    {
      title: '变化', width: 100,
      render: (_, r, i) => {
        if (i === 0) return <Tag>基线</Tag>
        const prev = lesions[i - 1]
        if (!prev) return null
        const diff = r.sumDiameter_mm - prev.sumDiameter_mm
        const pct = ((diff / prev.sumDiameter_mm) * 100).toFixed(0)
        return (
          <Tag color={diff > 0 ? 'red' : diff < 0 ? 'green' : 'default'}>
            {diff > 0 ? '+' : ''}{diff} mm ({pct}%)
          </Tag>
        )
      },
    },
    {
      title: 'RECIST', dataIndex: 'response', width: 100,
      render: (r: TumorLesion['response']) => <Tag color={RESP_META[r].color}>{RESP_META[r].label}</Tag>,
    },
  ]

  return (
    <div data-testid="tumor-tracking">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}><Card size="small"><Statistic title="随访次数" value={lesions.length} prefix={<Activity size={14} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="基线" value={baseline} suffix="mm" /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="当前" value={current} suffix="mm" /></Card></Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总体变化"
              value={change}
              precision={1}
              suffix="%"
              prefix={trendUp ? <TrendingUp size={14} color="#dc2626" /> : <TrendingDown size={14} color="#16a34a" />}
              valueStyle={{ color: trendUp ? '#dc2626' : '#16a34a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="肿瘤径线趋势 (RECIST 1.1)" style={{ marginBottom: 12 }}>
        <div style={{ height: 200 }}>
          <ResponsiveContainer>
            <LineChart data={lesions.map((l) => ({ date: l.examAt, sum: l.sumDiameter_mm }))}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="sum" stroke="#dc2626" strokeWidth={2} name="肿瘤总径 (mm)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card size="small" title="随访记录">
        <Table<TumorLesion>
          size="small"
          rowKey="id"
          columns={columns}
          dataSource={lesions}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无随访记录" /> }}
        />
        <Space style={{ marginTop: 8 }}>
          <Button size="small" type="primary">新增评估</Button>
          <Button size="small">导出报告</Button>
        </Space>
      </Card>
    </div>
  )
}

export default TumorTracking