import { useState, useEffect, useMemo } from 'react'
import { Card, Row, Col, Select, DatePicker, Table, Statistic, Tag, Spin, Progress, Space, Button } from 'antd'
import { Clock, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, BarChart3, Download, Timer, Users, Activity } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'

const { RangePicker } = DatePicker

interface TatRecord {
  key: string
  patientName: string
  accessionNumber: string
  modality: string
  bodyPart: string
  examTime: string
  reportTime: string | null
  publishTime: string | null
  tatMinutes: number
  tatLevel: 'excellent' | 'normal' | 'warning' | 'critical'
  status: string
  doctor: string
}

const DOCTORS = ['张伟明', '李晓华', '王建国', '赵丽娟', '陈志强']
const MODALITIES = ['CT', 'MR', 'DR', 'DSA', 'MG']
const STATUSES = ['已报告', '已发布', '待报告', '检查中']

function generateMockData(): TatRecord[] {
  return Array.from({ length: 48 }, (_, i) => {
    const examDate = new Date(Date.now() - Math.random() * 7 * 86400000)
    const tatMinutes = Math.floor(Math.random() * 120)
    const tatLevel: TatRecord['tatLevel'] =
      tatMinutes <= 15 ? 'excellent' : tatMinutes <= 30 ? 'normal' : tatMinutes <= 60 ? 'warning' : 'critical'
    return {
      key: `tat-${i}`,
      patientName: `患者${String.fromCharCode(65 + (i % 26))}${i}`,
      accessionNumber: `ACC${String(20260700 + i).padStart(8, '0')}`,
      modality: MODALITIES[i % MODALITIES.length],
      bodyPart: ['头颅', '胸部', '腹部', '脊柱', '四肢'][i % 5],
      examTime: examDate.toISOString(),
      reportTime: tatMinutes < 120 ? new Date(examDate.getTime() + tatMinutes * 60000).toISOString() : null,
      publishTime: tatMinutes < 120 ? new Date(examDate.getTime() + (tatMinutes + 5) * 60000).toISOString() : null,
      tatMinutes,
      tatLevel,
      status: STATUSES[i % STATUSES.length],
      doctor: DOCTORS[i % DOCTORS.length],
    }
  })
}

const TAT_LEVEL_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  excellent: { color: '#059669', bg: '#d1fae5', label: '优秀 (≤15min)' },
  normal: { color: '#2563eb', bg: '#dbeafe', label: '正常 (15-30min)' },
  warning: { color: '#d97706', bg: '#fef3c7', label: '预警 (30-60min)' },
  critical: { color: '#dc2626', bg: '#fee2e2', label: '超时 (>60min)' },
}

const columns: ColumnsType<TatRecord> = [
  {
    title: '患者',
    dataIndex: 'patientName',
    width: 100,
    render: (name: string) => <span style={{ fontWeight: 600 }}>{name}</span>,
  },
  {
    title: '检查号',
    dataIndex: 'accessionNumber',
    width: 130,
    render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
  },
  {
    title: '设备',
    dataIndex: 'modality',
    width: 60,
    render: (v: string) => <Tag color="blue">{v}</Tag>,
  },
  {
    title: '部位',
    dataIndex: 'bodyPart',
    width: 70,
  },
  {
    title: 'TAT',
    dataIndex: 'tatMinutes',
    width: 80,
    sorter: (a, b) => a.tatMinutes - b.tatMinutes,
    render: (v: number) => {
      const level = v <= 15 ? 'excellent' : v <= 30 ? 'normal' : v <= 60 ? 'warning' : 'critical'
      const cfg = TAT_LEVEL_CONFIG[level]
      return (
        <span style={{ padding: '2px 8px', borderRadius: 4, background: cfg.bg, color: cfg.color, fontWeight: 600, fontSize: 12 }}>
          {v}min
        </span>
      )
    },
  },
  {
    title: '等级',
    dataIndex: 'tatLevel',
    width: 120,
    filters: [
      { text: '优秀', value: 'excellent' },
      { text: '正常', value: 'normal' },
      { text: '预警', value: 'warning' },
      { text: '超时', value: 'critical' },
    ],
    onFilter: (value, record) => record.tatLevel === value,
    render: (v: string) => {
      const cfg = TAT_LEVEL_CONFIG[v]
      return (
        <span style={{ padding: '2px 8px', borderRadius: 4, background: cfg.bg, color: cfg.color, fontWeight: 600, fontSize: 12 }}>
          {cfg.label}
        </span>
      )
    },
  },
  {
    title: '状态',
    dataIndex: 'status',
    width: 80,
    render: (v: string) => <Tag color={v === '已发布' ? 'green' : v === '已报告' ? 'blue' : v === '待报告' ? 'orange' : 'default'}>{v}</Tag>,
  },
  {
    title: '医生',
    dataIndex: 'doctor',
    width: 80,
  },
  {
    title: '检查时间',
    dataIndex: 'examTime',
    width: 100,
    sorter: (a, b) => new Date(a.examTime).getTime() - new Date(b.examTime).getTime(),
    render: (v: string) => new Date(v).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
  },
  {
    title: '报告时间',
    dataIndex: 'reportTime',
    width: 100,
    render: (v: string | null) => v ? new Date(v).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-',
  },
]

