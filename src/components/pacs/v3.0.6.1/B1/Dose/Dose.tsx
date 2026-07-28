/**
 * G005 放射RIS系统 v3.0.6.1 - GE Centricity DoseWatch 辐射剂量追踪入口
 * 对标:GE DoseWatch - CT/DR/MR DLP/CTDI/累积剂量 全程追踪
 */
import React, { useState, useEffect } from 'react'
import { Card, Table, Statistic, Row, Col, Tag, Progress, Empty } from 'antd'

interface DoseRecord {
  id: string
  patientName: string
  patientId: string
  modality: string
  bodyPart: string
  examAt: string
  ctdivol_mGy: number
  dlp_mGycm: number
  effectiveDose_mSv: number
  drs: number
  protocol: string
  cumulativeDose_mSv: number
  diagnosticRefLevel_mSv: number
  status: 'NORMAL' | 'WARNING' | 'EXCEEDED'
}

const MOCK_DOSE: DoseRecord[] = [
  { id: 'D001', patientName: '王建国', patientId: 'P20240618001', modality: 'CT', bodyPart: '头颅平扫', examAt: '2024-06-18 09:00', ctdivol_mGy: 65, dlp_mGycm: 850, effectiveDose_mSv: 1.8, drs: 18, protocol: 'Head-Adult-Routine', cumulativeDose_mSv: 12.5, diagnosticRefLevel_mSv: 2.0, status: 'NORMAL' },
  { id: 'D002', patientName: '李美芳', patientId: 'P20240618002', modality: 'CT', bodyPart: '胸部增强', examAt: '2024-06-18 09:30', ctdivol_mGy: 12, dlp_mGycm: 420, effectiveDose_mSv: 6.2, drs: 32, protocol: 'Chest-Adult-Contrast', cumulativeDose_mSv: 24.8, diagnosticRefLevel_mSv: 7.0, status: 'WARNING' },
  { id: 'D003', patientName: '张伟', patientId: 'P20240618003', modality: 'CT', bodyPart: '腹部三期', examAt: '2024-06-18 10:00', ctdivol_mGy: 18, dlp_mGycm: 980, effectiveDose_mSv: 14.5, drs: 68, protocol: 'Abdomen-3Phase', cumulativeDose_mSv: 48.2, diagnosticRefLevel_mSv: 10.0, status: 'EXCEEDED' },
  { id: 'D004', patientName: '陈晓敏', patientId: 'P20240618004', modality: 'CT', bodyPart: '冠脉CTA', examAt: '2024-06-18 10:30', ctdivol_mGy: 35, dlp_mGycm: 620, effectiveDose_mSv: 8.5, drs: 45, protocol: 'Cardiac-CTA', cumulativeDose_mSv: 16.3, diagnosticRefLevel_mSv: 12.0, status: 'NORMAL' },
  { id: 'D005', patientName: '刘强', patientId: 'P20240618005', modality: 'DR', bodyPart: '胸部正侧位', examAt: '2024-06-18 11:00', ctdivol_mGy: 0, dlp_mGycm: 0, effectiveDose_mSv: 0.05, drs: 1, protocol: 'DR-Chest-PA-Lat', cumulativeDose_mSv: 0.6, diagnosticRefLevel_mSv: 0.4, status: 'WARNING' },
  { id: 'D006', patientName: '赵丽华', patientId: 'P20240618006', modality: 'CT', bodyPart: '胸部低剂量', examAt: '2024-06-18 11:30', ctdivol_mGy: 3.5, dlp_mGycm: 110, effectiveDose_mSv: 1.5, drs: 12, protocol: 'Chest-LD-Screening', cumulativeDose_mSv: 5.8, diagnosticRefLevel_mSv: 2.0, status: 'NORMAL' },
]

const STATUS_META: Record<DoseRecord['status'], { color: string; label: string }> = {
  NORMAL: { color: 'green', label: '正常' },
  WARNING: { color: 'orange', label: '接近阈值' },
  EXCEEDED: { color: 'red', label: '超阈值' },
}

