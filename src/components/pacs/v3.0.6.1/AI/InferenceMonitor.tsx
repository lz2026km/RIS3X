/**
 * G005 放射RIS系统 v3.0.6.1 - AI 推理监控 (实时吞吐/延迟/错误率)
 */
import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Tag, Statistic, Table, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Activity, Zap, AlertTriangle, Server } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts'

export interface InferenceRecord {
  id: string
  algorithm: string
  startedAt: string
  durationMs: number
  status: 'OK' | 'WARN' | 'ERROR'
  gpu: string
}

const MOCK: InferenceRecord[] = [
  { id: 'INF001', algorithm: 'CT-Lung-Nodule', startedAt: '2024-06-18 09:00:12', durationMs: 1240, status: 'OK', gpu: 'A100-0' },
  { id: 'INF002', algorithm: 'MR-Stroke', startedAt: '2024-06-18 09:00:15', durationMs: 980, status: 'OK', gpu: 'A100-1' },
  { id: 'INF003', algorithm: 'Mammo-CAD', startedAt: '2024-06-18 09:00:18', durationMs: 2150, status: 'WARN', gpu: 'A100-0' },
  { id: 'INF004', algorithm: 'CT-Pneumothorax', startedAt: '2024-06-18 09:00:22', durationMs: 780, status: 'OK', gpu: 'A100-1' },
  { id: 'INF005', algorithm: 'Cardiac-Seg', startedAt: '2024-06-18 09:00:25', durationMs: 4200, status: 'ERROR', gpu: 'A100-0' },
]

export interface InferenceMonitorProps {
  records?: InferenceRecord[]
}

export const InferenceMonitor: React.FC<InferenceMonitorProps> = ({ records = MOCK }) => {
  const [data] = useState(records)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 5000)
    return () => clearInterval(t)
  }, [])
  void tick

  const stats = {
    total: data.length,
    ok: data.filter((d) => d.status === 'OK').length,
    warn: data.filter((d) => d.status === 'WARN').length,
    error: data.filter((d) => d.status === 'ERROR').length,
    avgMs: data.length ? Math.round(data.reduce((s, d) => s + d.durationMs, 0) / data.length) : 0,
  }

  const trend = Array.from({ length: 20 }).map((_, i) => ({
    t: i,
    ms: Math.round(800 + Math.sin(i / 2) * 200 + Math.random() * 100),
    qps: Math.round(8 + Math.cos(i / 3) * 3 + Math.random() * 2),
  }))

  const columns: ColumnsType<InferenceRecord> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '算法', dataIndex: 'algorithm', width: 160 },
    { title: 'GPU', dataIndex: 'gpu', width: 80, render: (g: string) => <Tag color="cyan"><Server size={10} />{g}</Tag> },
    { title: '耗时', dataIndex: 'durationMs', width: 80, render: (v: number) => `${v} ms` },
    { title: '状态', dataIndex: 'status', width: 80,
      render: (s: string) => <Tag color={s === 'OK' ? 'green' : s === 'WARN' ? 'orange' : 'red'}>{s}</Tag>,
    },
    { title: '时间', dataIndex: 'startedAt', width: 160 },
  ]

  return (
    <div data-testid="inference-monitor">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={5}><Card size="small"><Statistic title="总推理" value={stats.total} prefix={<Activity size={14} />} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="成功" value={stats.ok} valueStyle={{ color: '#16a34a' }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="告警" value={stats.warn} valueStyle={{ color: '#f59e0b' }} prefix={<AlertTriangle size={14} />} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="错误" value={stats.error} valueStyle={{ color: '#dc2626' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="平均耗时" value={stats.avgMs} suffix="ms" prefix={<Zap size={14} />} /></Card></Col>
      </Row>

      <Card size="small" title="实时趋势 (tick={tick})" style={{ marginBottom: 12 }}>
        <div style={{ height: 200 }}>
          <ResponsiveContainer>
            <LineChart data={trend}>
              <XAxis dataKey="t" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="l" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line yAxisId="l" type="monotone" dataKey="ms" stroke="#3b82f6" name="延迟 (ms)" />
              <Line yAxisId="r" type="monotone" dataKey="qps" stroke="#16a34a" name="QPS" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card size="small" title="推理日志">
        <Table<InferenceRecord>
          size="small"
          rowKey="id"
          columns={columns}
          dataSource={data}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="暂无推理日志" /> }}
        />
      </Card>
    </div>
  )
}

export default InferenceMonitor