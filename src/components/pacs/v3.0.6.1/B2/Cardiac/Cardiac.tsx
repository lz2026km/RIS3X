/**
 * G005 放射RIS系统 v3.0.6.1 - Siemens Cardiac CT/MR 心功能分析
 * 对标:Siemens syngo.via Cardiac - EF/EDV/ESV/SV/CO + 室壁运动
 */
import React, { useMemo, useState } from 'react'
import { Card, Row, Col, Table, Tag, Statistic, Progress, Tabs, Space, Badge, Empty } from 'antd'
import { Heart, Activity, Droplet, Zap, GitBranch } from 'lucide-react'

export type WallMotionGrade = 'NORMAL' | 'HYPOKINESIS' | 'AKINESIS' | 'DYSKINESIS'

export interface CardiacSegment {
  name: string
  grade: WallMotionGrade
  thickeningPct: number
}

export interface CardiacPatient {
  id: string
  patientName: string
  patientId: string
  age: number
  sex: 'M' | 'F'
  studyDate: string
  modality: 'CT' | 'MR'
  ef: number
  edvMl: number
  esvMl: number
  svMl: number
  coLpm: number
  heartRateBpm: number
  massG: number
  abnormalSegments: number
  segments: CardiacSegment[]
  diagnosis: string
}

const MOCK_PATIENTS: CardiacPatient[] = [
  {
    id: 'C001', patientName: '王建国', patientId: 'P20240618001', age: 62, sex: 'M', studyDate: '2026-06-18', modality: 'CT',
    ef: 58, edvMl: 142, esvMl: 60, svMl: 82, coLpm: 5.4, heartRateBpm: 66, massG: 142,
    abnormalSegments: 2,
    segments: [
      { name: '前壁基底段', grade: 'HYPOKINESIS', thickeningPct: 18 },
      { name: '前间隔中段', grade: 'NORMAL', thickeningPct: 45 },
      { name: '下壁心尖段', grade: 'HYPOKINESIS', thickeningPct: 22 },
    ],
    diagnosis: '前壁运动减弱',
  },
  {
    id: 'C002', patientName: '李美芳', patientId: 'P20240618002', age: 58, sex: 'F', studyDate: '2026-06-18', modality: 'MR',
    ef: 64, edvMl: 118, esvMl: 42, svMl: 76, coLpm: 4.8, heartRateBpm: 72, massG: 95,
    abnormalSegments: 0,
    segments: [
      { name: '前壁基底段', grade: 'NORMAL', thickeningPct: 55 },
      { name: '前间隔中段', grade: 'NORMAL', thickeningPct: 58 },
      { name: '下壁心尖段', grade: 'NORMAL', thickeningPct: 60 },
    ],
    diagnosis: '心功能正常',
  },
  {
    id: 'C003', patientName: '张伟', patientId: 'P20240618003', age: 71, sex: 'M', studyDate: '2026-06-18', modality: 'CT',
    ef: 32, edvMl: 198, esvMl: 134, svMl: 64, coLpm: 4.1, heartRateBpm: 88, massG: 215,
    abnormalSegments: 5,
    segments: [
      { name: '前壁基底段', grade: 'AKINESIS', thickeningPct: 5 },
      { name: '前间隔中段', grade: 'AKINESIS', thickeningPct: 3 },
      { name: '下壁心尖段', grade: 'DYSKINESIS', thickeningPct: -8 },
    ],
    diagnosis: '广泛前壁心肌梗死',
  },
  {
    id: 'C004', patientName: '陈晓敏', patientId: 'P20240618004', age: 55, sex: 'F', studyDate: '2026-06-17', modality: 'MR',
    ef: 52, edvMl: 132, esvMl: 64, svMl: 68, coLpm: 4.6, heartRateBpm: 78, massG: 108,
    abnormalSegments: 1,
    segments: [
      { name: '前壁基底段', grade: 'NORMAL', thickeningPct: 48 },
      { name: '前间隔中段', grade: 'NORMAL', thickeningPct: 52 },
      { name: '下壁心尖段', grade: 'HYPOKINESIS', thickeningPct: 24 },
    ],
    diagnosis: '下壁心尖段运动减弱',
  },
  {
    id: 'C005', patientName: '刘强', patientId: 'P20240618005', age: 67, sex: 'M', studyDate: '2026-06-17', modality: 'CT',
    ef: 45, edvMl: 168, esvMl: 92, svMl: 76, coLpm: 5.1, heartRateBpm: 82, massG: 178,
    abnormalSegments: 3,
    segments: [
      { name: '前壁基底段', grade: 'HYPOKINESIS', thickeningPct: 20 },
      { name: '前间隔中段', grade: 'HYPOKINESIS', thickeningPct: 22 },
      { name: '下壁心尖段', grade: 'NORMAL', thickeningPct: 42 },
    ],
    diagnosis: '缺血性心肌病',
  },
]

