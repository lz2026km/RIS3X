/**
 * G005 放射RIS系统 v3.0.6.1 - Philips DoseWise (剂量管理)
 * DRL 诊断参考水平 + ALARA 原则
 */
import React, { useMemo, useState } from 'react'
import { Card, Row, Col, Tag, Statistic, Table, Space, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Shield, AlertTriangle, Activity } from 'lucide-react'

export type DoseAlertLevel = '正常' | '关注' | '超 DRL'

export interface DoseProtocol {
  id: string
  name: string
  modality: string
  bodyPart: string
  ctdi_mGy: number
  dlp_mGycm: number
  drl_mGycm: number
  ratio: number
  alaraNote: string
  level: DoseAlertLevel
}

const MOCK: DoseProtocol[] = [
  { id: 'P001', name: '头颅平扫', modality: 'CT', bodyPart: '头颅', ctdi_mGy: 48, dlp_mGycm: 850, drl_mGycm: 1000, ratio: 0.85, alaraNote: '儿童需降剂量', level: '正常' },
  { id: 'P002', name: '胸部平扫', modality: 'CT', bodyPart: '胸部', ctdi_mGy: 8, dlp_mGycm: 420, drl_mGycm: 450, ratio: 0.93, alaraNote: '低剂量筛查适用', level: '正常' },
  { id: 'P003', name: '腹部三期', modality: 'CT', bodyPart: '腹部', ctdi_mGy: 18, dlp_mGycm: 980, drl_mGycm: 800, ratio: 1.23, alaraNote: '超 DRL,需复核参数', level: '超 DRL' },
  { id: 'P004', name: '冠脉 CTA', modality: 'CT', bodyPart: '心脏', ctdi_mGy: 35, dlp_mGycm: 620, drl_mGycm: 700, ratio: 0.89, alaraNote: '前瞻门控优先', level: '正常' },
  { id: 'P005', name: '肺动脉 CTA', modality: 'CT', bodyPart: '胸部', ctdi_mGy: 12, dlp_mGycm: 480, drl_mGycm: 450, ratio: 1.07, alaraNote: '接近 DRL,建议降 kV', level: '关注' },
]

const LEVEL_META: Record<DoseAlertLevel, { color: string }> = {
  正常: { color: 'green' },
  关注: { color: 'orange' },
  '超 DRL': { color: 'red' },
}

export interface DoseWiseProps {
  protocols?: DoseProtocol[]
}

export const DoseWise: React.FC<DoseWiseProps> = ({ protocols = MOCK }) => {
  const [list] = useState<DoseProtocol[]>(protocols)

  const stats = useMemo(() => {
    const total = list.length
    const exceeded = list.filter((p) => p.level === '超 DRL').length
    const avgRatio = total ? list.reduce((s, p) => s + p.ratio, 0) / total : 0
    return { total, exceeded, avgRatio }
  }, [list])

  const columns: ColumnsType<DoseProtocol> = [
    { title: '协议', dataIndex: 'name', width: 130 },
    { title: '部位', dataIndex: 'bodyPart', width: 80 },
    {
      title: '模态', dataIndex: 'modality', width: 70,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    { title: 'CTDI (mGy)', dataIndex: 'ctdi_mGy', width: 110 },
    { title: 'DLP', dataIndex: 'dlp_mGycm', width: 100 },
    { title: 'DRL', dataIndex: 'drl_mGycm', width: 100 },
    {
      title: 'DRL 比', dataIndex: 'ratio', width: 90,
      render: (v: number) => (
        <Tag color={v > 1 ? 'red' : v > 0.95 ? 'orange' : 'green'}>{(v * 100).toFixed(0)}%</Tag>
      ),
    },
    {
      title: 'ALARA 建议', dataIndex: 'alaraNote', width: 200,
    },
    {
      title: '等级', dataIndex: 'level', width: 90,
      render: (v: DoseAlertLevel) => <Tag color={LEVEL_META[v].color}>{v}</Tag>,
    },
  ]

  return (
    <div data-testid="dosewise">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="协议总数" value={stats.total} prefix={<Activity size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="超 DRL"
              value={stats.exceeded}
              styles={{ content: {  color: '#dc2626'  } }}
              prefix={<AlertTriangle size={14} color="#dc2626" />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="平均 DRL 比"
              value={(stats.avgRatio * 100).toFixed(1)}
              suffix="%"
              prefix={<Shield size={14} color="#16a34a" />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Space orientation="vertical" size={2}>
              <Tag color="blue">ALARA 原则</Tag>
              <Tag color="green">ICRP 推荐</Tag>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title={
          <Space>
            <Shield size={14} />
            <span>Philips DoseWise - 剂量协议管理</span>
          </Space>
        }
      >
        <Table<DoseProtocol>
          size="small"
          rowKey="id"
          columns={columns}
          dataSource={list}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无剂量协议" /> }}
        />
      </Card>
    </div>
  )
}

export default DoseWise