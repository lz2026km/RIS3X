/**
 * G005 放射RIS系统 v3.0.2.2 - 辐射剂量追踪
 * 对标:欧盟 EURATOM 97/43 / ICRP 剂量参考水平
 *
 * 关键指标:
 *  - CTDIvol(mGy)
 *  - DLP(mGy·cm)
 *  - 有效剂量(mSv)— 用 DLP × 转换因子
 *  - 累积剂量(按患者/检查类型/设备)
 */
import React, { useMemo } from 'react'
import { Card, Tag, Space, Table, Statistic, Row, Col, Alert, Progress, Tooltip, Empty } from 'antd'
import { Zap, TrendingUp, AlertTriangle, Shield, Activity, Database } from 'lucide-react'

export type Modality = 'CT' | 'DR' | 'MG' | 'DSA' | 'PETCT'

export interface DoseRecord {
  id: string
  patientId: string
  patientName: string
  modality: Modality
  bodyPart: string
  examDate: string
  deviceName: string
  ctdiVol?: number // mGy (CT only)
  dlp?: number // mGy·cm (CT only)
  /** 有效剂量 (mSv) — 估算 */
  effectiveDose?: number
  /** 参考水平(mSv) — DRL */
  referenceLevel?: number
  /** 超出比例(%) */
  overPercent?: number
}

const REFERENCE_LEVELS: Record<string, number> = {
  // ICRP 102 / 国内 DRL
  'CT-CHEST': 6.5, // mSv
  'CT-ABDOMEN': 10,
  'CT-HEAD': 2,
  'CT-PELVIS': 9,
  'DR-CHEST': 0.05,
  'MG-BREAST': 0.4,
  'DSA-CORONARY': 7,
}

export interface ExamDoseTrackerProps {
  records: DoseRecord[]
  onSelect?: (id: string) => void
}

export const ExamDoseTracker: React.FC<ExamDoseTrackerProps> = ({ records, onSelect }) => {
  const stats = useMemo(() => {
    const totalEffective = records.reduce((s, r) => s + (r.effectiveDose ?? 0), 0)
    const overLimit = records.filter((r) => r.overPercent && r.overPercent > 0).length
    const uniquePatients = new Set(records.map((r) => r.patientId)).size
    return {
      total: records.length,
      totalEffective: totalEffective.toFixed(1),
      avgEffective: records.length > 0 ? (totalEffective / records.length).toFixed(2) : '0',
      overLimit,
      uniquePatients,
    }
  }, [records])

  const byModality = useMemo(() => {
    const m: Record<string, { count: number; dose: number }> = {}
    records.forEach((r) => {
      const entry = m[r.modality] ?? { count: 0, dose: 0 }
      entry.count++
      entry.dose += r.effectiveDose ?? 0
      m[r.modality] = entry
    })
    return Object.entries(m).map(([k, v]) => ({ modality: k, ...v, dose: v.dose.toFixed(1) }))
  }, [records])

  return (
    <Card
      data-testid="exam-dose-tracker"
      size="small"
      title={
        <Space>
          <Zap size={16} color="#dc2626" />
          <span>辐射剂量追踪</span>
        </Space>
      }
    >
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="累积有效剂量"
              value={stats.totalEffective}
              suffix="mSv"
              prefix={<Activity size={14} color="#dc2626" />}
              styles={{ content: {  color: '#dc2626'  } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="平均有效剂量"
              value={stats.avgEffective}
              suffix="mSv"
              prefix={<TrendingUp size={14} color="#ca8a04" />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="超出 DRL"
              value={stats.overLimit}
              prefix={<AlertTriangle size={14} color="#dc2626" />}
              styles={{ content: {  color: stats.overLimit > 0 ? '#dc2626' : '#16a34a'  } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="患者数" value={stats.uniquePatients} prefix={<Database size={14} />} />
          </Card>
        </Col>
      </Row>

      {stats.overLimit > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<Shield size={14} />}
          message={`${stats.overLimit} 项检查超出参考水平(DRL)`}
          description="建议优化协议或确认临床必要性"
          style={{ marginBottom: 12 }}
        />
      )}

      <div data-testid="edt-modality-summary" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>按模态分布</div>
        <Row gutter={8}>
          {byModality.map((m) => (
            <Col key={m.modality} span={6}>
              <Card size="small" style={{ background: '#f8fafc' }}>
                <Tag color="blue">{m.modality}</Tag>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{m.count} 次</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{m.dose} mSv</div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      <Table
        size="small"
        dataSource={records}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        data-testid="edt-table"
        columns={[
          { title: '患者', dataIndex: 'patientName', width: 100 },
          {
            title: '检查',
            dataIndex: 'modality',
            width: 90,
            render: (m: Modality) => <Tag color="blue">{m}</Tag>,
          },
          { title: '部位', dataIndex: 'bodyPart', width: 100 },
          { title: '设备', dataIndex: 'deviceName', width: 120 },
          { title: '日期', dataIndex: 'examDate', width: 100 },
          {
            title: 'CTDIvol',
            dataIndex: 'ctdiVol',
            width: 80,
            render: (v) => (v !== undefined ? `${v} mGy` : '-'),
          },
          {
            title: 'DLP',
            dataIndex: 'dlp',
            width: 90,
            render: (v) => (v !== undefined ? `${v} mGy·cm` : '-'),
          },
          {
            title: '有效剂量',
            dataIndex: 'effectiveDose',
            width: 100,
            render: (v) => (v !== undefined ? `${v.toFixed(2)} mSv` : '-'),
          },
          {
            title: 'DRL 对比',
            dataIndex: 'overPercent',
            width: 140,
            render: (v, r: DoseRecord) => {
              if (v === undefined) return '-'
              const ref = r.referenceLevel ?? REFERENCE_LEVELS[`${r.modality}-${r.bodyPart}`] ?? 5
              const pct = ref > 0 ? Math.min(150, (r.effectiveDose ?? 0) / ref * 100) : 0
              return (
                <Tooltip title={`参考 ${ref} mSv`}>
                  <Progress
                    percent={pct}
                    size="small"
                    showInfo
                    format={() => `${pct.toFixed(0)}%`}
                    strokeColor={pct > 100 ? '#dc2626' : pct > 80 ? '#ca8a04' : '#16a34a'}
                  />
                </Tooltip>
              )
            },
          },
        ]}
        onRow={(r) => ({
          onClick: () => onSelect?.(r.id),
          style: { cursor: 'pointer' },
        })}
        scroll={{ x: 1000 }}
        locale={{ emptyText: <Empty description="无剂量记录" /> }}
      />
    </Card>
  )
}

export default ExamDoseTracker
