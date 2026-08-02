/**
 * G005 放射RIS系统 v3.0.6.1 - GE Centricity AI分诊 (急诊CT 7大类)
 * 对标:GE AI Triage Orchestrator - 自动按影像所见分流到亚专科
 */
import React, { useEffect, useState, useMemo } from 'react'
import { Card, Row, Col, Statistic, Tag, Progress, Tabs, Empty, Badge } from 'antd'
import { Brain, AlertTriangle, Activity, Zap, Users } from 'lucide-react'
import { TriageCard, type TriageItem } from './TriageCard'
import { TriageQueue } from './TriageQueue'
import { TriageStats } from './TriageStats'

const MOCK_CATEGORIES = [
  { code: 'STROKE', label: '脑卒中', color: 'red', icon: '🧠' },
  { code: 'PE', label: '肺栓塞', color: 'volcano', icon: '🫁' },
  { code: 'TRAUMA', label: '多发伤', color: 'orange', icon: '🩻' },
  { code: 'AAA', label: '主动脉夹层', color: 'magenta', icon: '❤️' },
  { code: 'HEMORRHAGE', label: '脑出血', color: 'purple', icon: '🩸' },
  { code: 'FRACTURE', label: '骨折', color: 'gold', icon: '🦴' },
  { code: 'OTHER', label: '其他', color: 'blue', icon: '📋' },
]

const MOCK_QUEUE: TriageItem[] = [
  { id: 'T001', patientName: '王建国', patientId: 'P20240618001', modality: 'CT', bodyPart: '头颅', category: 'STROKE', confidence: 0.94, arrivedAt: '2024-06-18 09:12', priority: 'STAT', aiFlag: true },
  { id: 'T002', patientName: '李美芳', patientId: 'P20240618002', modality: 'CT', bodyPart: '胸部增强', category: 'PE', confidence: 0.87, arrivedAt: '2024-06-18 09:18', priority: 'STAT', aiFlag: true },
  { id: 'T003', patientName: '张伟', patientId: 'P20240618003', modality: 'CT', bodyPart: '全身', category: 'TRAUMA', confidence: 0.91, arrivedAt: '2024-06-18 09:22', priority: 'STAT', aiFlag: true },
  { id: 'T004', patientName: '陈晓敏', patientId: 'P20240618004', modality: 'CT', bodyPart: '头颅', category: 'HEMORRHAGE', confidence: 0.96, arrivedAt: '2024-06-18 09:28', priority: 'STAT', aiFlag: true },
  { id: 'T005', patientName: '刘强', patientId: 'P20240618005', modality: 'CT', bodyPart: '胸腹主动脉', category: 'AAA', confidence: 0.83, arrivedAt: '2024-06-18 09:35', priority: 'URGENT', aiFlag: true },
  { id: 'T006', patientName: '赵丽华', patientId: 'P20240618006', modality: 'CT', bodyPart: '右腕', category: 'FRACTURE', confidence: 0.78, arrivedAt: '2024-06-18 09:42', priority: 'URGENT', aiFlag: false },
  { id: 'T007', patientName: '孙立军', patientId: 'P20240618007', modality: 'CT', bodyPart: '腹部', category: 'OTHER', confidence: 0.45, arrivedAt: '2024-06-18 09:48', priority: 'URGENT', aiFlag: false },
]

export interface AITriageProps {
  onAssign?: (triageId: string, assignee: string) => void
  autoRefreshMs?: number
}

export const AITriage: React.FC<AITriageProps> = ({ onAssign, autoRefreshMs = 30000 }) => {
  const [queue] = useState<TriageItem[]>(MOCK_QUEUE)
  const [activeCategory, setActiveCategory] = useState<string>('ALL')
  const [connected] = useState(true)
  const [lastSync, setLastSync] = useState<string>(new Date().toISOString())

  useEffect(() => {
    const t = setInterval(() => setLastSync(new Date().toISOString()), autoRefreshMs)
    return () => clearInterval(t)
  }, [autoRefreshMs])

  const stats = useMemo(() => {
    const total = queue.length
    const aiFlagged = queue.filter((q) => q.aiFlag).length
    const statCount = queue.filter((q) => q.priority === 'STAT').length
    const avgConfidence = queue.length ? queue.reduce((s, q) => s + q.confidence, 0) / queue.length : 0
    return { total, aiFlagged, statCount, avgConfidence }
  }, [queue])

  const filtered = useMemo(() => {
    if (activeCategory === 'ALL') return queue
    return queue.filter((q) => q.category === activeCategory)
  }, [queue, activeCategory])

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = { ALL: queue.length }
    MOCK_CATEGORIES.forEach((c) => {
      map[c.code] = queue.filter((q) => q.category === c.code).length
    })
    return map
  }, [queue])

  return (
    <div data-testid="ai-triage">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title="待分诊总数"
              value={stats.total}
              prefix={<Users size={14} color="#3b82f6" />}
              styles={{ content: {  color: '#3b82f6', fontSize: 20  } }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title="AI 标记"
              value={stats.aiFlagged}
              prefix={<Brain size={14} color="#8b5cf6" />}
              styles={{ content: {  color: '#8b5cf6', fontSize: 20  } }}
            />
            <Progress percent={Math.round((stats.aiFlagged / Math.max(stats.total, 1)) * 100)} showInfo={false} strokeColor="#8b5cf6" size="small" />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title="STAT 急诊"
              value={stats.statCount}
              prefix={<AlertTriangle size={14} color="#dc2626" />}
              styles={{ content: {  color: '#dc2626', fontSize: 20  } }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title="平均置信度"
              value={stats.avgConfidence}
              precision={2}
              prefix={<Zap size={14} color="#f59e0b" />}
              styles={{ content: {  color: '#f59e0b', fontSize: 20  } }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="WS"
              value={connected ? '在线' : '离线'}
              prefix={<Activity size={14} color={connected ? '#16a34a' : '#dc2626'} />}
              styles={{ content: {  color: connected ? '#16a34a' : '#dc2626', fontSize: 16  } }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col span={16}>
          <Card
            size="small"
            title={
              <span>
                <Brain size={14} /> AI 分诊队列
                <Badge count={stats.total} style={{ backgroundColor: '#3b82f6', marginLeft: 8 }} />
              </span>
            }
            extra={<Tag color="blue">最后同步:{lastSync.slice(11, 19)}</Tag>}
          >
            <Tabs
              size="small"
              activeKey={activeCategory}
              onChange={setActiveCategory}
              items={[
                { key: 'ALL', label: `全部 (${categoryCounts['ALL'] ?? 0})` },
                ...MOCK_CATEGORIES.map((c) => ({
                  key: c.code,
                  label: (
                    <span>
                      {c.icon} {c.label} ({categoryCounts[c.code] ?? 0})
                    </span>
                  ),
                })),
              ]}
            />
            {filtered.length === 0 ? (
              <Empty description="无待分诊" />
            ) : (
              <TriageQueue items={filtered} onAssign={onAssign} />
            )}
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="分类分布">
            <TriageStats queue={queue} categories={MOCK_CATEGORIES} />
          </Card>
          <div style={{ height: 12 }} />
          <Card size="small" title="最近分诊">
            {queue.slice(0, 3).map((q) => (
              <div key={q.id} style={{ marginBottom: 8 }}>
                <TriageCard item={q} compact />
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default AITriage