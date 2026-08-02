/**
 * G005 放射RIS系统 v3.0.6.1 - Siemens AI-Rad Companion Chest CT (胸部CT AI)
 * 对标:Siemens AI-Rad Companion Chest - 肺结节/实性/磨玻璃/钙化 自动检出
 */
import React, { useMemo, useState } from 'react'
import { Card, Row, Col, Table, Tag, Statistic, Progress, Tabs, Space, Badge, Empty } from 'antd'
import { Brain, Eye, Target, ShieldCheck, AlertTriangle } from 'lucide-react'

export type ChestLesionType = 'NODULE' | 'SOLID' | 'GGO' | 'CALCIFICATION' | 'MIXED'

export interface AIRadFinding {
  id: string
  patientName: string
  patientId: string
  studyDate: string
  type: ChestLesionType
  location: string
  size_mm: number
  confidence: number
  lungRads: '2' | '3' | '4A' | '4B' | '4X'
  malignant: number
  reviewed: boolean
}

const MOCK_PATIENTS: AIRadFinding[] = [
  { id: 'F001', patientName: '王建国', patientId: 'P20240618001', studyDate: '2026-06-18', type: 'NODULE', location: '右肺上叶尖后段', size_mm: 8.5, confidence: 0.94, lungRads: '4A', malignant: 0.42, reviewed: false },
  { id: 'F002', patientName: '李美芳', patientId: 'P20240618002', studyDate: '2026-06-18', type: 'GGO', location: '左肺下叶背段', size_mm: 12.3, confidence: 0.88, lungRads: '4A', malignant: 0.38, reviewed: false },
  { id: 'F003', patientName: '张伟', patientId: 'P20240618003', studyDate: '2026-06-18', type: 'SOLID', location: '右肺中叶外侧段', size_mm: 18.0, confidence: 0.96, lungRads: '4B', malignant: 0.72, reviewed: false },
  { id: 'F004', patientName: '陈晓敏', patientId: 'P20240618004', studyDate: '2026-06-17', type: 'CALCIFICATION', location: '右肺中叶', size_mm: 3.2, confidence: 0.85, lungRads: '2', malignant: 0.02, reviewed: true },
  { id: 'F005', patientName: '刘强', patientId: 'P20240618005', studyDate: '2026-06-17', type: 'MIXED', location: '左肺门旁', size_mm: 24.5, confidence: 0.91, lungRads: '4X', malignant: 0.84, reviewed: false },
]

const TYPE_META: Record<ChestLesionType, { color: string; label: string }> = {
  NODULE: { color: 'orange', label: '肺结节' },
  SOLID: { color: 'red', label: '实性' },
  GGO: { color: 'geekblue', label: '磨玻璃' },
  CALCIFICATION: { color: 'gold', label: '钙化' },
  MIXED: { color: 'magenta', label: '混合型' },
}

const RADS_META: Record<AIRadFinding['lungRads'], { color: string; label: string }> = {
  '2': { color: 'green', label: '2 - 良性' },
  '3': { color: 'blue', label: '3 - 可能良性' },
  '4A': { color: 'orange', label: '4A - 可疑' },
  '4B': { color: 'red', label: '4B - 高度可疑' },
  '4X': { color: 'magenta', label: '4X - 危急' },
}

export interface AIRADProps {
  onAccept?: (id: string) => void
  onReject?: (id: string) => void
}

