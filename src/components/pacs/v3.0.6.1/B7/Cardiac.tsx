/**
 * G005 放射RIS系统 v3.0.6.1 - Canon Vitrea Cardiac (冠脉分析)
 */
import React, { useMemo, useState } from 'react'
import { Card, Row, Col, Tag, Statistic, Table, Space, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Heart, Activity, GitBranch } from 'lucide-react'

export type StenosisGrade = '正常' | '轻度' | '中度' | '重度' | '闭塞'

export interface VitreaCardiac {
  id: string
  patient: string
  age: number
  caScore: number
  vessel: string
  stenosis: StenosisGrade
  stenosis_pct: number
  ffr_ct: number
  plaque: string
}

const MOCK: VitreaCardiac[] = [
  { id: 'H001', patient: '王建国', age: 62, caScore: 124, vessel: 'LAD', stenosis: '中度', stenosis_pct: 58, ffr_ct: 0.78, plaque: '混合斑块' },
  { id: 'H002', patient: '李美芳', age: 58, caScore: 86, vessel: 'RCA', stenosis: '轻度', stenosis_pct: 32, ffr_ct: 0.86, plaque: '软斑块' },
  { id: 'H003', patient: '张伟', age: 71, caScore: 412, vessel: 'LAD + LCX', stenosis: '重度', stenosis_pct: 82, ffr_ct: 0.62, plaque: '钙化斑块' },
  { id: 'H004', patient: '陈晓敏', age: 49, caScore: 28, vessel: 'RCA', stenosis: '正常', stenosis_pct: 12, ffr_ct: 0.92, plaque: '无' },
  { id: 'H005', patient: '刘洋', age: 66, caScore: 256, vessel: 'LAD', stenosis: '闭塞', stenosis_pct: 100, ffr_ct: 0.42, plaque: '钙化 + 软斑块' },
]

const STENOSIS_META: Record<StenosisGrade, { color: string }> = {
  正常: { color: 'green' },
  轻度: { color: 'blue' },
  中度: { color: 'orange' },
  重度: { color: 'red' },
  闭塞: { color: 'magenta' },
}

export const Cardiac: React.FC = () => {
  const [list] = useState<VitreaCardiac[]>(MOCK)

  const stats = useMemo(() => {
    const total = list.length
    const severe = list.filter((p) => p.stenosis === '重度' || p.stenosis === '闭塞').length
    const avgCa = total ? list.reduce((s, p) => s + p.caScore, 0) / total : 0
    return { total, severe, avgCa }
  }, [list])

  const columns: ColumnsType<VitreaCardiac> = [
    { title: '编号', dataIndex: 'id', width: 70 },
    { title: '患者', dataIndex: 'patient', width: 100 },
    { title: '年龄', dataIndex: 'age', width: 70 },
    {
      title: '钙化积分', dataIndex: 'caScore', width: 100,
      render: (v: number) => (
        <Tag color={v >= 400 ? 'red' : v >= 100 ? 'orange' : 'green'}>{v}</Tag>
      ),
    },
    { title: '冠脉', dataIndex: 'vessel', width: 130 },
    {
      title: '狭窄', dataIndex: 'stenosis', width: 90,
      render: (v: StenosisGrade) => <Tag color={STENOSIS_META[v].color}>{v}</Tag>,
    },
    {
      title: '狭窄 %', dataIndex: 'stenosis_pct', width: 100,
      render: (v: number) => `${v}%`,
    },
    {
      title: 'FFR-CT', dataIndex: 'ffr_ct', width: 100,
      render: (v: number) => (
        <Tag color={v >= 0.8 ? 'green' : v >= 0.7 ? 'orange' : 'red'}>{v.toFixed(2)}</Tag>
      ),
    },
    { title: '斑块', dataIndex: 'plaque', width: 140 },
  ]

  return (
    <div data-testid="vitrea-cardiac">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="病例数" value={stats.total} prefix={<Heart size={14} color="#dc2626" />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="重度/闭塞"
              value={stats.severe}
              valueStyle={{ color: '#dc2626' }}
              prefix={<Activity size={14} color="#dc2626" />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="平均钙化积分"
              value={stats.avgCa}
              precision={1}
              prefix={<GitBranch size={14} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Space direction="vertical" size={2}>
              <Tag color="blue">冠脉提取</Tag>
              <Tag color="purple">FFR-CT</Tag>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title={
          <Space>
            <Heart size={14} color="#dc2626" />
            <span>Canon Vitrea Cardiac - 冠脉分析</span>
          </Space>
        }
      >
        <Table<VitreaCardiac>
          size="small"
          rowKey="id"
          columns={columns}
          dataSource={list}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无冠脉数据" /> }}
        />
      </Card>
    </div>
  )
}

export default Cardiac