export default function TatDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<TatRecord[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<string>('')
  const [selectedModality, setSelectedModality] = useState<string>('')
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setData(generateMockData())
      setLoading(false)
    }, 600)
    return () => clearTimeout(timer)
  }, [])

  const filteredData = useMemo(() => {
    return data.filter(r => {
      if (selectedDoctor && r.doctor !== selectedDoctor) return false
      if (selectedModality && r.modality !== selectedModality) return false
      return true
    })
  }, [data, selectedDoctor, selectedModality])

  const stats = useMemo(() => {
    const total = filteredData.length
    const excellent = filteredData.filter(r => r.tatLevel === 'excellent').length
    const normal = filteredData.filter(r => r.tatLevel === 'normal').length
    const warning = filteredData.filter(r => r.tatLevel === 'warning').length
    const critical = filteredData.filter(r => r.tatLevel === 'critical').length
    const avgTat = total > 0 ? Math.round(filteredData.reduce((s, r) => s + r.tatMinutes, 0) / total) : 0
    const onTimeRate = total > 0 ? Math.round(((excellent + normal) / total) * 100) : 0
    const completedCount = filteredData.filter(r => ['已报告', '已发布'].includes(r.status)).length
    const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0
    return { total, excellent, normal, warning, critical, avgTat, onTimeRate, completionRate }
  }, [filteredData])

  const doctorStats = useMemo(() => {
    const map = new Map<string, { count: number; avgTat: number; onTime: number }>()
    filteredData.forEach(r => {
      const existing = map.get(r.doctor) || { count: 0, avgTat: 0, onTime: 0 }
      existing.count++
      existing.avgTat += r.tatMinutes
      if (r.tatLevel === 'excellent' || r.tatLevel === 'normal') existing.onTime++
      map.set(r.doctor, existing)
    })
    return Array.from(map.entries()).map(([name, v]) => ({
      name,
      count: v.count,
      avgTat: v.count > 0 ? Math.round(v.avgTat / v.count) : 0,
      onTimeRate: v.count > 0 ? Math.round((v.onTime / v.count) * 100) : 0,
    })).sort((a, b) => a.avgTat - b.avgTat)
  }, [filteredData])

  const tatDistribution = useMemo(() => {
    const buckets = [
      { label: '≤5min', min: 0, max: 5, color: '#059669' },
      { label: '5-15min', min: 5, max: 15, color: '#10b981' },
      { label: '15-30min', min: 15, max: 30, color: '#2563eb' },
      { label: '30-60min', min: 30, max: 60, color: '#d97706' },
      { label: '>60min', min: 60, max: Infinity, color: '#dc2626' },
    ]
    return buckets.map(b => ({
      ...b,
      count: filteredData.filter(r => r.tatMinutes >= b.min && r.tatMinutes < b.max).length,
    }))
  }, [filteredData])

  const maxCount = Math.max(...tatDistribution.map(d => d.count), 1)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="加载 TAT 统计数据..." />
      </div>
    )
  }

  return (
    <div style={{ padding: '0 0 24px', background: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{ background: '#fff', padding: '20px 24px', borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e3a5f', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Clock size={24} />
              报告完成率 TAT 统计
            </h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Turnaround Time Analytics Dashboard</p>
          </div>
          <Space>
            <Select
              value={selectedDoctor || undefined}
              onChange={v => setSelectedDoctor(v || '')}
              placeholder="全部医生"
              allowClear
              style={{ width: 140 }}
              options={DOCTORS.map(d => ({ value: d, label: d }))}
            />
            <Select
              value={selectedModality || undefined}
              onChange={v => setSelectedModality(v || '')}
              placeholder="全部设备"
              allowClear
              style={{ width: 120 }}
              options={MODALITIES.map(m => ({ value: m, label: m }))}
            />
            <Button icon={<Download size={14} />}>导出</Button>
          </Space>
        </div>
      </div>

      <div style={{ padding: '0 24px' }}>
        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col span={6}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Statistic
                title="平均 TAT"
                value={stats.avgTat}
                suffix="min"
                valueStyle={{ color: stats.avgTat <= 30 ? '#059669' : stats.avgTat <= 60 ? '#d97706' : '#dc2626', fontSize: 28, fontWeight: 800 }}
                prefix={stats.avgTat <= 30 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Statistic
                title="按时完成率"
                value={stats.onTimeRate}
                suffix="%"
                valueStyle={{ color: stats.onTimeRate >= 80 ? '#059669' : stats.onTimeRate >= 60 ? '#d97706' : '#dc2626', fontSize: 28, fontWeight: 800 }}
                prefix={stats.onTimeRate >= 80 ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Statistic
                title="报告完成率"
                value={stats.completionRate}
                suffix="%"
                valueStyle={{ color: '#1e3a5f', fontSize: 28, fontWeight: 800 }}
                prefix={<Activity size={18} />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Statistic
                title="总检查数"
                value={stats.total}
                valueStyle={{ color: '#1e3a5f', fontSize: 28, fontWeight: 800 }}
                prefix={<BarChart3 size={18} />}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col span={12}>
            <Card
              title="TAT 分布"
              size="small"
              style={{ borderRadius: 8 }}
              extra={<span style={{ fontSize: 12, color: '#94a3b8' }}>各时间段占比</span>}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tatDistribution.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 70, fontSize: 12, color: '#64748b', textAlign: 'right' }}>{d.label}</span>
                    <div style={{ flex: 1, height: 20, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${(d.count / maxCount) * 100}%`,
                        height: '100%',
                        background: d.color,
                        borderRadius: 4,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <span style={{ width: 40, fontSize: 12, fontWeight: 600, color: '#334155' }}>{d.count}</span>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
          <Col span={12}>
            <Card
              title="医生 TAT 排名"
              size="small"
              style={{ borderRadius: 8 }}
              extra={<span style={{ fontSize: 12, color: '#94a3b8' }}>平均 TAT 越低越好</span>}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {doctorStats.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 60, fontSize: 12, color: '#334155', fontWeight: 600 }}>{d.name}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 11, color: '#64748b' }}>{d.count}例 · 按时率 {d.onTimeRate}%</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: d.avgTat <= 15 ? '#059669' : d.avgTat <= 30 ? '#2563eb' : '#d97706' }}>
                          {d.avgTat}min
                        </span>
                      </div>
                      <Progress
                        percent={d.onTimeRate}
                        strokeColor={d.onTimeRate >= 80 ? '#059669' : d.onTimeRate >= 60 ? '#d97706' : '#dc2626'}
                        size="small"
                        showInfo={false}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        </Row>

        <Card
          title="TAT 明细"
          size="small"
          style={{ borderRadius: 8 }}
          extra={
            <Space>
              <Tag color="green">优秀: {stats.excellent}</Tag>
              <Tag color="blue">正常: {stats.normal}</Tag>
              <Tag color="orange">预警: {stats.warning}</Tag>
              <Tag color="red">超时: {stats.critical}</Tag>
            </Space>
          }
        >
          <Table
            columns={columns}
            dataSource={filteredData}
            size="small"
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
            scroll={{ x: 1000 }}
            rowClassName={(record) => record.tatLevel === 'critical' ? 'tat-critical-row' : ''}
          />
        </Card>
      </div>
    </div>
  )
}
