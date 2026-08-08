import React, { useCallback, useEffect, useState } from 'react'
import { Card, Row, Col, Tag, Statistic, Table, Progress, Tabs, Badge, Alert, Button, Spin, Empty, Space } from 'antd'
import { BarChart3, TrendingUp, TrendingDown, Activity, Users, DollarSign, Smile, AlertTriangle, RefreshCw } from 'lucide-react'
import { eyeApi } from '@/services/api/eyeApi'
import { PageContainer, PageHeader } from '@/components/common'
import type { ApiResponse } from '@/services/api/types'
import { usePagination } from '@/hooks/usePagination'

const categoryIcons: Record<string, React.ReactNode> = { productivity: <Activity size={16} color="#2563eb" />, clinical: <BarChart3 size={16} color="#22c55e" />, operational: <Users size={16} color="#f59e0b" />, financial: <DollarSign size={16} color="#10b981" />, satisfaction: <Smile size={16} color="#8b5cf6" /> }
const categoryColors: Record<string, string> = { productivity: '#2563eb', clinical: '#22c55e', operational: '#f59e0b', financial: '#10b981', satisfaction: '#8b5cf6' }
const CATEGORY_LABELS_DICT: Record<string, string> = { productivity: '效率', clinical: '临床', operational: '运营', financial: '财务', satisfaction: '满意度' }

interface KpiMetric {
  id: string
  category: string
  name: string
  value: number
  target: number
  unit: string
  trend: string
  period: string
}

interface SatisfactionItem {
  id: string
  patientName: string
  communicationScore: number
  waitTimeScore: number
  facilityScore: number
  recommendationScore: number
  overallScore: number
  surveyAt: string
}

interface KpiSummary {
  dailyExams: number
  aiAdoption: number
  avgWait: number
  avgCost: number
  criticalResponse: number
  surgeryCount?: number
  examCount?: number
  revenue?: number
}

