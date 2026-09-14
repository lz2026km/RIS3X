/**
 * G005 v3.0.6.11-75 W3-1 - 患者安全与质量指标看板
 * safetyApi 真实数据: adverse events 统计/风险项 + 图表 + 最新事件 + loading/error
 */
import {
  getAdverseEvents, getRiskItems, getAdverseEventTrend,
  type AdverseEvent, type RiskItem, type AdverseEventTrendItem,
} from '../../services/api/safetyApi'
import {
  Card, Space, Tag, Row, Col, Statistic, Progress, Table, Badge, List, Segmented, Alert, Button, Empty, Tabs,
} from 'antd'
import { Shield, AlertTriangle, Activity, Heart, RefreshCw } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { Inbox } from 'lucide-react'
import { t } from '../../i18n/appI18n'

const SEVERITY_LABELS: Record<string, string> = {
  'near-miss': t('psd.sev.nearMiss'), minor: t('psd.sev.minor'), moderate: t('psd.sev.moderate'), severe: t('psd.sev.severe'), catastrophic: t('psd.sev.catastrophic'),
}
const STATUS_LABELS: Record<string, string> = {
  reported: t('psd.status.reported'), investigating: t('psd.status.investigating'), resolved: t('psd.status.resolved'), closed: t('psd.status.closed'),
}
const RISK_LEVEL_META: Record<string, { color: string; label: string }> = {
  'very-high': { color: '#dc2626', label: t('psd.risk.veryHigh') },
  high: { color: '#f59e0b', label: t('psd.risk.high') },
  medium: { color: '#3b82f6', label: t('psd.risk.medium') },
  low: { color: '#10b981', label: t('psd.risk.low') },
  'very-low': { color: '#94a3b8', label: t('psd.risk.veryLow') },
}

