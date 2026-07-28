/**
 * G005 放射RIS系统 v3.0.6.1 - GE Centricity 智能工作列表入口
 * 对标:GE Smart Reading Worklist - 多维度评分排序(紧急度 × 等待 × AI 评分)
 */
import React, { useState, useEffect } from 'react'
import { Card, Table, Statistic, Row, Col, Tag, Progress, Empty } from 'antd'

interface WorklistEntry {
  id: string
  patientName: string
  patientId: string
  modality: string
  bodyPart: string
  state: 'WAITING' | 'IN_READING' | 'PRELIM' | 'FINAL'
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  submittedAt: string
  waitMin: number
  aiScore: number
  hasCritical: boolean
  hasAi: boolean
  radiologist?: string
}

const MOCK_WORKLIST: WorklistEntry[] = [
  { id: 'W001', patientName: '王建国', patientId: 'P20240618001', modality: 'CT', bodyPart: '头颅', state: 'WAITING', priority: 'P0', submittedAt: '2024-06-18 09:00', waitMin: 28, aiScore: 0.94, hasCritical: true, hasAi: true },
  { id: 'W002', patientName: '李美芳', patientId: 'P20240618002', modality: 'CT', bodyPart: '胸部增强', state: 'WAITING', priority: 'P0', submittedAt: '2024-06-18 09:05', waitMin: 23, aiScore: 0.87, hasCritical: false, hasAi: true },
  { id: 'W003', patientName: '张伟', patientId: 'P20240618003', modality: 'MR', bodyPart: '头颅', state: 'IN_READING', priority: 'P1', submittedAt: '2024-06-18 08:50', waitMin: 38, aiScore: 0.76, hasCritical: false, hasAi: true, radiologist: '陈医师' },
  { id: 'W004', patientName: '陈晓敏', patientId: 'P20240618004', modality: 'CT', bodyPart: '腹部三期', state: 'PRELIM', priority: 'P1', submittedAt: '2024-06-18 08:30', waitMin: 58, aiScore: 0.65, hasCritical: false, hasAi: false, radiologist: '陈医师' },
  { id: 'W005', patientName: '刘强', patientId: 'P20240618005', modality: 'DR', bodyPart: '胸部正侧位', state: 'FINAL', priority: 'P3', submittedAt: '2024-06-18 08:00', waitMin: 88, aiScore: 0.21, hasCritical: false, hasAi: false, radiologist: '林医师' },
  { id: 'W006', patientName: '赵丽华', patientId: 'P20240618006', modality: 'CT', bodyPart: '冠脉CTA', state: 'WAITING', priority: 'P2', submittedAt: '2024-06-18 07:30', waitMin: 118, aiScore: 0.55, hasCritical: false, hasAi: true },
  { id: 'W007', patientName: '孙立军', patientId: 'P20240618007', modality: 'MR', bodyPart: '腰椎', state: 'WAITING', priority: 'P2', submittedAt: '2024-06-18 07:10', waitMin: 138, aiScore: 0.48, hasCritical: false, hasAi: false },
]

const PRIORITY_WEIGHT: Record<WorklistEntry['priority'], number> = { P0: 0.4, P1: 0.25, P2: 0.15, P3: 0.05 }
const STATE_META: Record<WorklistEntry['state'], { color: string; label: string }> = {
  WAITING: { color: 'orange', label: '待读' },
  IN_READING: { color: 'blue', label: '读片中' },
  PRELIM: { color: 'cyan', label: '初诊' },
  FINAL: { color: 'green', label: '终审' },
}

function computeFinalScore(item: WorklistEntry): number {
  const waitNorm = Math.min(item.waitMin / 120, 1) * 0.25
  const aiBoost = item.aiScore * 0.2
  const crit = item.hasCritical ? 0.1 : 0
  const ai = item.hasAi ? 0.05 : 0
  const total = PRIORITY_WEIGHT[item.priority] + waitNorm + aiBoost + crit + ai
  return Math.min(total, 1)
}

