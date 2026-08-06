/**
 * G005 v3.0.6.11-75 W3-1 - 患者安全与质量指标看板
 * safetyApi 真实数据: adverse events 统计/风险项 + 图表 + 最新事件 + loading/error
 */
import React, { useCallback, useEffect, useState } from 'react'
import {
  Card, Space, Tag, Row, Col, Statistic, Progress, Table, Badge, List, Segmented, Alert, Button, Empty, Tabs,
} from 'antd'
import { Shield, AlertTriangle, Activity, Heart, RefreshCw } from 'lucide-react'
import {
  getAdverseEvents, getRiskItems, getAdverseEventTrend,
  type AdverseEvent, type RiskItem, type AdverseEventTrendItem,
} from '../../services/api/safetyApi'

const SEVERITY_LABELS: Record<string, string> = {
  'near-miss': '未遂事件', minor: '轻微', moderate: '中度', severe: '严重', catastrophic: '灾难性',
}
const STATUS_LABELS: Record<string, string> = {
  reported: '已上报', investigating: '调查中', resolved: '已解决', closed: '已关闭',
}
const RISK_LEVEL_META: Record<string, { color: string; label: string }> = {
  'very-high': { color: '#dc2626', label: '极高' },
  high: { color: '#f59e0b', label: '高' },
  medium: { color: '#3b82f6', label: '中' },
  low: { color: '#10b981', label: '低' },
  'very-low': { color: '#94a3b8', label: '极低' },
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
      setError(e instanceof Error ? e.message : '安全数据加载失败')
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
    <div style={{ padding: 24, background: '#f5f7fa', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Shield size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>患者安全与质量仪表板</span>
        <Tag color="cyan">v3.0.6.11-75</Tag>
        <Tag color="red" icon={<AlertTriangle size={10} />}>实时</Tag>
        <Segmented value={range} onChange={setRange as any}
          options={[{ value: 'today', label: '今日' }, { value: 'week', label: '近周' }, { value: 'month', label: '近月' }]} />
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()}>刷新</Button>
      </Space>

      {error && (
        <Alert type="error" showIcon message="加载失败" description={error} style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={() => void load()}>重试</Button>} />
      )}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="安全评分" value={loading ? 0 : safetyScore} suffix="/100" prefix={<Shield size={14} />} loading={loading} styles={{ content: { color: safetyScore >= 90 ? '#52c41a' : '#faad14' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="未关闭事件" value={openCount} loading={loading} styles={{ content: { color: '#faad14' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已关闭" value={closedCount} loading={loading} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="高风险项" value={highRiskCount} loading={loading} styles={{ content: { color: '#ff4d4f' } }} /></Card></Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={16}>
          <Card size="small" title={<Space><Activity size={14} />不良事件分布与趋势</Space>} loading={loading}>
            <Tabs
              items={[
                {
                  key: 'severity',
                  label: '严重程度',
                  children: (
                    <Row gutter={[8, 8]}>
                      {severityDist(events).map((s) => (
                        <Col span={12} key={s.key}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, width: 70 }}>{s.label}</span>
                            <Progress percent={events.length ? Math.round((s.count / events.length) * 100) : 0} size="small" style={{ flex: 1, margin: 0 }} strokeColor={s.key === 'severe' || s.key === 'catastrophic' ? '#ff4d4f' : '#1677ff'} />
                            <span style={{ fontSize: 12, color: '#64748b', width: 30 }}>{s.count}</span>
                          </div>
                        </Col>
                      ))}
                    </Row>
                  ),
                },
                {
                  key: 'category',
                  label: '事件类别',
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
                  label: '月度趋势',
                  children: (
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 120, paddingTop: 12 }}>
                      {trendWindow.map((t) => (
                        <div key={t.period} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{t.total}</span>
                          <div style={{ width: 32, height: Math.max(4, t.total * 14), background: t.total > 5 ? '#ef4444' : '#3b82f6', borderRadius: '4px 4px 0 0' }} />
                          <span style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{t.period}</span>
                        </div>
                      ))}
                      {trendWindow.length === 0 && <Empty description="暂无趋势数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card size="small" title={<Space><AlertTriangle size={14} />高风险项 (RPN)</Space>} loading={loading} style={{ marginBottom: 12 }}>
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

      <Card size="small" title={<Space><Heart size={14} />最新安全事件</Space>} loading={loading}>
        {events.length === 0 ? <Empty description="暂无安全事件" /> : (
          <Table
            dataSource={events.slice(0, 10)} rowKey="id" pagination={false} size="small"
            columns={[
              { title: '时间', dataIndex: 'reportedAt', width: 150, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
              { title: '类型', dataIndex: 'eventType', render: (v: string) => <Tag color="blue">{CATEGORY_LABELS[v] ?? v}</Tag> },
              { title: '患者', dataIndex: 'patientName', width: 110, render: (v?: string) => v ?? '-' },
              { title: '严重程度', dataIndex: 'severity', width: 100, render: (v: string) => <Tag color={v === 'severe' || v === 'catastrophic' ? 'red' : v === 'moderate' ? 'orange' : 'blue'}>{SEVERITY_LABELS[v] ?? v}</Tag> },
              { title: '科室', dataIndex: 'department', width: 100 },
              { title: '描述', dataIndex: 'description', ellipsis: true },
              { title: '状态', dataIndex: 'status', width: 90, render: (v: string) => <Badge status={v === 'closed' ? 'success' : v === 'investigating' ? 'processing' : 'warning'} text={STATUS_LABELS[v] ?? v} /> },
            ]}
          />
        )}
      </Card>
    </div>
  )
}

const CATEGORY_LABELS: Record<string, string> = {
  'medication-error': '用药错误', 'patient-identification': '患者身份识别', 'contrast-reaction': '对比剂反应',
  'radiation-overdose': '辐射过量', fall: '跌倒', 'specimen-error': '标本错误', 'communication-failure': '沟通失败',
  'equipment-malfunction': '设备故障', 'information-loss': '信息丢失', other: '其他',
}

export default PatientSafetyDashboardPage
