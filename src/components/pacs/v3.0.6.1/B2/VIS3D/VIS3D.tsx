/**
 * G005 放射RIS系统 v3.0.6.1 - Siemens syngo.via 3D 可视化 (VRT/MIP/MPR)
 * 对标:Siemens syngo.via 3D - 体绘制/MIP/MPR 三模式切换
 */
import React, { useMemo, useState } from 'react'
import { Card, Row, Col, Table, Tag, Statistic, Progress, Tabs, Space, Button, Empty } from 'antd'
import { Box, Layers, GitBranch, Cpu, Clock, MemoryStick } from 'lucide-react'

export type RenderMode = 'VR' | 'MIP' | 'MPR'

export interface VIS3DStudy {
  id: string
  patientName: string
  patientId: string
  bodyPart: string
  mode: RenderMode
  preset: string
  threshold: number
  fps: number
  renderMs: number
  vramMB: number
  status: 'DONE' | 'RUNNING' | 'QUEUED' | 'FAILED'
}

const MOCK_STUDIES: VIS3DStudy[] = [
  { id: 'S20240618-001', patientName: '王建国', patientId: 'P20240618001', bodyPart: '胸部增强', mode: 'VR', preset: 'VESSEL', threshold: 180, fps: 58, renderMs: 1280, vramMB: 1820, status: 'DONE' },
  { id: 'S20240618-002', patientName: '李美芳', patientId: 'P20240618002', bodyPart: '头颅CTA', mode: 'MIP', preset: 'ANGIO', threshold: 220, fps: 45, renderMs: 1640, vramMB: 2140, status: 'DONE' },
  { id: 'S20240618-003', patientName: '张伟', patientId: 'P20240618003', bodyPart: '全脊柱', mode: 'VR', preset: 'BONE', threshold: 350, fps: 38, renderMs: 2150, vramMB: 2860, status: 'RUNNING' },
  { id: 'S20240618-004', patientName: '陈晓敏', patientId: 'P20240618004', bodyPart: '肝脏多期', mode: 'MPR', preset: 'CUSTOM', threshold: 120, fps: 62, renderMs: 920, vramMB: 1480, status: 'DONE' },
  { id: 'S20240618-005', patientName: '刘强', patientId: 'P20240618005', bodyPart: '冠脉CTA', mode: 'MIP', preset: 'CARDIAC', threshold: 260, fps: 50, renderMs: 1520, vramMB: 1980, status: 'QUEUED' },
]

const MODE_META: Record<RenderMode, { color: string; label: string; icon: React.ReactNode }> = {
  VR: { color: 'blue', label: '体绘制', icon: <Box size={12} /> },
  MIP: { color: 'purple', label: 'MIP', icon: <Layers size={12} /> },
  MPR: { color: 'cyan', label: 'MPR', icon: <GitBranch size={12} /> },
}

const STATUS_META: Record<VIS3DStudy['status'], { color: string; label: string }> = {
  DONE: { color: 'green', label: '完成' },
  RUNNING: { color: 'processing', label: '渲染中' },
  QUEUED: { color: 'gold', label: '排队' },
  FAILED: { color: 'red', label: '失败' },
}

export interface VIS3DProps {
  onModeChange?: (mode: RenderMode) => void
  onSelectStudy?: (id: string) => void
}

