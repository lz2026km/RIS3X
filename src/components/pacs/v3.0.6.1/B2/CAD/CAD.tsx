/**
 * G005 放射RIS系统 v3.0.6.1 - Siemens Lung CAD (肺结节计算机辅助检测)
 * 对标:Siemens syngo.CT Lung CAD - 肺结节检出/位置/大小/形态/恶性概率
 */
import React, { useMemo, useState } from 'react'
import { Card, Row, Col, Table, Tag, Statistic, Progress, Space, Slider, Switch, Button, Empty } from 'antd'
import { Scan, Ruler, Shapes, Activity, Filter } from 'lucide-react'

export type NoduleMorphology = 'SOLID' | 'PART_SOLID' | 'GROUND_GLASS' | 'CALCIFIED'

export interface LungNodule {
  id: string
  patientName: string
  patientId: string
  patientAge: number
  patientSex: 'M' | 'F'
  location: string
  lobe: 'RUL' | 'RML' | 'RLL' | 'LUL' | 'LLL'
  size_mm: number
  morphology: NoduleMorphology
  densityHU: number
  malignantProbability: number
  confidence: number
  followUp: string
}

const MOCK_NODULES: LungNodule[] = [
  { id: 'N001', patientName: '王建国', patientId: 'P20240618001', patientAge: 62, patientSex: 'M', location: '右肺上叶尖后段', lobe: 'RUL', size_mm: 8.5, morphology: 'PART_SOLID', densityHU: -120, malignantProbability: 0.42, confidence: 0.92, followUp: '3 个月低剂量 CT' },
  { id: 'N002', patientName: '李美芳', patientId: 'P20240618002', patientAge: 58, patientSex: 'F', location: '左肺下叶背段', lobe: 'LLL', size_mm: 5.2, morphology: 'GROUND_GLASS', densityHU: -680, malignantProbability: 0.18, confidence: 0.86, followUp: '6 个月随访' },
  { id: 'N003', patientName: '张伟', patientId: 'P20240618003', patientAge: 71, patientSex: 'M', location: '右肺中叶外侧段', lobe: 'RML', size_mm: 18.0, morphology: 'SOLID', densityHU: 35, malignantProbability: 0.78, confidence: 0.95, followUp: '立即临床评估/PET-CT' },
  { id: 'N004', patientName: '陈晓敏', patientId: 'P20240618004', patientAge: 55, patientSex: 'F', location: '右肺下叶基底段', lobe: 'RLL', size_mm: 4.0, morphology: 'CALCIFIED', densityHU: 480, malignantProbability: 0.02, confidence: 0.81, followUp: '常规年度筛查' },
  { id: 'N005', patientName: '刘强', patientId: 'P20240618005', patientAge: 67, patientSex: 'M', location: '左肺上叶尖后段', lobe: 'LUL', size_mm: 11.6, morphology: 'PART_SOLID', densityHU: -85, malignantProbability: 0.55, confidence: 0.89, followUp: '1 个月增强 CT' },
]

const MORPH_META: Record<NoduleMorphology, { color: string; label: string }> = {
  SOLID: { color: 'red', label: '实性' },
  PART_SOLID: { color: 'orange', label: '部分实性' },
  GROUND_GLASS: { color: 'geekblue', label: '磨玻璃' },
  CALCIFIED: { color: 'gold', label: '钙化' },
}

const LOBE_META: Record<LungNodule['lobe'], string> = {
  RUL: '右上叶',
  RML: '右中叶',
  RLL: '右下叶',
  LUL: '左上叶',
  LLL: '左下叶',
}

export interface CADProps {
  onAccept?: (id: string) => void
  onReject?: (id: string) => void
}