const SmartWorklist: React.FC = () => {
  const [filterBodyPart, setFilterBodyPart] = useState<string>('ALL')
  const [filterState, setFilterState] = useState<string>('ALL')
  const [filterPriority, setFilterPriority] = useState<string>('ALL')
  const [tick, setTick] = useState<number>(0)

  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 30000)
    return () => window.clearInterval(t)
  }, [])

  const bodyParts = Array.from(new Set(MOCK_WORKLIST.map((m) => m.bodyPart)))

  const filtered = MOCK_WORKLIST.filter((m) => {
    if (filterBodyPart !== 'ALL' && m.bodyPart !== filterBodyPart) return false
    if (filterState !== 'ALL' && m.state !== filterState) return false
    if (filterPriority !== 'ALL' && m.priority !== filterPriority) return false
    return true
  })
    .map((m) => ({ ...m, finalScore: computeFinalScore(m) }))
    .sort((a, b) => b.finalScore - a.finalScore)

  const total = MOCK_WORKLIST.length
  const p0Count = MOCK_WORKLIST.filter((m) => m.priority === 'P0').length
  const waitingCount = MOCK_WORKLIST.filter((m) => m.state === 'WAITING').length
  const avgWait = total ? Math.round(MOCK_WORKLIST.reduce((s, m) => s + m.waitMin, 0) / total) : 0
  const aiCount = MOCK_WORKLIST.filter((m) => m.hasAi).length

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    {
      title: '患者',
      key: 'patient',
      width: 140,
      render: (_: unknown, r: WorklistEntry) => (
        <span>
          <strong>{r.patientName}</strong>
          <Tag style={{ marginLeft: 6 }}>{r.patientId}</Tag>
        </span>
      ),
    },
    {
      title: '检查',
      key: 'exam',
      width: 150,
      render: (_: unknown, r: WorklistEntry) => (
        <Tag color="blue">
          {r.modality} {r.bodyPart}
        </Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (p: WorklistEntry['priority']) => (
        <Tag color={p === 'P0' ? 'red' : p === 'P1' ? 'orange' : p === 'P2' ? 'gold' : 'blue'}>{p}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'state',
      key: 'state',
      width: 90,
      render: (s: WorklistEntry['state']) => <Tag color={STATE_META[s].color}>{STATE_META[s].label}</Tag>,
    },
    {
      title: '等待(分)',
      dataIndex: 'waitMin',
      key: 'waitMin',
      width: 90,
      render: (w: number) => <span style={{ color: w > 60 ? '#dc2626' : '#0f172a', fontWeight: w > 60 ? 600 : 400 }}>{w}</span>,
    },
    {
      title: 'AI 置信度',
      dataIndex: 'aiScore',
      key: 'aiScore',
      width: 110,
      render: (s: number) => (
        <Progress
          percent={Math.round(s * 100)}
          size="small"
          strokeColor={s > 0.8 ? '#dc2626' : s > 0.5 ? '#f59e0b' : '#16a34a'}
        />
      ),
    },
    {
      title: '综合评分',
      key: 'finalScore',
      width: 100,
      render: (_: unknown, r: WorklistEntry & { finalScore: number }) => {
        const score = r.finalScore
        const color = score > 0.8 ? 'red' : score > 0.5 ? 'orange' : 'green'
        return <Tag color={color} style={{ fontWeight: 600 }}>{score.toFixed(2)}</Tag>
      },
    },
    {
      title: '标记',
      key: 'flags',
      width: 100,
      render: (_: unknown, r: WorklistEntry) => (
        <span>
          {r.hasCritical ? <Tag color="red">危急</Tag> : null}
          {r.hasAi ? <Tag color="purple">AI</Tag> : null}
        </span>
      ),
    },
    {
      title: '医师',
      dataIndex: 'radiologist',
      key: 'radiologist',
      width: 100,
      render: (v: string | undefined) => (v ? v : <Tag>未认领</Tag>),
    },
  ]

  return (
    <div data-testid="smart-worklist-root">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={5}>
          <Card size="small">
            <Statistic title="待处理总数" value={total} valueStyle={{ color: '#3b82f6' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="P0 急诊" value={p0Count} valueStyle={{ color: '#dc2626' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="待读" value={waitingCount} valueStyle={{ color: '#f59e0b' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="平均等待(分)" value={avgWait} valueStyle={{ color: avgWait > 60 ? '#dc2626' : '#16a34a' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="AI 已标记" value={aiCount} valueStyle={{ color: '#8b5cf6' }} />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="筛选条件" style={{ marginBottom: 12 }}>
        <Row gutter={12}>
          <Col span={8}>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#475569' }}>部位</div>
            <select
              value={filterBodyPart}
              onChange={(e) => setFilterBodyPart(e.target.value)}
              style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
            >
              <option value="ALL">全部部位</option>
              {bodyParts.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Col>
          <Col span={8}>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#475569' }}>状态</div>
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
            >
              <option value="ALL">全部状态</option>
              <option value="WAITING">待读</option>
              <option value="IN_READING">读片中</option>
              <option value="PRELIM">初诊</option>
              <option value="FINAL">终审</option>
            </select>
          </Col>
          <Col span={8}>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#475569' }}>优先级</div>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
            >
              <option value="ALL">全部优先级</option>
              <option value="P0">P0 急诊</option>
              <option value="P1">P1 紧急</option>
              <option value="P2">P2 较急</option>
              <option value="P3">P3 常规</option>
            </select>
          </Col>
        </Row>
        <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>评分算法: 优先级权重 + 等待时间归一 + AI 置信度 + 危急值 + AI 标记 · 自动刷新 tick={tick}</div>
      </Card>

      <Card size="small" title="智能排序工作列表(评分降序)">
        <Table<WorklistEntry>
          rowKey="id"
          size="small"
          dataSource={filtered}
          columns={columns}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1000 }}
          locale={{ emptyText: <Empty description="暂无工作列表" /> }}
        />
      </Card>
    </div>
  )
}

export default SmartWorklist