export const VIS3D: React.FC<VIS3DProps> = ({ onModeChange, onSelectStudy }) => {
  const [mode, setMode] = useState<RenderMode>('VR')

  const stats = useMemo(() => {
    const done = MOCK_STUDIES.filter((s) => s.status === 'DONE')
    const total = MOCK_STUDIES.length
    const avgMs = done.length ? Math.round(done.reduce((s, x) => s + x.renderMs, 0) / done.length) : 0
    const vramTotal = done.reduce((s, x) => s + x.vramMB, 0)
    return { total, done: done.length, avgMs, vramTotal }
  }, [])

  const filtered = useMemo(() => MOCK_STUDIES.filter((s) => s.mode === mode), [mode])

  const columns = [
    {
      title: 'Study ID',
      dataIndex: 'id',
      key: 'id',
      width: 150,
      render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: '患者',
      key: 'patient',
      render: (_: unknown, r: VIS3DStudy) => (
        <Space orientation="vertical" size={0}>
          <span style={{ fontWeight: 600 }}>{r.patientName}</span>
          <span style={{ fontSize: 12, color: '#64748b' }}>{r.patientId}</span>
        </Space>
      ),
    },
    { title: '部位', dataIndex: 'bodyPart', key: 'bodyPart', width: 100 },
    {
      title: '模式',
      dataIndex: 'mode',
      key: 'mode',
      width: 80,
      render: (v: RenderMode) => {
        const m = MODE_META[v]
        return (
          <Tag color={m.color} icon={m.icon}>
            {m.label}
          </Tag>
        )
      },
    },
    { title: '预设', dataIndex: 'preset', key: 'preset', width: 90 },
    {
      title: '阈值',
      dataIndex: 'threshold',
      key: 'threshold',
      width: 80,
      render: (v: number) => `${v} HU`,
    },
    {
      title: '渲染耗时',
      dataIndex: 'renderMs',
      key: 'renderMs',
      width: 100,
      sorter: (a: VIS3DStudy, b: VIS3DStudy) => a.renderMs - b.renderMs,
      render: (v: number) => (
        <span style={{ color: v > 1800 ? '#dc2626' : v > 1200 ? '#f59e0b' : '#16a34a' }}>{v} ms</span>
      ),
    },
    {
      title: '显存',
      dataIndex: 'vramMB',
      key: 'vramMB',
      width: 100,
      render: (v: number) => `${(v / 1024).toFixed(2)} GB`,
    },
    {
      title: 'FPS',
      dataIndex: 'fps',
      key: 'fps',
      width: 80,
      render: (v: number) => <Progress percent={Math.min(100, Math.round((v / 60) * 100))} size="small" format={() => v} />,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: VIS3DStudy['status']) => <Tag color={STATUS_META[v].color}>{STATUS_META[v].label}</Tag>,
    },
  ]

  return (
    <div data-testid="vis3d">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="总渲染次数" value={stats.total} prefix={<Cpu size={14} color="#3b82f6" />} styles={{ content: {  color: '#3b82f6'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="已完成" value={stats.done} suffix={`/ ${stats.total}`} prefix={<Layers size={14} color="#16a34a" />} styles={{ content: {  color: '#16a34a'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="平均渲染耗时" value={stats.avgMs} suffix="ms" prefix={<Clock size={14} color="#f59e0b" />} styles={{ content: {  color: '#f59e0b'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="显存占用" value={(stats.vramTotal / 1024).toFixed(2)} suffix="GB" prefix={<MemoryStick size={14} color="#8b5cf6" />} styles={{ content: {  color: '#8b5cf6'  } }} />
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title={
          <Space>
            <Box size={14} />
            <span>3D 可视化任务队列</span>
            <Tag color="blue">syngo.via 3D</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button size="small">新建渲染</Button>
            <Button size="small" type="primary">导出 STL</Button>
          </Space>
        }
      >
        <Tabs
          size="small"
          activeKey={mode}
          onChange={(k) => {
            setMode(k as RenderMode)
            onModeChange?.(k as RenderMode)
          }}
          items={[
            { key: 'VR', label: <span><Box size={12} /> 体绘制 (VR) ({MOCK_STUDIES.filter((s) => s.mode === 'VR').length})</span> },
            { key: 'MIP', label: <span><Layers size={12} /> MIP ({MOCK_STUDIES.filter((s) => s.mode === 'MIP').length})</span> },
            { key: 'MPR', label: <span><GitBranch size={12} /> MPR ({MOCK_STUDIES.filter((s) => s.mode === 'MPR').length})</span> },
          ]}
        />
        <Table
          size="small"
          rowKey="id"
          dataSource={filtered}
          columns={columns}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无 3D 数据" /> }}
          onRow={(record) => ({
            onClick: () => onSelectStudy?.(record.id),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>
    </div>
  )
}

export default VIS3D
