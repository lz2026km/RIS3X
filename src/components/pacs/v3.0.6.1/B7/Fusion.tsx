/**
 * G005 放射RIS系统 v3.0.6.1 - Canon Vitrea Fusion (多模态融合)
 * PET/CT/MR 融合
 */
import React, { useMemo, useState } from 'react'
import { Card, Row, Col, Tag, Statistic, Table, Space, Slider, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Layers, Crosshair, Zap } from 'lucide-react'

export type FusionModality = 'PET/CT' | 'PET/MR' | 'CT/MR' | 'SPECT/CT'

export interface VitreaFusion {
  id: string
  patient: string
  pair: FusionModality
  indication: string
  suvMax: number
  registration_mm: number
  confidence: number
  examAt: string
}

const MOCK: VitreaFusion[] = [
  { id: 'F001', patient: '王建国', pair: 'PET/CT', indication: '肺癌分期', suvMax: 8.4, registration_mm: 1.8, confidence: 0.96, examAt: '2026-06-10 09:20' },
  { id: 'F002', patient: '李美芳', pair: 'PET/MR', indication: '脑肿瘤', suvMax: 6.1, registration_mm: 2.2, confidence: 0.93, examAt: '2026-06-11 10:35' },
  { id: 'F003', patient: '张伟', pair: 'CT/MR', indication: '肝癌消融', suvMax: 0, registration_mm: 1.2, confidence: 0.97, examAt: '2026-06-12 14:00' },
  { id: 'F004', patient: '陈晓敏', pair: 'SPECT/CT', indication: '骨转移', suvMax: 0, registration_mm: 2.6, confidence: 0.91, examAt: '2026-06-13 11:15' },
  { id: 'F005', patient: '刘洋', pair: 'PET/CT', indication: '淋巴瘤疗效评估', suvMax: 4.8, registration_mm: 1.5, confidence: 0.95, examAt: '2026-06-14 08:50' },
]

const PAIR_META: Record<FusionModality, { color: string }> = {
  'PET/CT': { color: 'blue' },
  'PET/MR': { color: 'purple' },
  'CT/MR': { color: 'cyan' },
  'SPECT/CT': { color: 'orange' },
}

export const Fusion: React.FC = () => {
  const [list] = useState<VitreaFusion[]>(MOCK)
  const [alpha, setAlpha] = useState(50)

  const stats = useMemo(() => {
    const total = list.length
    const avgReg = total ? list.reduce((s, x) => s + x.registration_mm, 0) / total : 0
    const avgConf = total ? list.reduce((s, x) => s + x.confidence, 0) / total : 0
    return { total, avgReg, avgConf }
  }, [list])

  const columns: ColumnsType<VitreaFusion> = [
    { title: '编号', dataIndex: 'id', width: 70 },
    { title: '患者', dataIndex: 'patient', width: 100 },
    {
      title: '融合对', dataIndex: 'pair', width: 100,
      render: (v: FusionModality) => <Tag color={PAIR_META[v].color}>{v}</Tag>,
    },
    { title: '适应症', dataIndex: 'indication', width: 140 },
    {
      title: 'SUVmax', dataIndex: 'suvMax', width: 100,
      render: (v: number) => v > 0 ? <Tag color="red">{v.toFixed(1)}</Tag> : <Tag>—</Tag>,
    },
    {
      title: '配准误差 (mm)', dataIndex: 'registration_mm', width: 130,
      render: (v: number) => (
        <Tag color={v <= 2 ? 'green' : v <= 3 ? 'orange' : 'red'}>{v.toFixed(1)}</Tag>
      ),
    },
    {
      title: '置信度', dataIndex: 'confidence', width: 100,
      render: (v: number) => `${(v * 100).toFixed(0)}%`,
    },
    { title: '检查时间', dataIndex: 'examAt', width: 160 },
  ]

  return (
    <div data-testid="vitrea-fusion">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="融合数" value={stats.total} prefix={<Layers size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="平均配准误差"
              value={stats.avgReg}
              precision={2}
              suffix="mm"
              prefix={<Crosshair size={14} color="#16a34a" />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="平均置信度"
              value={(stats.avgConf * 100).toFixed(1)}
              suffix="%"
              prefix={<Zap size={14} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Space orientation="vertical" size={2}>
              <Tag color="blue">PET/CT</Tag>
              <Tag color="purple">PET/MR</Tag>
              <Tag color="cyan">CT/MR</Tag>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title={
          <Space>
            <Layers size={14} />
            <span>Canon Vitrea Fusion - 多模态融合</span>
          </Space>
        }
        style={{ marginBottom: 12 }}
      >
        <Table<VitreaFusion>
          size="small"
          rowKey="id"
          columns={columns}
          dataSource={list}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无融合数据" /> }}
        />
      </Card>

      <Card size="small" title="融合预览透明度">
        <div style={{ position: 'relative', height: 200, background: '#0f172a', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(135deg, rgba(59,130,246,${alpha / 100}) 0%, rgba(220,38,38,${1 - alpha / 100}) 100%)`,
          }} />
          <Tag color="blue" style={{ position: 'absolute', top: 8, left: 8 }}>CT</Tag>
          <Tag color="red" style={{ position: 'absolute', top: 8, right: 8 }}>PET</Tag>
        </div>
        <div style={{ marginTop: 8 }}>
          <span style={{ fontSize: 12 }}>透明度: {alpha}%</span>
          <Slider min={0} max={100} value={alpha} onChange={setAlpha} />
        </div>
      </Card>
    </div>
  )
}

export default Fusion