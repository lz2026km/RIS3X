/**
 * G005 放射RIS系统 v3.0.6.1 - GE Centricity Smart Worklist 主视图
 * 对标:GE Smart Reading Worklist - 多维度评分排序
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Card, Table, Tag, Space, Button, Row, Col, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Filter, RefreshCw, User } from 'lucide-react'
import { WorklistHeader } from './WorklistHeader'
import { FilterPanel, type WorklistFilter } from './FilterPanel'
import { PriorityEngine } from './PriorityEngine'

export interface SmartWorklistItem {
  id: string
  patientName: string
  patientId: string
  modality: string
  bodyPart: string
  state: 'WAITING' | 'IN_READING' | 'PRELIM' | 'FINAL'
  priority: string
  submittedAt: string
  waitMin: number
  radiologist?: string
  isStat?: boolean
  isCritical?: boolean
  hasAi?: boolean
  score?: number
}

const MOCK_ITEMS: SmartWorklistItem[] = [
  { id: 'W001', patientName: '王建国', patientId: 'P20240618001', modality: 'CT', bodyPart: '头颅', state: 'WAITING', priority: 'STAT', submittedAt: '2024-06-18 09:00', waitMin: 24, isStat: true, isCritical: true, hasAi: true },
  { id: 'W002', patientName: '李美芳', patientId: 'P20240618002', modality: 'CT', bodyPart: '胸部', state: 'WAITING', priority: 'STAT', submittedAt: '2024-06-18 09:05', waitMin: 19, isStat: true, hasAi: true },
  { id: 'W003', patientName: '张伟', patientId: 'P20240618003', modality: 'MR', bodyPart: '头颅', state: 'IN_READING', priority: 'URGENT', submittedAt: '2024-06-18 08:50', waitMin: 34, radiologist: '陈医师', hasAi: true },
  { id: 'W004', patientName: '陈晓敏', patientId: 'P20240618004', modality: 'CT', bodyPart: '腹部', state: 'PRELIM', priority: 'URGENT', submittedAt: '2024-06-18 08:30', waitMin: 54, radiologist: '陈医师' },
  { id: 'W005', patientName: '刘强', patientId: 'P20240618005', modality: 'DR', bodyPart: '胸部', state: 'FINAL', priority: 'ROUTINE', submittedAt: '2024-06-18 08:00', waitMin: 84, radiologist: '陈医师' },
  { id: 'W006', patientName: '赵丽华', patientId: 'P20240618006', modality: 'CT', bodyPart: '冠脉', state: 'WAITING', priority: 'ROUTINE', submittedAt: '2024-06-18 07:30', waitMin: 114, hasAi: true },
]

export interface SmartWorklistProps {
  items?: SmartWorklistItem[]
  onClaim?: (id: string) => void
  onOpen?: (id: string) => void
}

export const SmartWorklist: React.FC<SmartWorklistProps> = ({ items, onClaim, onOpen }) => {
  const [data, setData] = useState<SmartWorklistItem[]>(items ?? MOCK_ITEMS)
  const [filter, setFilter] = useState<WorklistFilter>({})
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const engine = useMemo(() => new PriorityEngine(), [])

  useEffect(() => {
    const computed = data.map((d) => ({
      ...d,
      score: engine.compute(d),
    }))
    setData(computed)
  }, [engine])

  const filtered = useMemo(() => {
    let r = data
    if (filter.modality?.length) r = r.filter((x) => filter.modality?.includes(x.modality))
    if (filter.priority?.length) r = r.filter((x) => filter.priority?.includes(x.priority))
    if (filter.state?.length) r = r.filter((x) => filter.state?.includes(x.state))
    if (filter.keyword) {
      const k = filter.keyword.toLowerCase()
      r = r.filter((x) => x.patientName.toLowerCase().includes(k) || x.patientId.toLowerCase().includes(k))
    }
    return r.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  }, [data, filter])

  const stats = useMemo(() => ({
    total: filtered.length,
    stat: filtered.filter((f) => f.priority === 'STAT').length,
    waiting: filtered.filter((f) => f.state === 'WAITING').length,
    avgWait: filtered.length ? Math.round(filtered.reduce((s, f) => s + f.waitMin, 0) / filtered.length) : 0,
  }), [filtered])

  const columns: ColumnsType<SmartWorklistItem> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '患者', dataIndex: 'patientName', width: 130,
      render: (n: string, r) => <Space size={4}><User size={12} />{n}<Tag>{r.patientId}</Tag></Space>,
    },
    {
      title: '检查', dataIndex: 'modality', width: 130,
      render: (m: string, r) => <Tag color="blue">{m} {r.bodyPart}</Tag>,
    },
    {
      title: '优先级', dataIndex: 'priority', width: 80,
      render: (p: string) => (
        <Tag color={p === 'STAT' ? 'red' : p === 'URGENT' ? 'orange' : 'blue'}>{p}</Tag>
      ),
    },
    { title: '状态', dataIndex: 'state', width: 100, render: (s: string) => <Tag>{s}</Tag> },
    {
      title: '等待(分钟)', dataIndex: 'waitMin', width: 100,
      sorter: (a, b) => a.waitMin - b.waitMin,
      render: (m: number) => <span style={{ color: m > 60 ? '#dc2626' : '#0f172a' }}>{m}</span>,
    },
    {
      title: 'AI 评分', dataIndex: 'score', width: 100,
      sorter: (a, b) => (a.score ?? 0) - (b.score ?? 0),
      render: (s: number | undefined) => {
        const score = s ?? 0
        const color = score > 0.8 ? '#dc2626' : score > 0.5 ? '#f59e0b' : '#16a34a'
        return <Tag color={color} style={{ fontWeight: 600 }}>{score.toFixed(2)}</Tag>
      },
    },
    { title: '医师', dataIndex: 'radiologist', width: 100, render: (r?: string) => r ?? <Tag>未认领</Tag> },
    {
      title: '操作', width: 140, fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" type="primary" onClick={() => onClaim?.(r.id)} data-testid={`claim-${r.id}`}>认领</Button>
          <Button size="small" onClick={() => onOpen?.(r.id)}>查看</Button>
        </Space>
      ),
    },
  ]

  return (
    <div data-testid="smart-worklist">
      <WorklistHeader stats={stats} onRefresh={() => setData([...data])} />
      <Row gutter={12} style={{ marginTop: 12 }}>
        <Col span={6}>
          <FilterPanel value={filter} onChange={setFilter} />
        </Col>
        <Col span={18}>
          <Card size="small" title={<Space><Filter size={14} />智能排序工作列表</Space>}
            extra={
              <Space>
                <Tag color="blue">排序:AI 评分↓</Tag>
                <Button size="small" icon={<RefreshCw size={12} />} onClick={() => setData([...data])}>刷新</Button>
              </Space>
            }
          >
            <Table<SmartWorklistItem>
              rowKey="id"
              size="small"
              dataSource={filtered}
              columns={columns}
              rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: <Empty description="暂无工作列表" /> }}
              scroll={{ x: 800 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default SmartWorklist