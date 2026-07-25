/**
 * G005 放射RIS系统 v3.0.6.1 - Canon Vitrea Workspace (高级可视化主工作区)
 * 多平面重建 (MPR) + 体绘制 (VR)
 */
import React, { useMemo, useState } from 'react'
import { Card, Row, Col, Tag, Statistic, Table, Space, Tabs, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Layout, Box, Layers } from 'lucide-react'

export type RenderMode = 'MPR' | 'VR' | 'MIP' | 'SSD'

export interface VitreaStudy {
  id: string
  patient: string
  modality: string
  bodyPart: string
  seriesCount: number
  fpsTarget: number
  fpsActual: number
  volume: number
  mode: RenderMode
  status: string
}

const MOCK: VitreaStudy[] = [
  { id: 'S001', patient: '王建国', modality: 'CT', bodyPart: '胸部', seriesCount: 612, fpsTarget: 30, fpsActual: 28, volume: 482, mode: 'VR', status: '已渲染' },
  { id: 'S002', patient: '李美芳', modality: 'CT', bodyPart: '冠脉', seriesCount: 488, fpsTarget: 30, fpsActual: 26, volume: 365, mode: 'MPR', status: '已渲染' },
  { id: 'S003', patient: '张伟', modality: 'MR', bodyPart: '颅脑', seriesCount: 224, fpsTarget: 24, fpsActual: 24, volume: 198, mode: 'VR', status: '已渲染' },
  { id: 'S004', patient: '陈晓敏', modality: 'CT', bodyPart: '腹部', seriesCount: 720, fpsTarget: 30, fpsActual: 22, volume: 612, mode: 'MIP', status: '渲染中' },
  { id: 'S005', patient: '刘洋', modality: 'CT', bodyPart: '骨骼', seriesCount: 1024, fpsTarget: 30, fpsActual: 18, volume: 824, mode: 'SSD', status: '已渲染' },
]

const MODE_META: Record<RenderMode, { color: string }> = {
  MPR: { color: 'blue' },
  VR: { color: 'purple' },
  MIP: { color: 'cyan' },
  SSD: { color: 'orange' },
}

export interface VitreaWorkspaceProps {
  studies?: VitreaStudy[]
  user?: string
}

export const Workspace: React.FC<VitreaWorkspaceProps> = ({ studies = MOCK, user = '陈医师' }) => {
  const [list] = useState<VitreaStudy[]>(studies)
  const [tab, setTab] = useState('mpr')

  const stats = useMemo(() => {
    const total = list.length
    const totalSeries = list.reduce((s, x) => s + x.seriesCount, 0)
    const avgFps = total ? list.reduce((s, x) => s + x.fpsActual, 0) / total : 0
    return { total, totalSeries, avgFps }
  }, [list])

  const columns: ColumnsType<VitreaStudy> = [
    { title: '编号', dataIndex: 'id', width: 70 },
    { title: '患者', dataIndex: 'patient', width: 100 },
    {
      title: '模态', dataIndex: 'modality', width: 80,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    { title: '部位', dataIndex: 'bodyPart', width: 90 },
    { title: '序列数', dataIndex: 'seriesCount', width: 90 },
    { title: '目标 FPS', dataIndex: 'fpsTarget', width: 90 },
    {
      title: '实际 FPS', dataIndex: 'fpsActual', width: 90,
      render: (v: number) => (
        <Tag color={v >= 24 ? 'green' : v >= 18 ? 'orange' : 'red'}>{v}</Tag>
      ),
    },
    {
      title: '渲染', dataIndex: 'mode', width: 80,
      render: (v: RenderMode) => <Tag color={MODE_META[v].color}>{v}</Tag>,
    },
    { title: '状态', dataIndex: 'status', width: 90 },
  ]

  return (
    <div data-testid="vitrea-workspace">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="研究数" value={stats.total} prefix={<Layout size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="序列总数" value={stats.totalSeries} prefix={<Layers size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="平均 FPS"
              value={stats.avgFps}
              precision={1}
              valueStyle={{ color: '#16a34a' }}
              prefix={<Box size={14} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Space direction="vertical" size={2}>
              <Tag color="blue">Vitrea v7.15</Tag>
              <Tag color="purple">{user}</Tag>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title={
          <Space>
            <Layout size={14} />
            <span>Canon Vitrea Workspace - 高级可视化</span>
          </Space>
        }
      >
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            { key: 'mpr', label: '多平面重建 (MPR)', children: (
              <Table<VitreaStudy>
                size="small"
                rowKey="id"
                columns={columns}
                dataSource={list.filter((x) => x.mode === 'MPR' || x.mode === 'MIP')}
                pagination={false}
                locale={{ emptyText: <Empty description="暂无 MPR 数据" /> }}
              />
            ) },
            { key: 'vr', label: '体绘制 (VR)', children: (
              <Table<VitreaStudy>
                size="small"
                rowKey="id"
                columns={columns}
                dataSource={list.filter((x) => x.mode === 'VR' || x.mode === 'SSD')}
                pagination={false}
                locale={{ emptyText: <Empty description="暂无 VR 数据" /> }}
              />
            ) },
            { key: 'all', label: '全部研究', children: (
              <Table<VitreaStudy>
                size="small"
                rowKey="id"
                columns={columns}
                dataSource={list}
                pagination={false}
                locale={{ emptyText: <Empty description="暂无研究数据" /> }}
              />
            ) },
          ]}
        />
      </Card>
    </div>
  )
}

export default Workspace