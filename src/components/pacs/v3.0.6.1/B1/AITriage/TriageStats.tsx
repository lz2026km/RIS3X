/**
 * G005 放射RIS系统 v3.0.6.1 - AI 分诊统计 (分类分布 + 时间趋势)
 */
import React, { useMemo } from 'react'
import { Row, Col, Statistic, Progress } from 'antd'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import type { TriageItem } from './TriageCard'

export interface TriageCategory {
  code: string
  label: string
  color: string
  icon: string
}

export interface TriageStatsProps {
  queue: TriageItem[]
  categories: TriageCategory[]
}

export const TriageStats: React.FC<TriageStatsProps> = ({ queue, categories }) => {
  const data = useMemo(() => {
    return categories.map((c) => {
      const matched = queue.filter((q) => q.category === c.code)
      const avgConf = matched.length ? matched.reduce((s, m) => s + m.confidence, 0) / matched.length : 0
      return { name: c.label, code: c.code, count: matched.length, avgConf: Number(avgConf.toFixed(2)) }
    })
  }, [queue, categories])

  const total = queue.length

  return (
    <div data-testid="triage-stats">
      <Row gutter={8} style={{ marginBottom: 8 }}>
        <Col span={12}>
          <Statistic title="总队列" value={total} styles={{ content: {  fontSize: 16  } }} />
        </Col>
        <Col span={12}>
          <Statistic
            title="高置信度(≥0.85)"
            value={queue.filter((q) => q.confidence >= 0.85).length}
            styles={{ content: {  fontSize: 16, color: '#16a34a'  } }}
          />
        </Col>
      </Row>
      <div style={{ height: 140, marginBottom: 12 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ maxHeight: 200, overflow: 'auto' }}>
        {data.map((d) => (
          <div key={d.code} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span>{d.name}</span>
              <span>{d.count} · 置信 {d.avgConf}</span>
            </div>
            <Progress
              percent={total ? Math.round((d.count / total) * 100) : 0}
              showInfo={false}
              size="small"
              strokeColor={d.count > 0 ? '#3b82f6' : '#cbd5e1'}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default TriageStats