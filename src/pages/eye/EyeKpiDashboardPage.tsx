import { PageContainer, PageHeader, StatCard, StatCardGrid } from '@/components/common'
import { usePagination } from '@/hooks/usePagination'
import { eyeApi } from '@/services/api/eyeApi'
import type { ApiResponse } from '@/services/api/types'
import {
  Card,
  Row,
  Col,
  Tag,
  Progress,
  Tabs,
  Badge,
  Alert,
  Button,
  Spin,
  Empty,
  Space,
} from "antd";
import { BarChart3, TrendingUp, TrendingDown, Activity, Users, DollarSign, Smile, AlertTriangle, RefreshCw } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { t } from '../../i18n/appI18n'

const categoryIcons: Record<string, React.ReactNode> = { productivity: <Activity size={16} color="#2563eb" />, clinical: <BarChart3 size={16} color="#22c55e" />, operational: <Users size={16} color="#f59e0b" />, financial: <DollarSign size={16} color="#10b981" />, satisfaction: <Smile size={16} color="#8b5cf6" /> }
const categoryColors: Record<string, string> = { productivity: '#2563eb', clinical: '#22c55e', operational: '#f59e0b', financial: '#10b981', satisfaction: '#8b5cf6' }
const CATEGORY_LABELS_DICT: Record<string, string> = { productivity: 'eyeKpi.cat.productivity', clinical: 'eyeKpi.cat.clinical', operational: 'eyeKpi.cat.operational', financial: 'eyeKpi.cat.financial', satisfaction: 'eyeKpi.cat.satisfaction' }

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
        setError(t('eyeKpi.loadFailed'))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('eyeKpi.loadFailed'))
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
        title={t('eyeKpi.title')}
        icon={<BarChart3 size={24} color="#2563eb" />}
        variant="inline"
        actions={
          <Space>
            <Tag color="cyan">v3.0.6.11-75</Tag>
            <Tag color="blue">{t('eyeKpi.metricCount', { count: filtered.length })}</Tag>
            <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()}>{t('eyeKpi.refresh')}</Button>
          </Space>
        }
      />

      {error && (
        <Alert type="error" showIcon message={t('eyeKpi.loadError')} description={error} style={{ marginBottom: 12 }}
          action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> {t('eyeKpi.retry')}</Button>} />
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : (
        <>
          <StatCardGrid minWidth={200} gap={12} testId="eye-kpi-grid" style={{ marginBottom: 12 }}>
            <StatCard title={t('eyeKpi.dailyExams')} value={kpiData.dailyExams} suffix={t('eyeKpi.unitVisits')} icon={<Activity size={16} />} />
            <StatCard title={t('eyeKpi.aiAdoption')} value={kpiData.aiAdoption} suffix="%" icon={<BarChart3 size={16} />} color="#22c55e" />
            <StatCard title={t('eyeKpi.monthlySurgery')} value={kpiData.surgeryCount ?? 0} suffix={t('eyeKpi.unitCases')} icon={<Users size={16} color="#f59e0b" />} />
            <StatCard title={t('eyeKpi.satisfaction')} value={avgSat.toFixed(1)} suffix={t('eyeKpi.unitPoints')} icon={<Smile size={16} color="#8b5cf6" />} />
            <StatCard title={t('eyeKpi.avgWait')} value={kpiData.avgWait} suffix="min" icon={<AlertTriangle size={16} color="#f59e0b" />} />
            <StatCard title={t('eyeKpi.monthlyRevenue')} value={kpiData.revenue ?? 0} suffix={t('eyeKpi.unitTenThousand')} icon={<DollarSign size={16} color="#10b981" />} />
          </StatCardGrid>

          <Card size="small">
            <Tabs
              activeKey={tab}
              onChange={setTab}
              tabBarExtraContent={
                <Badge count={filtered.length} title={t('eyeKpi.currentMetrics', { count: filtered.length })} style={{ backgroundColor: '#2563eb' }} />
              }
              items={[
                { key: 'all', label: t('eyeKpi.allMetrics') },
                ...Object.keys(categoryIcons).map((k) => ({ key: k, label: t(CATEGORY_LABELS_DICT[k] || k) })),
              ]}
            />
            {filtered.length === 0 ? <Empty image={<BarChart3 size={48} style={{opacity:0.4}}/>} description={t('eyeKpi.noMetrics')} /> : (
              <DataTable dataSource={metricPagination.pageData} rowKey="id" pagination={metricPagination.pagination}
                columns={[
                  { title: t('eyeKpi.colCategory'), dataIndex: 'category', key: 'category', width: 80, render: (v: string) => <Tag color={categoryColors[v]}>{t(CATEGORY_LABELS_DICT[v] || v)}</Tag> },
                  { title: t('eyeKpi.colMetric'), dataIndex: 'name', key: 'name', width: 200 },
                  { title: t('eyeKpi.colValue'), dataIndex: 'value', key: 'value', width: 90, render: (v: number, r: KpiMetric) => <span style={{ fontWeight: 600 }}>{v}{r.unit}</span> },
                  { title: t('eyeKpi.colTarget'), dataIndex: 'target', key: 'target', width: 70, render: (v: number) => v },
                  { title: t('eyeKpi.colRate'), key: 'rate', width: 140, render: (_, r: KpiMetric) => <PercentBar value={r.value} target={r.target} /> },
                  { title: t('eyeKpi.colTrend'), dataIndex: 'trend', key: 'trend', width: 70, render: (v: string) => v === 'up' ? <TrendingUp size={14} color="#22c55e" /> : v === 'down' ? <TrendingDown size={14} color="#ef4444" /> : <span style={{ color: 'var(--text-secondary)' }}>→</span> },
                  { title: t('eyeKpi.colPeriod'), dataIndex: 'period', key: 'period', width: 60 },
                ]} 
              scroll={{ x: 'max-content' }}/>
            )}
          </Card>

          <Card size="small" title={t('eyeKpi.satisfactionTrend')} style={{ marginTop: 8 }}>
            {patientSatisfaction.length === 0 ? <Empty description={t('eyeKpi.noSatisfaction')} image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
              <Row gutter={12}>{['eyeKpi.sat.communication', 'eyeKpi.sat.wait', 'eyeKpi.sat.environment', 'eyeKpi.sat.recommend'].map((s, i) => {
                const scores = patientSatisfaction.map(p => [p.communicationScore, p.waitTimeScore, p.facilityScore, p.recommendationScore][i] ?? 0)
                const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                return <Col span={6} key={s}><div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t(s)}</div><Progress type="dashboard" percent={avg} size={60} strokeColor={avg >= 90 ? '#22c55e' : avg >= 80 ? '#2563eb' : '#f59e0b'} /><div style={{ fontSize: 12, fontWeight: 600 }}>{avg}{t('eyeKpi.unitPoints')}</div></div></Col>
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

import { DataTable } from "../../components/common";