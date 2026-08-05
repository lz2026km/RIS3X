/**
 * G005 放射RIS系统 v3.0.6.1 - Philips CMR42 (心脏 MR 后处理)
 * T1/T2 mapping + 钆延迟强化 (LGE)
 */
import React, { useMemo, useState } from 'react'
import { Card, Row, Col, Tag, Statistic, Table, Space, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Heart, Droplet, Activity } from 'lucide-react'

export type LGEPattern = '无强化' | '心内膜下' | '透壁' | '壁间'

export interface CMR42Metrics {
  id: string
  patient: string
  age: number
  lv_ef: number
  rv_ef: number
  t1_ms: number
  t2_ms: number
  ecv: number
  lge: LGEPattern
  scar_pct: number
}

const MOCK: CMR42Metrics[] = [
  { id: 'C001', patient: '王建国', age: 58, lv_ef: 62, rv_ef: 58, t1_ms: 1024, t2_ms: 48, ecv: 26, lge: '无强化', scar_pct: 0 },
  { id: 'C002', patient: '李美芳', age: 64, lv_ef: 41, rv_ef: 49, t1_ms: 1180, t2_ms: 62, ecv: 34, lge: '心内膜下', scar_pct: 18 },
  { id: 'C003', patient: '张伟', age: 47, lv_ef: 55, rv_ef: 53, t1_ms: 1095, t2_ms: 55, ecv: 29, lge: '透壁', scar_pct: 24 },
  { id: 'C004', patient: '陈晓敏', age: 71, lv_ef: 38, rv_ef: 44, t1_ms: 1240, t2_ms: 71, ecv: 38, lge: '壁间', scar_pct: 12 },
  { id: 'C005', patient: '刘洋', age: 35, lv_ef: 66, rv_ef: 61, t1_ms: 998, t2_ms: 44, ecv: 24, lge: '无强化', scar_pct: 0 },
]

const LGE_META: Record<LGEPattern, { color: string }> = {
  无强化: { color: 'green' },
  心内膜下: { color: 'orange' },
  透壁: { color: 'red' },
  壁间: { color: 'blue' },
}

export interface CMR42Props {
  patients?: CMR42Metrics[]
}

export const CMR42: React.FC<CMR42Props> = ({ patients = MOCK }) => {
  const [list] = useState<CMR42Metrics[]>(patients)

  const stats = useMemo(() => {
    const total = list.length
    const avgEf = total ? list.reduce((s, p) => s + p.lv_ef, 0) / total : 0
    const avgT1 = total ? list.reduce((s, p) => s + p.t1_ms, 0) / total : 0
    const lgePos = list.filter((p) => p.lge !== '无强化').length
    return { total, avgEf, avgT1, lgePos }
  }, [list])

  const columns: ColumnsType<CMR42Metrics> = [
    { title: '编号', dataIndex: 'id', width: 70 },
    { title: '患者', dataIndex: 'patient', width: 100 },
    { title: '年龄', dataIndex: 'age', width: 70 },
    {
      title: 'LV EF (%)', dataIndex: 'lv_ef', width: 100,
      render: (v: number) => (
        <Tag color={v >= 55 ? 'green' : v >= 45 ? 'orange' : 'red'}>{v}</Tag>
      ),
    },
    { title: 'RV EF (%)', dataIndex: 'rv_ef', width: 100 },
    { title: 'T1 (ms)', dataIndex: 't1_ms', width: 90 },
    { title: 'T2 (ms)', dataIndex: 't2_ms', width: 90 },
    { title: 'ECV (%)', dataIndex: 'ecv', width: 90 },
    {
      title: 'LGE 模式', dataIndex: 'lge', width: 110,
      render: (v: LGEPattern) => <Tag color={LGE_META[v].color}>{v}</Tag>,
    },
    { title: '瘢痕 (%)', dataIndex: 'scar_pct', width: 90 },
  ]

  return (
    <div data-testid="cmr42">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="患者数" value={stats.total} prefix={<Heart size={14} color="#dc2626" />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="平均 LV EF"
              value={stats.avgEf}
              precision={1}
              suffix="%"
              styles={{ content: {  color: '#16a34a'  } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="平均 T1"
              value={stats.avgT1}
              precision={0}
              suffix="ms"
              prefix={<Droplet size={14} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="LGE 阳性"
              value={stats.lgePos}
              prefix={<Activity size={14} color="#f59e0b" />}
              styles={{ content: {  color: '#f59e0b'  } }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title={
          <Space>
            <Heart size={14} color="#dc2626" />
            <span>Philips CMR42 - 心脏 MR 后处理</span>
            <Tag color="blue">映射</Tag>
            <Tag color="purple">LGE</Tag>
          </Space>
        }
      >
        <Table<CMR42Metrics>
          size="small"
          rowKey="id"
          columns={columns}
          dataSource={list}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无 CMR 数据" /> }}
        />
      </Card>
    </div>
  )
}

export default CMR42