const WM_META: Record<WallMotionGrade, { color: string; label: string }> = {
  NORMAL: { color: 'green', label: '正常' },
  HYPOKINESIS: { color: 'orange', label: '运动减弱' },
  AKINESIS: { color: 'red', label: '无运动' },
  DYSKINESIS: { color: 'magenta', label: '矛盾运动' },
}

const efColor = (ef: number): string => {
  if (ef < 35) return '#dc2626'
  if (ef < 50) return '#f59e0b'
  if (ef < 70) return '#16a34a'
  return '#3b82f6'
}

export interface CardiacProps {
  onSelectPatient?: (id: string) => void
}

export const Cardiac: React.FC<CardiacProps> = ({ onSelectPatient }) => {
  const [selected, setSelected] = useState<string>(MOCK_PATIENTS[0]?.id ?? '')

  const stats = useMemo(() => {
    const total = MOCK_PATIENTS.length
    const abnormal = MOCK_PATIENTS.filter((p) => p.abnormalSegments > 0).length
    const avgEf = total ? MOCK_PATIENTS.reduce((s, p) => s + p.ef, 0) / total : 0
    const lowEf = MOCK_PATIENTS.filter((p) => p.ef < 50).length
    return { total, abnormal, avgEf, lowEf }
  }, [])

  const current = useMemo(
    () => MOCK_PATIENTS.find((p) => p.id === selected) ?? MOCK_PATIENTS[0],
    [selected],
  )

  const patientColumns = [
    {
      title: '患者',
      key: 'patient',
      render: (_: unknown, r: CardiacPatient) => (
        <Space direction="vertical" size={0}>
          <Space>
            <span style={{ fontWeight: 600 }}>{r.patientName}</span>
            <Badge color={r.abnormalSegments > 0 ? 'red' : 'green'} text={r.abnormalSegments > 0 ? '异常' : '正常'} />
          </Space>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {r.patientId} · {r.sex === 'M' ? '男' : '女'} · {r.age} 岁 · {r.modality}
          </span>
        </Space>
      ),
    },
    {
      title: 'EF',
      dataIndex: 'ef',
      key: 'ef',
      width: 100,
      sorter: (a: CardiacPatient, b: CardiacPatient) => a.ef - b.ef,
      render: (v: number) => (
        <span style={{ color: efColor(v), fontWeight: 700 }}>
          {v}%
        </span>
      ),
    },
    { title: 'EDV', dataIndex: 'edvMl', key: 'edvMl', width: 80, render: (v: number) => `${v} mL` },
    { title: 'ESV', dataIndex: 'esvMl', key: 'esvMl', width: 80, render: (v: number) => `${v} mL` },
    { title: 'SV', dataIndex: 'svMl', key: 'svMl', width: 80, render: (v: number) => `${v} mL` },
    { title: 'CO', dataIndex: 'coLpm', key: 'coLpm', width: 90, render: (v: number) => `${v.toFixed(1)} L/min` },
    {
      title: '异常节段',
      dataIndex: 'abnormalSegments',
      key: 'abnormalSegments',
      width: 100,
      render: (v: number) => (
        <Tag color={v > 0 ? 'red' : 'green'}>{v} 段</Tag>
      ),
    },
    { title: '诊断', dataIndex: 'diagnosis', key: 'diagnosis', width: 180 },
  ]

  const segmentColumns = [
    { title: '节段', dataIndex: 'name', key: 'name' },
    {
      title: '运动评估',
      dataIndex: 'grade',
      key: 'grade',
      width: 120,
      render: (v: WallMotionGrade) => <Tag color={WM_META[v].color}>{WM_META[v].label}</Tag>,
    },
    {
      title: '室壁增厚率',
      dataIndex: 'thickeningPct',
      key: 'thickeningPct',
      render: (v: number) => (
        <Progress
          percent={Math.max(0, v)}
          size="small"
          strokeColor={v < 10 ? '#dc2626' : v < 30 ? '#f59e0b' : '#16a34a'}
          format={() => `${v}%`}
        />
      ),
    },
  ]

  return (
    <div data-testid="cardiac">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="患者总数" value={stats.total} prefix={<Heart size={14} color="#dc2626" />} valueStyle={{ color: '#dc2626' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="平均 EF"
              value={stats.avgEf}
              precision={1}
              suffix="%"
              prefix={<Activity size={14} color={efColor(stats.avgEf)} />}
              valueStyle={{ color: efColor(stats.avgEf) }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="EF < 50%" value={stats.lowEf} prefix={<Zap size={14} color="#f59e0b" />} valueStyle={{ color: '#f59e0b' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="异常病例" value={stats.abnormal} prefix={<Droplet size={14} color="#8b5cf6" />} valueStyle={{ color: '#8b5cf6' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col span={14}>
          <Card
            size="small"
            title={
              <Space>
                <Heart size={14} />
                <span>心功能测量列表</span>
                <Tag color="blue">syngo.via Cardiac</Tag>
              </Space>
            }
          >
            <Table
              size="small"
              rowKey="id"
              dataSource={MOCK_PATIENTS}
              columns={patientColumns}
              pagination={false}
              locale={{ emptyText: <Empty description="暂无心功能数据" /> }}
              rowClassName={(r) => (r.id === selected ? 'ant-table-row-selected' : '')}
              onRow={(record) => ({
                onClick: () => {
                  setSelected(record.id)
                  onSelectPatient?.(record.id)
                },
                style: { cursor: 'pointer' },
              })}
            />
          </Card>
        </Col>
        <Col span={10}>
          {current && (
            <Card
              size="small"
              title={
                <Space>
                  <GitBranch size={14} />
                  <span>{current.patientName} - {current.diagnosis}</span>
                </Space>
              }
            >
              <Row gutter={8} style={{ marginBottom: 8 }}>
                <Col span={12}>
                  <Statistic title="LVEF" value={current.ef} suffix="%" valueStyle={{ color: efColor(current.ef), fontSize: 22 }} />
                </Col>
                <Col span={12}>
                  <Statistic title="CO" value={current.coLpm} precision={1} suffix="L/min" valueStyle={{ fontSize: 22 }} />
                </Col>
              </Row>
              <Row gutter={8} style={{ marginBottom: 8 }}>
                <Col span={8}>
                  <Statistic title="EDV" value={current.edvMl} suffix="mL" />
                </Col>
                <Col span={8}>
                  <Statistic title="ESV" value={current.esvMl} suffix="mL" />
                </Col>
                <Col span={8}>
                  <Statistic title="SV" value={current.svMl} suffix="mL" />
                </Col>
              </Row>
              <Tabs
                size="small"
                items={[
                  {
                    key: 'wm',
                    label: `室壁运动 (${current.segments.length})`,
                    children: (
                      <Table
                        size="small"
                        rowKey="name"
                        dataSource={current.segments}
                        columns={segmentColumns}
                        pagination={false}
                        locale={{ emptyText: <Empty description="暂无室壁数据" /> }}
                      />
                    ),
                  },
                  {
                    key: 'mass',
                    label: '心肌质量',
                    children: (
                      <Statistic
                        title="LVM"
                        value={current.massG}
                        suffix="g"
                        prefix={<Heart size={14} color="#dc2626" />}
                        valueStyle={{ color: current.massG > 150 ? '#dc2626' : '#16a34a', fontSize: 22 }}
                      />
                    ),
                  },
                ]}
              />
            </Card>
          )}
        </Col>
      </Row>
    </div>
  )
}

export default Cardiac