const EyeKpiDashboardPage: React.FC = () => {
  const [tab, setTab] = useState('all')
  const [qualityMetrics, setQualityMetrics] = useState<KpiMetric[]>([])
  const [patientSatisfaction, setPatientSatisfaction] = useState<SatisfactionItem[]>([])
  const [kpiData, setKpiData] = useState<KpiSummary>({ dailyExams: 0, aiAdoption: 0, avgWait: 0, avgCost: 0, criticalResponse: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [qmRes, satRes, kpiRes] = await Promise.all([
        eyeApi.getQualityMetrics(),
        eyeApi.getPatientSatisfaction(),
        eyeApi.getKpiSummary(),
      ])
      const unwrap = <T,>(r: ApiResponse<unknown>): T | null => (r.success ? (r.data as T) : null)
      const metrics = unwrap<KpiMetric[]>(qmRes as ApiResponse<unknown>)
      const sat = unwrap<SatisfactionItem[]>(satRes as ApiResponse<unknown>)
      const summary = unwrap<KpiSummary>(kpiRes as ApiResponse<unknown>)
      if (Array.isArray(metrics)) setQualityMetrics(metrics)
      if (Array.isArray(sat)) setPatientSatisfaction(sat)
      if (summary) setKpiData(summary)
      if (!qmRes.success && !satRes.success && !kpiRes.success) {
        setError('眼科 KPI 数据加载失败')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '眼科 KPI 数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = tab === 'all' ? qualityMetrics : qualityMetrics.filter(m => m.category === tab)
  // [W3-C] 受控分页: 指标表
  const metricPagination = usePagination(filtered, 10)
  const avgSat = patientSatisfaction.length > 0
    ? patientSatisfaction.reduce((s, p) => s + (p.overallScore || 0), 0) / patientSatisfaction.length
    : 0

  return (
    <PageContainer background="slate" maxWidth="full" padding={16} testId="eye-kpi-dashboard-page">
      <PageHeader
        title="眼科质控看板"
        icon={<BarChart3 size={24} color="#2563eb" />}
        variant="inline"
        actions={
          <Space>
            <Tag color="cyan">v3.0.6.11-75</Tag>
            <Tag color="blue">{filtered.length} 指标</Tag>
            <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()}>刷新</Button>
          </Space>
        }
      />

      {error && (
        <Alert type="error" showIcon message="加载失败" description={error} style={{ marginBottom: 12 }}
          action={<Button size="small" onClick={() => void load()}>重试</Button>} />
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : (
        <>
          <div data-testid="eye-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 12 }}>
            <Card size="small"><Statistic title="日均检查" value={kpiData.dailyExams} suffix="人次" prefix={<Activity size={16} />} /></Card>
            <Card size="small"><Statistic title="AI采纳率" value={kpiData.aiAdoption} suffix="%" prefix={<BarChart3 size={16} />} styles={{ content: { color: '#22c55e' } }} /></Card>
            <Card size="small"><Statistic title="月手术量" value={kpiData.surgeryCount ?? 0} suffix="台" prefix={<Users size={16} color="#f59e0b" />} /></Card>
            <Card size="small"><Statistic title="患者满意度" value={avgSat.toFixed(1)} suffix="分" prefix={<Smile size={16} color="#8b5cf6" />} /></Card>
            <Card size="small"><Statistic title="平均候诊" value={kpiData.avgWait} suffix="min" prefix={<AlertTriangle size={16} color="#f59e0b" />} /></Card>
            <Card size="small"><Statistic title="月检查收入" value={kpiData.revenue ?? 0} suffix="万" prefix={<DollarSign size={16} color="#10b981" />} /></Card>
          </div>

          <Card size="small">
            <Tabs
              activeKey={tab}
              onChange={setTab}
              tabBarExtraContent={
                <Badge count={filtered.length} title={`当前 ${filtered.length} 项指标`} style={{ backgroundColor: '#2563eb' }} />
              }
              items={[
                { key: 'all', label: '全部指标' },
                ...Object.keys(categoryIcons).map((k) => ({ key: k, label: CATEGORY_LABELS_DICT[k] || k })),
              ]}
            />
            {filtered.length === 0 ? <Empty description="暂无指标数据" /> : (
              <Table dataSource={metricPagination.pageData} rowKey="id" size="small" pagination={metricPagination.pagination}
                columns={[
                  { title: '类别', dataIndex: 'category', key: 'category', width: 80, render: (v: string) => <Tag color={categoryColors[v]}>{CATEGORY_LABELS_DICT[v] || v}</Tag> },
                  { title: '指标', dataIndex: 'name', key: 'name', width: 200 },
                  { title: '值', dataIndex: 'value', key: 'value', width: 90, render: (v: number, r: KpiMetric) => <span style={{ fontWeight: 600 }}>{v}{r.unit}</span> },
                  { title: '目标', dataIndex: 'target', key: 'target', width: 70, render: (v: number) => v },
                  { title: '达成率', key: 'rate', width: 140, render: (_, r: KpiMetric) => <PercentBar value={r.value} target={r.target} /> },
                  { title: '趋势', dataIndex: 'trend', key: 'trend', width: 70, render: (v: string) => v === 'up' ? <TrendingUp size={14} color="#22c55e" /> : v === 'down' ? <TrendingDown size={14} color="#ef4444" /> : <span style={{ color: '#94a3b8' }}>→</span> },
                  { title: '周期', dataIndex: 'period', key: 'period', width: 60 },
                ]} 
              scroll={{ x: 'max-content' }}/>
            )}
          </Card>

          <Card size="small" title="患者满意度趋势" style={{ marginTop: 8 }}>
            {patientSatisfaction.length === 0 ? <Empty description="暂无满意度数据" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
              <Row gutter={12}>{['沟通', '候诊', '环境', '推荐'].map((s, i) => {
                const scores = patientSatisfaction.map(p => [p.communicationScore, p.waitTimeScore, p.facilityScore, p.recommendationScore][i] ?? 0)
                const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                return <Col span={6} key={s}><div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: '#64748b' }}>{s}</div><Progress type="dashboard" percent={avg} size={60} strokeColor={avg >= 90 ? '#22c55e' : avg >= 80 ? '#2563eb' : '#f59e0b'} /><div style={{ fontSize: 12, fontWeight: 600 }}>{avg}分</div></div></Col>
              })}</Row>
            )}
          </Card>
        </>
      )}
    </PageContainer>
  )
}

const PercentBar: React.FC<{ value: number; target: number }> = ({ value, target }) => {
  const pct = Math.min(Math.round((value / target) * 100), 100)
  return <Progress percent={pct} size="small" strokeColor={pct >= 90 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444'} style={{ margin: 0 }} />
}
export default EyeKpiDashboardPage