const Dose: React.FC = () => {
  const [tick, setTick] = useState<number>(0)
  const [filterModality, setFilterModality] = useState<string>('ALL')

  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 30000)
    return () => window.clearInterval(t)
  }, [])

  const total = MOCK_DOSE.length
  const exceededCount = MOCK_DOSE.filter((d) => d.status === 'EXCEEDED').length
  const warningCount = MOCK_DOSE.filter((d) => d.status === 'WARNING').length
  const ctStudies = MOCK_DOSE.filter((d) => d.modality === 'CT').length
  const avgEffective = total ? Math.round((MOCK_DOSE.reduce((s, d) => s + d.effectiveDose_mSv, 0) / total) * 100) / 100 : 0
  const totalDLP = MOCK_DOSE.reduce((s, d) => s + d.dlp_mGycm, 0)
  const totalCumulative = MOCK_DOSE.reduce((s, d) => s + d.cumulativeDose_mSv, 0)

  const filteredData = filterModality === 'ALL' ? MOCK_DOSE : MOCK_DOSE.filter((d) => d.modality === filterModality)

  const modalityStats = ['CT', 'DR', 'MR'].map((mod) => {
    const items = MOCK_DOSE.filter((d) => d.modality === mod)
    return {
      modality: mod,
      count: items.length,
      avgDose: items.length ? Math.round((items.reduce((s, d) => s + d.effectiveDose_mSv, 0) / items.length) * 100) / 100 : 0,
    }
  })

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    {
      title: '患者',
      key: 'patient',
      width: 130,
      render: (_: unknown, r: DoseRecord) => (
        <span>
          <strong>{r.patientName}</strong>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.patientId}</div>
        </span>
      ),
    },
    {
      title: '检查',
      key: 'exam',
      width: 150,
      render: (_: unknown, r: DoseRecord) => (
        <Tag color="blue">
          {r.modality} {r.bodyPart}
        </Tag>
      ),
    },
    {
      title: 'CTDIvol (mGy)',
      dataIndex: 'ctdivol_mGy',
      key: 'ctdivol',
      width: 120,
      render: (v: number) => (v > 0 ? v.toFixed(1) : '—'),
    },
    {
      title: 'DLP (mGy·cm)',
      dataIndex: 'dlp_mGycm',
      key: 'dlp',
      width: 120,
      render: (v: number) => (v > 0 ? v.toLocaleString() : '—'),
    },
    {
      title: '有效剂量 (mSv)',
      dataIndex: 'effectiveDose_mSv',
      key: 'effective',
      width: 130,
      render: (v: number) => (
        <Tag color={v > 10 ? 'red' : v > 5 ? 'orange' : 'green'}>{v.toFixed(2)}</Tag>
      ),
    },
    {
      title: 'DRS 剂量评分',
      dataIndex: 'drs',
      key: 'drs',
      width: 110,
      render: (d: number) => <Tag color={d > 50 ? 'red' : d > 20 ? 'orange' : 'green'}>{d}</Tag>,
    },
    {
      title: '累积剂量 vs DRL',
      key: 'cumulative',
      width: 200,
      render: (_: unknown, r: DoseRecord) => {
        const pct = Math.min(Math.round((r.cumulativeDose_mSv / (r.diagnosticRefLevel_mSv * 3)) * 100), 100)
        return (
          <div>
            <Progress
              percent={pct}
              size="small"
              strokeColor={pct > 80 ? '#dc2626' : pct > 50 ? '#f59e0b' : '#16a34a'}
            />
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {r.cumulativeDose_mSv.toFixed(1)} / DRL {r.diagnosticRefLevel_mSv.toFixed(1)} mSv
            </div>
          </div>
        )
      },
    },
    { title: '协议', dataIndex: 'protocol', key: 'protocol', width: 160 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: DoseRecord['status']) => <Tag color={STATUS_META[s].color}>{STATUS_META[s].label}</Tag>,
    },
  ]

  return (
    <div data-testid="dose-root">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={4}>
          <Card size="small">
            <Statistic title="总检查" value={total} valueStyle={{ color: '#3b82f6' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="CT 检查" value={ctStudies} valueStyle={{ color: '#3b82f6' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="超阈值" value={exceededCount} valueStyle={{ color: '#dc2626' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="接近阈值" value={warningCount} valueStyle={{ color: '#f59e0b' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="平均有效剂量" value={avgEffective} suffix="mSv" precision={2} valueStyle={{ color: '#16a34a' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="总 DLP" value={totalDLP} suffix="mGy·cm" valueStyle={{ color: '#3b82f6' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={12}>
          <Card size="small" title="各设备平均有效剂量">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {modalityStats.map((m) => {
                const max = 20
                const pct = Math.min(Math.round((m.avgDose / max) * 100), 100)
                return (
                  <div key={m.modality}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                      <span>
                        <Tag color="blue">{m.modality}</Tag> 平均 {m.avgDose.toFixed(2)} mSv · {m.count} 例
                      </span>
                      <span style={{ color: '#64748b' }}>{pct}%</span>
                    </div>
                    <Progress percent={pct} size="small" showInfo={false} strokeColor="#3b82f6" />
                  </div>
                )
              })}
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                患者累积剂量合计:{totalCumulative.toFixed(1)} mSv · 参照国家诊断参考水平(DRL)
              </div>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title="过滤器">
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>检查设备</div>
              <select
                value={filterModality}
                onChange={(e) => setFilterModality(e.target.value)}
                style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
              >
                <option value="ALL">全部设备</option>
                <option value="CT">CT</option>
                <option value="DR">DR</option>
                <option value="MR">MR</option>
              </select>
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.7, color: '#475569' }}>
              <div>· 自动采集 RDSR/DICOM SR 剂量信息</div>
              <div>· 超阈值自动告警临床医师</div>
              <div>· 季度剂量回顾与协议优化建议</div>
              <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8' }}>数据刷新 tick={tick}</div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card size="small" title="剂量记录明细">
        <Table<DoseRecord>
          rowKey="id"
          size="small"
          dataSource={filteredData}
          columns={columns}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1300 }}
          locale={{ emptyText: <Empty description="暂无剂量记录" /> }}
        />
      </Card>
    </div>
  )
}

export default Dose