export const CAD: React.FC<CADProps> = ({ onAccept, onReject }) => {
  const [minSize, setMinSize] = useState(3)
  const [malignancyFloor, setMalignancyFloor] = useState(0)
  const [autoFilter, setAutoFilter] = useState(true)

  const stats = useMemo(() => {
    const total = MOCK_NODULES.length
    const highRisk = MOCK_NODULES.filter((n) => n.malignantProbability >= 0.5).length
    const avgSize = total ? MOCK_NODULES.reduce((s, n) => s + n.size_mm, 0) / total : 0
    const avgConf = total ? MOCK_NODULES.reduce((s, n) => s + n.confidence, 0) / total : 0
    return { total, highRisk, avgSize, avgConf }
  }, [])

  const filtered = useMemo(
    () =>
      MOCK_NODULES.filter(
        (n) => n.size_mm >= minSize && n.malignantProbability >= malignancyFloor,
      ),
    [minSize, malignancyFloor],
  )

  const columns = [
    {
      title: '病灶 ID',
      dataIndex: 'id',
      key: 'id',
      width: 90,
      render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: '患者',
      key: 'patient',
      render: (_: unknown, r: LungNodule) => (
        <Space orientation="vertical" size={0}>
          <span style={{ fontWeight: 600 }}>{r.patientName}</span>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {r.patientId} · {r.patientSex === 'M' ? '男' : '女'} · {r.patientAge} 岁
          </span>
        </Space>
      ),
    },
    {
      title: '肺叶',
      dataIndex: 'lobe',
      key: 'lobe',
      width: 80,
      render: (v: LungNodule['lobe']) => <Tag color="blue">{LOBE_META[v]}</Tag>,
    },
    { title: '位置', dataIndex: 'location', key: 'location' },
    {
      title: '大小',
      dataIndex: 'size_mm',
      key: 'size_mm',
      width: 90,
      sorter: (a: LungNodule, b: LungNodule) => a.size_mm - b.size_mm,
      render: (v: number) => (
        <Space size={4}>
          <Ruler size={12} />
          <span style={{ fontWeight: 600 }}>{v} mm</span>
        </Space>
      ),
    },
    {
      title: '形态',
      dataIndex: 'morphology',
      key: 'morphology',
      width: 110,
      render: (v: NoduleMorphology) => (
        <Space size={4}>
          <Shapes size={12} />
          <Tag color={MORPH_META[v].color}>{MORPH_META[v].label}</Tag>
        </Space>
      ),
    },
    {
      title: '密度(HU)',
      dataIndex: 'densityHU',
      key: 'densityHU',
      width: 100,
      render: (v: number) => <span style={{ fontFamily: 'monospace' }}>{v} HU</span>,
    },
    {
      title: '恶性概率',
      dataIndex: 'malignantProbability',
      key: 'malignantProbability',
      width: 160,
      sorter: (a: LungNodule, b: LungNodule) => a.malignantProbability - b.malignantProbability,
      render: (v: number) => (
        <Progress
          percent={Math.round(v * 100)}
          size="small"
          strokeColor={v >= 0.5 ? '#dc2626' : v >= 0.2 ? '#f59e0b' : '#16a34a'}
        />
      ),
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 100,
      render: (v: number) => <Progress percent={Math.round(v * 100)} size="small" showInfo={false} strokeColor="#3b82f6" />,
    },
    { title: '随访建议', dataIndex: 'followUp', key: 'followUp', width: 160 },
  ]

  return (
    <div data-testid="cad-lung">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="检出结节总数" value={stats.total} prefix={<Scan size={14} color="#3b82f6" />} styles={{ content: {  color: '#3b82f6'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="高风险(≥50%)" value={stats.highRisk} prefix={<Activity size={14} color="#dc2626" />} styles={{ content: {  color: '#dc2626'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="平均大小" value={stats.avgSize} precision={1} suffix="mm" styles={{ content: {  color: '#8b5cf6'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="平均检出置信度" value={stats.avgConf} precision={2} styles={{ content: {  color: '#16a34a'  } }} />
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title={
          <Space>
            <Scan size={14} />
            <span>肺结节 CAD 检测列表</span>
            <Tag color="cyan">syngo.CT Lung CAD</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button size="small" type="primary" onClick={() => filtered.forEach((n) => onAccept?.(n.id))}>批量采纳</Button>
            <Button size="small" danger onClick={() => filtered.forEach((n) => onReject?.(n.id))}>批量拒绝</Button>
          </Space>
        }
        style={{ marginBottom: 12 }}
      >
        <Row gutter={16}>
          <Col span={10}>
            <Space orientation="vertical" size={4} style={{ width: '100%' }}>
              <span style={{ fontSize: 12 }}>
                <Filter size={12} /> 最小尺寸 ≥ {minSize} mm
              </span>
              <Slider min={3} max={20} value={minSize} onChange={setMinSize} />
            </Space>
          </Col>
          <Col span={10}>
            <Space orientation="vertical" size={4} style={{ width: '100%' }}>
              <span style={{ fontSize: 12 }}>
                恶性概率阈值 ≥ {(malignancyFloor * 100).toFixed(0)}%
              </span>
              <Slider min={0} max={1} step={0.05} value={malignancyFloor} onChange={setMalignancyFloor} />
            </Space>
          </Col>
          <Col span={4}>
            <Space>
              <Switch size="small" checked={autoFilter} onChange={setAutoFilter} />
              <span style={{ fontSize: 12 }}>自动过滤</span>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card size="small" title={`候选病灶 (${filtered.length} / ${MOCK_NODULES.length})`}>
        <Table
          size="small"
          rowKey="id"
          dataSource={filtered}
          columns={columns}
          pagination={false}
          locale={{ emptyText: <Empty description="无匹配结节" /> }}
          onRow={(record) => ({
            onClick: () => onAccept?.(record.id),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>
    </div>
  )
}

export default CAD
