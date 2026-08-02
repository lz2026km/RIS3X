/**
 * G005 放射RIS系统 v3.0.6.1 - GE DoseWatch 剂量追踪主面板
 * 对标:GE DoseWatch - CT/DR/MR 辐射剂量全程追踪
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Card, Row, Col, Statistic, Table, Tag, Select, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Activity, AlertTriangle, TrendingUp, Shield } from 'lucide-react'
import { DoseChart } from './DoseChart'
import { DoseAlert } from './DoseAlert'
import { CumulativeReport } from './CumulativeReport'
import { ProtocolSelector } from './ProtocolSelector'

export interface DoseRecord {
  id: string
  patientId: string
  patientName: string
  modality: string
  bodyPart: string
  examAt: string
  ctdivol_mGy: number
  dlp_mGycm: number
  effectiveDose_mSv: number
  drs: number
  protocol: string
  exceeded?: boolean
}

const MOCK: DoseRecord[] = [
  { id: 'D001', patientName: '王建国', patientId: 'P001', modality: 'CT', bodyPart: '头颅平扫', examAt: '2024-06-18 09:00', ctdivol_mGy: 65, dlp_mGycm: 850, effectiveDose_mSv: 1.8, drs: 18, protocol: 'Head-Adult-Routine' },
  { id: 'D002', patientName: '李美芳', patientId: 'P002', modality: 'CT', bodyPart: '胸部增强', examAt: '2024-06-18 09:30', ctdivol_mGy: 12, dlp_mGycm: 420, effectiveDose_mSv: 6.2, drs: 32, protocol: 'Chest-Adult-Contrast' },
  { id: 'D003', patientName: '张伟', patientId: 'P003', modality: 'CT', bodyPart: '腹部三期', examAt: '2024-06-18 10:00', ctdivol_mGy: 18, dlp_mGycm: 980, effectiveDose_mSv: 14.5, drs: 68, protocol: 'Abdomen-3Phase', exceeded: true },
  { id: 'D004', patientName: '陈晓敏', patientId: 'P004', modality: 'CT', bodyPart: '冠脉CTA', examAt: '2024-06-18 10:30', ctdivol_mGy: 35, dlp_mGycm: 620, effectiveDose_mSv: 8.5, drs: 45, protocol: 'Cardiac-CTA' },
  { id: 'D005', patientName: '刘强', patientId: 'P005', modality: 'DR', bodyPart: '胸部正侧位', examAt: '2024-06-18 11:00', ctdivol_mGy: 0, dlp_mGycm: 0, effectiveDose_mSv: 0.05, drs: 1, protocol: 'DR-Chest-PA-Lat' },
]

export interface DoseTrackerProps {
  records?: DoseRecord[]
  onSelectProtocol?: (protocol: string) => void
}

export const DoseTracker: React.FC<DoseTrackerProps> = ({ records, onSelectProtocol }) => {
  const [data] = useState<DoseRecord[]>(records ?? MOCK)
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month')

  useEffect(() => { void period }, [period])

  const stats = useMemo(() => {
    const total = data.length
    const exceeded = data.filter((d) => d.exceeded).length
    const avgDose = total ? Math.round((data.reduce((s, d) => s + d.effectiveDose_mSv, 0) / total) * 100) / 100 : 0
    const totalDLP = data.reduce((s, d) => s + d.dlp_mGycm, 0)
    return { total, exceeded, avgDose, totalDLP }
  }, [data])

  const columns: ColumnsType<DoseRecord> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '患者', dataIndex: 'patientName', width: 100 },
    { title: '检查', dataIndex: 'bodyPart', width: 130, render: (v: string, r) => <Tag color="blue">{r.modality} {v}</Tag> },
    { title: 'CTDIvol', dataIndex: 'ctdivol_mGy', width: 90, render: (v: number) => `${v} mGy` },
    { title: 'DLP', dataIndex: 'dlp_mGycm', width: 100, render: (v: number) => `${v}` },
    { title: '有效剂量', dataIndex: 'effectiveDose_mSv', width: 100,
      render: (v: number) => <Tag color={v > 10 ? 'red' : v > 5 ? 'orange' : 'green'}>{v} mSv</Tag>,
    },
    { title: 'DRS', dataIndex: 'drs', width: 70 },
    { title: '协议', dataIndex: 'protocol', width: 160 },
    {
      title: '状态', dataIndex: 'exceeded', width: 80,
      render: (e?: boolean) => e ? <Tag color="red">超阈值</Tag> : <Tag color="green">正常</Tag>,
    },
  ]

  return (
    <div data-testid="dose-tracker">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="总检查" value={stats.total} prefix={<Activity size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="超阈值"
              value={stats.exceeded}
              prefix={<AlertTriangle size={14} color="#dc2626" />}
              styles={{ content: {  color: '#dc2626'  } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="平均有效剂量"
              value={stats.avgDose}
              suffix="mSv"
              precision={2}
              prefix={<Shield size={14} color="#16a34a" />}
              styles={{ content: {  color: '#16a34a'  } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总 DLP"
              value={stats.totalDLP}
              suffix="mGy·cm"
              prefix={<TrendingUp size={14} color="#3b82f6" />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={12}>
          <Card
            size="small"
            title="剂量趋势"
            extra={
              <Select size="small" value={period} onChange={setPeriod} style={{ width: 90 }}
                options={[{ value: 'day', label: '日' }, { value: 'week', label: '周' }, { value: 'month', label: '月' }, { value: 'year', label: '年' }]}
              />
            }
          >
            <DoseChart records={data} period={period} />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title="协议选择">
            <ProtocolSelector records={data} onSelect={onSelectProtocol} />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="剂量记录" style={{ marginBottom: 12 }}>
        <Table<DoseRecord>
          size="small"
          rowKey="id"
          columns={columns}
          dataSource={data}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="暂无剂量记录" /> }}
        />
      </Card>

      <Row gutter={12}>
        <Col span={12}>
          <Card size="small" title="超阈值告警">
            <DoseAlert records={data.filter((d) => d.exceeded)} />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title="累计报告">
            <CumulativeReport records={data} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default DoseTracker