const PatientSafetyDashboardPage: React.FC = () => {
  const [range, setRange] = useState('today')
  const [events, setEvents] = useState<AdverseEvent[]>([])
  const [risks, setRisks] = useState<RiskItem[]>([])
  const [trend, setTrend] = useState<AdverseEventTrendItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [evtRes, riskRes, trendData] = await Promise.all([
        getAdverseEvents(),
        getRiskItems(),
        getAdverseEventTrend().catch(() => []),
      ])
      setEvents(evtRes ?? [])
      setRisks(riskRes ?? [])
      setTrend(Array.isArray(trendData) ? trendData : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : t('psd.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const openCount = events.filter((e) => e.status === 'reported' || e.status === 'investigating').length
  const closedCount = events.filter((e) => e.status === 'closed').length
  const highRiskCount = risks.filter((r) => r.riskLevel === 'high' || r.riskLevel === 'very-high').length
  const safetyScore = events.length > 0
    ? Math.max(60, Math.round(100 - (openCount * 4) - (highRiskCount * 3)))
    : 96

  const severityDist = (list: AdverseEvent[]) => {
    const out: Record<string, number> = {}
    for (const e of list) out[e.severity] = (out[e.severity] ?? 0) + 1
    return Object.entries(out).map(([k, v]) => ({ key: k, label: SEVERITY_LABELS[k] ?? k, count: v }))
  }

  const categoryDist = (list: AdverseEvent[]) => {
    const out: Record<string, number> = {}
    for (const e of list) out[e.eventType] = (out[e.eventType] ?? 0) + 1
    return Object.entries(out)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k, v]) => ({ key: k, count: v }))
  }

  const trendWindow = range === 'today' ? trend.slice(-1) : range === 'week' ? trend.slice(-2) : trend

  return (
    <div style={{ padding: 24, background: 'var(--bg-primary, #f5f7fa)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Shield size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('psd.title')}</span>
        <Tag color="cyan">v3.0.6.11-75</Tag>
        <Tag color="red" icon={<AlertTriangle size={10} />}>{t('psd.realtime')}</Tag>
        <Segmented value={range} onChange={setRange as any}
          options={[{ value: 'today', label: t('psd.range.today') }, { value: 'week', label: t('psd.range.week') }, { value: 'month', label: t('psd.range.month') }]} />
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()}>{t('psd.refresh')}</Button>
      </Space>

      {error && (
        <Alert type="error" showIcon message={t('psd.loadError')} description={error} style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> {t('psd.retry')}</Button>} />
      )}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title={t('psd.kpiScore')} value={loading ? 0 : safetyScore} suffix="/100" prefix={<Shield size={14} />} loading={loading} styles={{ content: { color: safetyScore >= 90 ? 'var(--color-success-500, #22c55e)' : 'var(--color-warning-500, #f59e0b)' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('psd.kpiOpen')} value={openCount} loading={loading} styles={{ content: { color: 'var(--color-warning-500, #f59e0b)' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('psd.kpiClosed')} value={closedCount} loading={loading} styles={{ content: { color: 'var(--color-success-500, #22c55e)' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('psd.kpiHighRisk')} value={highRiskCount} loading={loading} styles={{ content: { color: 'var(--color-error-500, #ef4444)' } }} /></Card></Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={16}>
          <Card size="small" title={<Space><Activity size={14} />{t('psd.distTrend')}</Space>} loading={loading}>
            <Tabs
              items={[
                {
                  key: 'severity',
                  label: t('psd.tabSeverity'),
                  children: (
                    <Row gutter={[8, 8]}>
                      {severityDist(events).map((s) => (
                        <Col span={12} key={s.key}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, width: 70 }}>{s.label}</span>
                            <Progress percent={events.length ? Math.round((s.count / events.length) * 100) : 0} size="small" style={{ flex: 1, margin: 0 }} strokeColor={s.key === 'severe' || s.key === 'catastrophic' ? 'var(--color-error-500, #ef4444)' : 'var(--color-primary-600, #2563eb)'} />
                            <span style={{ fontSize: 12, color: '#64748b', width: 30 }}>{s.count}</span>
                          </div>
                        </Col>
                      ))}
                    </Row>
                  ),
                },
                {
                  key: 'category',
                  label: t('psd.tabCategory'),
                  children: (
                    <Row gutter={[8, 8]}>
                      {categoryDist(events).map((c) => (
                        <Col span={12} key={c.key}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, width: 110 }}>{CATEGORY_LABELS[c.key] ?? c.key}</span>
                            <Progress percent={events.length ? Math.round((c.count / events.length) * 100) : 0} size="small" style={{ flex: 1, margin: 0 }} />
                            <span style={{ fontSize: 12, color: '#64748b', width: 30 }}>{c.count}</span>
                          </div>
                        </Col>
                      ))}
                    </Row>
                  ),
                },
                {
                  key: 'trend',
                  label: t('psd.tabTrend'),
                  children: (
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 120, paddingTop: 12 }}>
                      {trendWindow.map((t) => (
                        <div key={t.period} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{t.total}</span>
                          <div style={{ width: 32, height: Math.max(4, t.total * 14), background: t.total > 5 ? 'var(--color-error-500, #ef4444)' : 'var(--color-primary-500, #3b82f6)', borderRadius: '4px 4px 0 0' }} />
                          <span style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{t.period}</span>
                        </div>
                      ))}
                      {trendWindow.length === 0 && <Empty description={t('psd.noTrend')} image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card size="small" title={<Space><AlertTriangle size={14} />{t('psd.highRiskRpn')}</Space>} loading={loading} style={{ marginBottom: 12 }}>
            {risks.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
              <List
                size="small"
                dataSource={risks.slice(0, 6)}
                renderItem={(r) => (
                  <List.Item style={{ padding: '6px 0' }}>
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <span style={{ fontSize: 13 }}>{r.title}</span>
                        <Tag color={RISK_LEVEL_META[r.riskLevel]?.color} style={{ marginInlineEnd: 0 }}>{RISK_LEVEL_META[r.riskLevel]?.label ?? r.riskLevel}</Tag>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <span style={{ fontSize: 11, color: '#64748b' }}>{r.category} · {r.status}</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>RPN {r.rpn}</span>
                      </div>
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Card size="small" title={<Space><Heart size={14} />{t('psd.latestEvents')}</Space>} loading={loading}>
        {events.length === 0 ? <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('psd.noEvents')} /> : (
          <Table
            dataSource={events.slice(0, 10)} rowKey="id" pagination={false} size="small"
            columns={[
              { title: t('psd.colTime'), dataIndex: 'reportedAt', width: 150, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
              { title: t('psd.colType'), dataIndex: 'eventType', render: (v: string) => <Tag color="blue">{CATEGORY_LABELS[v] ?? v}</Tag> },
              { title: t('psd.colPatient'), dataIndex: 'patientName', width: 110, render: (v?: string) => v ?? '-' },
              { title: t('psd.tabSeverity'), dataIndex: 'severity', width: 100, render: (v: string) => <Tag color={v === 'severe' || v === 'catastrophic' ? 'red' : v === 'moderate' ? 'orange' : 'blue'}>{SEVERITY_LABELS[v] ?? v}</Tag> },
              { title: t('psd.colDepartment'), dataIndex: 'department', width: 100 },
              { title: t('psd.colDescription'), dataIndex: 'description', ellipsis: true },
              { title: t('psd.colStatus'), dataIndex: 'status', width: 90, render: (v: string) => <Badge status={v === 'closed' ? 'success' : v === 'investigating' ? 'processing' : 'warning'} text={STATUS_LABELS[v] ?? v} /> },
            ]}
          scroll={{ x: 'max-content' }}
          />
        )}
      </Card>
    </div>
  )
}

const CATEGORY_LABELS: Record<string, string> = {
  'medication-error': t('psd.cat.medicationError'), 'patient-identification': t('psd.cat.patientId'), 'contrast-reaction': t('psd.cat.contrastReaction'),
  'radiation-overdose': t('psd.cat.radiationOverdose'), fall: t('psd.cat.fall'), 'specimen-error': t('psd.cat.specimenError'), 'communication-failure': t('psd.cat.communicationFailure'),
  'equipment-malfunction': t('psd.cat.equipmentMalfunction'), 'information-loss': t('psd.cat.informationLoss'), other: t('psd.cat.other'),
}

export default PatientSafetyDashboardPage