export const AIRAD: React.FC<AIRADProps> = ({ onAccept, onReject }) => {
  const [findings] = useState<AIRadFinding[]>(MOCK_PATIENTS)
  const [activeType, setActiveType] = useState<ChestLesionType | 'ALL'>('ALL')

  const stats = useMemo(() => {
    const total = findings.length
    const highRisk = findings.filter((f) => Number(f.lungRads.charAt(0)) >= 4).length
    const malignant = findings.filter((f) => f.malignant > 0.5).length
    const avgConf = total ? findings.reduce((s, f) => s + f.confidence, 0) / total : 0
    const pending = findings.filter((f) => !f.reviewed).length
    return { total, highRisk, malignant, avgConf, pending }
  }, [findings])

  const filtered = useMemo(() => {
    if (activeType === 'ALL') return findings
    return findings.filter((f) => f.type === activeType)
  }, [findings, activeType])

  const typeCounts = useMemo(() => {
    const map: Record<string, number> = { ALL: findings.length }
    ;(Object.keys(TYPE_META) as ChestLesionType[]).forEach((t) => {
      map[t] = findings.filter((f) => f.type === t).length
    })
    return map
  }, [findings])

  const columns = [
    {
      title: '病灶',
      key: 'patient',
      render: (_: unknown, r: AIRadFinding) => (
        <Space orientation="vertical" size={0}>
          <Space wrap>
            <span style={{ fontWeight: 600 }}>{r.patientName}</span>
            <Badge color={r.reviewed ? 'green' : 'red'} text={r.reviewed ? '已复核' : '待审'} />
          </Space>
          <span style={{ fontSize: 12, color: '#64748b' }}>{r.patientId} · {r.studyDate}</span>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (v: ChestLesionType) => <Tag color={TYPE_META[v].color}>{TYPE_META[v].label}</Tag>,
    },
    { title: '位置', dataIndex: 'location', key: 'location' },
    {
      title: '大小',
      dataIndex: 'size_mm',
      key: 'size_mm',
      width: 80,
      render: (v: number) => `${v} mm`,
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 140,
      render: (v: number) => (
        <Progress percent={Math.round(v * 100)} size="small" strokeColor={v > 0.9 ? '#dc2626' : v > 0.8 ? '#f59e0b' : '#3b82f6'} />
      ),
    },
    {
      title: 'Lung-RADS',
      dataIndex: 'lungRads',
      key: 'lungRads',
      width: 130,
      render: (v: AIRadFinding['lungRads']) => <Tag color={RADS_META[v].color}>{RADS_META[v].label}</Tag>,
    },
    {
      title: '恶性概率',
      dataIndex: 'malignant',
      key: 'malignant',
      width: 100,
      render: (v: number) => (
        <span style={{ color: v > 0.5 ? '#dc2626' : v > 0.2 ? '#f59e0b' : '#16a34a', fontWeight: 600 }}>
          {(v * 100).toFixed(0)}%
        </span>
      ),
    },
  ]

  return (
    <div data-testid="airad">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={5}>
          <Card size="small">
            <Statistic title="AI 检出总数" value={stats.total} prefix={<Eye size={14} color="#3b82f6" />} styles={{ content: {  color: '#3b82f6'  } }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="高风险(4+)" value={stats.highRisk} prefix={<AlertTriangle size={14} color="#dc2626" />} styles={{ content: {  color: '#dc2626'  } }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="恶性概率 > 50%" value={stats.malignant} prefix={<Target size={14} color="#8b5cf6" />} styles={{ content: {  color: '#8b5cf6'  } }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="平均置信度" value={stats.avgConf} precision={2} prefix={<Brain size={14} color="#f59e0b" />} styles={{ content: {  color: '#f59e0b'  } }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="待复核" value={stats.pending} prefix={<ShieldCheck size={14} color="#16a34a" />} styles={{ content: {  color: '#16a34a'  } }} />
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title={
          <Space>
            <Brain size={14} />
            <span>AI-Rad Companion 胸部 CT 检出</span>
            <Tag color="purple">Siemens AI-Rad</Tag>
          </Space>
        }
      >
        <Tabs
          size="small"
          activeKey={activeType}
          onChange={(k) => setActiveType(k as ChestLesionType | 'ALL')}
          items={[
            { key: 'ALL', label: `全部 (${typeCounts.ALL ?? 0})` },
            ...(Object.keys(TYPE_META) as ChestLesionType[]).map((t) => ({
              key: t,
              label: `${TYPE_META[t].label} (${typeCounts[t] ?? 0})`,
            })),
          ]}
        />
        <Table
          size="small"
          rowKey="id"
          dataSource={filtered}
          columns={columns}
          pagination={false}
          locale={{ emptyText: <Empty description="无匹配病灶" /> }}
          onRow={(record) => ({
            onClick: () => {
              if (record.reviewed) onReject?.(record.id)
              else onAccept?.(record.id)
            },
            style: { cursor: 'pointer' },
          })}
        />
      </Card>
    </div>
  )
}

export default AIRAD
