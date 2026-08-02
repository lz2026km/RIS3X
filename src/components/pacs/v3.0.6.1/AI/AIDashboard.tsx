/**
 * G005 放射RIS系统 v3.0.6.1 - AI 跨厂商统一仪表板
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Card, Row, Col, Tag, Space, Statistic, Tabs } from 'antd'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, BarChart, Bar } from 'recharts'
import { Brain, Activity, Zap, CheckCircle } from 'lucide-react'

interface AIUsage {
  vendor: string
  calls: number
  success: number
  avgMs: number
}

const MOCK_VENDORS: AIUsage[] = [
  { vendor: 'GE', calls: 248, success: 240, avgMs: 1240 },
  { vendor: 'Siemens', calls: 198, success: 192, avgMs: 980 },
  { vendor: 'Philips', calls: 156, success: 152, avgMs: 1120 },
  { vendor: 'Canon', calls: 84, success: 80, avgMs: 1450 },
  { vendor: 'Internal', calls: 312, success: 308, avgMs: 580 },
]

export const AIDashboard: React.FC = () => {
  const [data] = useState<AIUsage[]>(MOCK_VENDORS)
  const [period] = useState<'day' | 'week'>('day')

  useEffect(() => { void period }, [period])

  const totals = useMemo(() => ({
    calls: data.reduce((s, d) => s + d.calls, 0),
    success: data.reduce((s, d) => s + d.success, 0),
    avgMs: data.length ? Math.round(data.reduce((s, d) => s + d.avgMs, 0) / data.length) : 0,
  }), [data])

  const trend = useMemo(() => Array.from({ length: 24 }).map((_, i) => ({
    hour: `${i.toString().padStart(2, '0')}:00`,
    GE: Math.round(50 + Math.sin(i / 3) * 20 + Math.random() * 10),
    Siemens: Math.round(40 + Math.cos(i / 3) * 15 + Math.random() * 10),
    Philips: Math.round(30 + Math.sin(i / 4) * 12 + Math.random() * 8),
  })), [])

  return (
    <div data-testid="ai-dashboard">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="总调用" value={totals.calls} prefix={<Brain size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="成功率"
              value={Math.round((totals.success / totals.calls) * 100)}
              suffix="%"
              styles={{ content: {  color: '#16a34a'  } }}
              prefix={<CheckCircle size={14} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="平均耗时" value={totals.avgMs} suffix="ms" prefix={<Zap size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="活跃厂商" value={data.length} prefix={<Activity size={14} />} />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="AI 调度" style={{ marginBottom: 12 }}>
        <Tabs
          items={[
            { key: 'trend', label: '调用趋势', children: (
              <div style={{ height: 200 }}>
                <ResponsiveContainer>
                  <LineChart data={trend}>
                    <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="GE" stroke="#dc2626" />
                    <Line type="monotone" dataKey="Siemens" stroke="#3b82f6" />
                    <Line type="monotone" dataKey="Philips" stroke="#16a34a" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) },
            { key: 'bar', label: '厂商对比', children: (
              <div style={{ height: 200 }}>
                <ResponsiveContainer>
                  <BarChart data={data}>
                    <XAxis dataKey="vendor" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="calls" fill="#3b82f6" name="调用次数" />
                    <Bar dataKey="success" fill="#16a34a" name="成功次数" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) },
          ]}
        />
      </Card>

      <Card size="small" title="厂商明细">
        {data.map((d) => (
          <div key={d.vendor} style={{ padding: 6, marginBottom: 6, border: '1px solid #e2e8f0', borderRadius: 4 }}>
            <Space wrap>
              <Tag color="blue">{d.vendor}</Tag>
              <span>调用:{d.calls}</span>
              <span>成功:{d.success}</span>
              <Tag color={d.success / d.calls > 0.95 ? 'green' : 'orange'}>
                {Math.round((d.success / d.calls) * 100)}%
              </Tag>
              <Tag color="purple">{d.avgMs} ms</Tag>
            </Space>
          </div>
        ))}
      </Card>
    </div>
  )
}

export default AIDashboard