/**
 * @deprecated [v3.0.6.11-104 Wave 5B] 危急值多入口收敛: 本页面已内嵌为 `/critical-value` 的 "告警列表" Tab (含 W2C 聚合列表)。
 * 旧路由 `/critical-alert` 保留 redirect → `/critical-value?tab=alert`。请勿新增直接引用。
 */
// [v3.0.6.11-54] Phase 2: 危急值告警 (真实列表 + 级别筛选 + 处理闭环)
import {
  criticalAlertApi, type CriticalAlert, type CriticalAlertStats, type CriticalFlowStep,
} from '../../services/api/criticalAlertApi'
// [G005 W4B] 危急值升级链 (GET /critical-escalation/chains)
import { criticalEscalationApi, type EscalationChain } from '../../services/api/criticalEscalationApi'
import {
  Card, Table, Button, Tag, Space, Typography, Row, Col, Statistic, message,
  Modal, Input, Select, Alert, Spin, Badge, Progress, Steps, Radio,
} from 'antd'
import { EmptyState } from '../../components/common/EmptyState'
import { StatCard, StatCardGrid, PageContainer } from '../../components/common'
import { AlertTriangle, CheckCircle, Bell, ArrowUp, RefreshCw, Clock, Phone, MessageSquare, Search } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { t as tr } from '../../i18n/appI18n'
import type { CommunicationEntry } from '../../services/api/criticalAlertApi'

const { Text } = Typography
const { TextArea } = Input

const severityColor: Record<string, string> = { info: 'blue', warning: 'orange', critical: 'red', emergency: 'volcano' }
const statusColor: Record<string, string> = { active: 'red', acknowledged: 'orange', resolved: 'green', escalated: 'purple' }
const severityLabelKey: Record<string, string> = { info: 'criticalAlert.sevInfo', warning: 'criticalAlert.sevWarning', critical: 'criticalAlert.sevCritical', emergency: 'criticalAlert.sevEmergency' }
const statusLabelKey: Record<string, string> = { active: 'criticalAlert.stActive', acknowledged: 'criticalAlert.stAcknowledged', resolved: 'criticalAlert.stResolved', escalated: 'criticalAlert.stEscalated' }
const typeLabelKey: Record<string, string> = {
  critical_value: 'criticalAlert.typeCriticalValue', unexpected_finding: 'criticalAlert.typeUnexpectedFinding', technical_issue: 'criticalAlert.typeTechnicalIssue', protocol_deviation: 'criticalAlert.typeProtocolDeviation',
}
const sevLabel = (v: string) => severityLabelKey[v] ? tr(severityLabelKey[v]) : v
const statLabel = (v: string) => statusLabelKey[v] ? tr(statusLabelKey[v]) : v
const typLabel = (v: string) => typeLabelKey[v] ? tr(typeLabelKey[v]) : v

// [v3.0.6.11-103 Wave 13] 危急值 5 步流程元数据 (i18n 文案走 critical.* 键)
const FLOW_STEP_KEYS: Array<{ key: CriticalFlowStep; label: string; desc: string }> = [
  { key: 'triggered', label: 'flowStepTriggered', desc: 'flowStepTriggeredDesc' },
  { key: 'notified', label: 'flowStepNotified', desc: 'flowStepNotifiedDesc' },
  { key: 'confirmed', label: 'flowStepConfirmed', desc: 'flowStepConfirmedDesc' },
  { key: 'treating', label: 'flowStepTreating', desc: 'flowStepTreatingDesc' },
  { key: 'closed', label: 'flowStepClosed', desc: 'flowStepClosedDesc' },
]
const FLOW_STATUS_LABEL: Record<string, string> = {
  triggered: 'flowStepTriggered', notified: 'flowStepNotified', confirmed: 'flowStepConfirmed',
  treating: 'flowStepTreating', closed: 'flowStepClosed', escalated: 'flowStatusEscalated',
}

const CriticalAlertPage: React.FC = () => {
  const { t } = useTranslation('critical')
  const [alerts, setAlerts] = useState<CriticalAlert[]>([])
  const [stats, setStats] = useState<CriticalAlertStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>()
  const [statusFilter, setStatusFilter] = useState<string>()
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<CriticalAlert | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // [W2-C] 受控分页
  const [alertPage, setAlertPage] = useState(1)
  // [G005 Wave1A] 按报告查询关联告警 (GET /critical-alert/for-report/:reportId)
  const [relatedAlerts, setRelatedAlerts] = useState<CriticalAlert[]>([])
  const [relatedShown, setRelatedShown] = useState(false)
  const [relatedLoading, setRelatedLoading] = useState(false)
  // [G005 Wave1A] 通知记录 (GET /critical-alert/alerts/:id/communication-log)
  const [logOpen, setLogOpen] = useState(false)
  const [logEntries, setLogEntries] = useState<CommunicationEntry[]>([])
  const [logLoading, setLogLoading] = useState(false)
  // [v3.0.6.11-103 Wave 13] 5 步流程: 当前步骤输入 (通知方式 / 确认人 / 处置 / 闭环摘要)
  const [flowNotifyMethod, setFlowNotifyMethod] = useState<'phone' | 'sms'>('phone')
  const [flowInput, setFlowInput] = useState('')

  // [v3.0.6.11-104 Wave 2C] 聚合列表: GET /critical-alert (默认聚合, 与 /alerts 同一处理器)
  const [aggregate, setAggregate] = useState<CriticalAlert[]>([])
  const [aggregateLoading, setAggregateLoading] = useState(false)
  const [aggregateError, setAggregateError] = useState('')

  // [G005 W4B] 危急值升级链 (GET /critical-escalation/chains)
  const [chains, setChains] = useState<EscalationChain[]>([])
  const [chainsLoading, setChainsLoading] = useState(false)
  const [chainsError, setChainsError] = useState('')
  const [chainStatusFilter, setChainStatusFilter] = useState<string>()

  const loadChains = useCallback(async () => {
    setChainsLoading(true)
    setChainsError('')
    try {
      const res = await criticalEscalationApi.listChains(chainStatusFilter)
      if (res.success && Array.isArray(res.data)) setChains(res.data)
      else setChainsError(res.error?.message ?? tr('w4b.esc.loadFailed'))
    } catch {
      setChainsError(tr('w4b.esc.loadFailed'))
    } finally {
      setChainsLoading(false)
    }
  }, [chainStatusFilter])

  useEffect(() => { void loadChains() }, [loadChains])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [listRes, statsRes] = await Promise.allSettled([
        criticalAlertApi.listAlerts({ severity: severityFilter, status: statusFilter }),
        criticalAlertApi.getStats(),
      ])
      if (listRes.status === 'fulfilled' && listRes.value.success) {
        setAlerts(listRes.value.data ?? [])
      } else {
        setAlerts([])
        if (listRes.status === 'fulfilled') setError(listRes.value.error?.message ?? '')
      }
      if (statsRes.status === 'fulfilled' && statsRes.value.success) setStats(statsRes.value.data)
    } catch (e) {
      setError((e as Error)?.message ?? tr('criticalAlert.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [severityFilter, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  // [v3.0.6.11-104 Wave 2C] 聚合列表加载: GET /critical-alert
  const loadAggregate = useCallback(async () => {
    setAggregateLoading(true)
    setAggregateError('')
    try {
      const res = await criticalAlertApi.listAggregated()
      if (res.success && Array.isArray(res.data)) setAggregate(res.data)
      else setAggregateError(res.error?.message ?? tr('criticalAgg.loadFailed'))
    } catch (e) {
      setAggregateError((e as Error)?.message ?? tr('criticalAgg.loadFailed'))
    } finally {
      setAggregateLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAggregate()
  }, [loadAggregate])

  const aggBySeverity = useMemo(() => {
    const m: Record<string, number> = {}
    for (const a of aggregate) m[a.severity] = (m[a.severity] ?? 0) + 1
    return m
  }, [aggregate])

  const aggByStatus = useMemo(() => {
    const m: Record<string, number> = {}
    for (const a of aggregate) m[a.status] = (m[a.status] ?? 0) + 1
    return m
  }, [aggregate])

  const pendingCount = useMemo(() => alerts.filter((a) => a.status === 'active').length, [alerts])

  const refresh = () => { void load() }

  // [v3.0.6.11-103 Wave 13] 5 步流程状态标签 i18n (flowStatus → critical.* 键)
  const flowLabel = (v?: string): string => {
    const k = v ? FLOW_STATUS_LABEL[v] : undefined
    return k ? t(k) : (v ?? '—')
  }

  // 当前流程状态 → 下一步动作步骤 (triggered→notified→confirmed→treating→closed)
  const nextFlowAction = (fs?: string): CriticalFlowStep => {
    if (fs === 'triggered') return 'notified'
    if (fs === 'notified') return 'confirmed'
    if (fs === 'confirmed') return 'treating'
    return 'closed'
  }
  const nextFlowActionLabel = (fs?: string): string => {
    if (fs === 'triggered') return t('flowActionNotify')
    if (fs === 'notified') return t('flowActionConfirm')
    if (fs === 'confirmed') return t('flowActionTreat')
    if (fs === 'treating') return t('flowActionClose')
    return t('flowDone')
  }

  // [v3.0.6.11-103 Wave 13] 5 步流程步骤操作: 通知→确认→处置→记录闭环 (后端状态机校验, 不能跳步)
  const handleFlowStep = async (step: CriticalFlowStep) => {
    if (!selected) return
    setSubmitting(true)
    try {
      let res
      if (step === 'notified') {
        res = await criticalAlertApi.notify(selected.id, { method: flowNotifyMethod })
      } else if (step === 'confirmed') {
        res = await criticalAlertApi.confirm(selected.id, { receiver: flowInput.trim() || undefined })
      } else if (step === 'treating') {
        res = await criticalAlertApi.treat(selected.id, { treatment: flowInput.trim() || undefined })
      } else {
        res = await criticalAlertApi.close(selected.id, { summary: flowInput.trim() || undefined })
      }
      if (res.success) {
        message.success(t('flowSuccess'))
        setFlowInput('')
        await refreshDetail(selected.id)
        refresh()
      } else {
        message.error(res.error?.message ?? t('flowFail'))
      }
    } catch {
      message.error(t('flowFail'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleEscalate = async (item: CriticalAlert) => {
    try {
      const res = await criticalAlertApi.escalate(item.id, '值班主任医师')
      if (res.success) {
        message.success(tr('criticalAlert.escalated'))
        refresh()
      } else {
        message.error(res.error?.message ?? tr('criticalAlert.escalateFailed'))
      }
    } catch {
      message.error(tr('criticalAlert.escalateFailed'))
    }
  }

  // [G005 Wave1A] 按报告查询关联告警
  const handleSearchByReport = async (value: string) => {
    const reportId = value.trim()
    if (!reportId) {
      message.warning(tr('criticalAlert.enterReportId'))
      return
    }
    setRelatedLoading(true)
    try {
      const res = await criticalAlertApi.forReport(reportId)
      if (res.success) setRelatedAlerts(res.data ?? [])
      else {
        setRelatedAlerts([])
        message.warning(res.error?.message ?? tr('criticalAlert.queryFailed'))
      }
      setRelatedShown(true)
    } catch {
      setRelatedAlerts([])
      setRelatedShown(true)
      message.error(tr('criticalAlert.queryFailed'))
    } finally {
      setRelatedLoading(false)
    }
  }

  // [G005 Wave1A] 详情刷新 (GET /critical-alert/alerts/:id)
  const refreshDetail = async (id: string) => {
    try {
      const res = await criticalAlertApi.getAlert(id)
      if (res.success && res.data) {
        setSelected(res.data)
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, ...res.data } : a))
      }
    } catch {
      /* 保持列表数据 */
    }
  }

  // [G005 Wave1A] 通知记录 (GET /critical-alert/alerts/:id/communication-log)
  const openCommunicationLog = async (id: string) => {
    setLogOpen(true)
    setLogLoading(true)
    try {
      const res = await criticalAlertApi.getCommunicationLog(id)
      setLogEntries(res.success ? (res.data ?? []) : [])
    } catch {
      setLogEntries([])
    } finally {
      setLogLoading(false)
    }
  }

  const columns = [
    { title: tr('criticalAlert.colPatient'), dataIndex: 'patientName', key: 'patientName', width: 110 },
    { title: tr('criticalAlert.colAlertType'), dataIndex: 'alertType', key: 'alertType', width: 110, render: (v: string) => <Tag>{typLabel(v)}</Tag> },
    { title: tr('criticalAlert.colSeverity'), dataIndex: 'severity', key: 'severity', width: 100, render: (v: string) => <Tag color={severityColor[v]}>{sevLabel(v)}</Tag> },
    { title: tr('criticalAlert.colTitle'), dataIndex: 'title', key: 'title' },
    { title: tr('criticalAlert.colModality'), dataIndex: 'modality', key: 'modality', width: 70 },
    { title: tr('criticalAlert.colStatus'), dataIndex: 'status', key: 'status', width: 110, render: (v: string) => <Tag color={statusColor[v]}>{statLabel(v)}</Tag> },
    { title: t('flowColumn'), dataIndex: 'flowStatus', key: 'flowStatus', width: 100, render: (v: string) => v ? <Tag color={v === 'closed' ? 'green' : v === 'escalated' ? 'purple' : 'blue'}>{flowLabel(v)}</Tag> : <Tag>—</Tag> },
    { title: tr('criticalAlert.colTime'), dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (v: string) => new Date(v).toLocaleString() },
    { title: tr('criticalAlert.colActions'), key: 'action', width: 160, render: (_: unknown, r: CriticalAlert) => (
      <Space size={4}>
        <Button size="small" type="primary" icon={<CheckCircle size={12} />}
          disabled={r.status !== 'active' && r.status !== 'acknowledged'}
onClick={() => { setSelected(r); setDetailOpen(true); void refreshDetail(r.id) }}>{tr('criticalAlert.handle')}</Button>
        {r.status === 'active' && (
          <Button size="small" icon={<ArrowUp size={12} />} onClick={() => void handleEscalate(r)}>{tr('criticalAlert.escalate')}</Button>
        )}
      </Space>
    )},
  ]

  const severityDist = stats?.severityDistribution ?? []
  const maxSev = Math.max(1, ...severityDist.map((s) => s.count))

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 16 }}>
        <AlertTriangle size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{tr('criticalAlert.title')}</span>
        <Input.Search
          size="small"
          placeholder={t('byReportPlaceholder')}
          allowClear
          onSearch={handleSearchByReport}
          style={{ width: 280 }}
          prefix={<Search size={12} />}
        />
        <Button size="small" icon={<RefreshCw size={12} />} onClick={refresh} loading={loading}>{tr('criticalAlert.refresh')}</Button>
      </Space>

      {error && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message={error}
          action={<Button size="small" onClick={refresh}><RefreshCw size={14} /> {tr('criticalAlert.retry')}</Button>} />
      )}

      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
        <StatCard title={tr('criticalAlert.statTotal')} value={stats?.totalAlerts ?? alerts.length} icon={<Bell size={16} />} />
        <StatCard title={tr('criticalAlert.statPending')} value={stats?.activeCount ?? pendingCount} color="error" />
        <StatCard title={tr('criticalAlert.statAcknowledged')} value={stats?.acknowledgedCount ?? 0} color="warning" />
        <StatCard title={tr('criticalAlert.statAvgResponse')} value={stats?.avgResponseTimeMinutes ?? 0} suffix="min" icon={<Clock size={14} />} />
      </StatCardGrid>

      {severityDist.length > 0 && (
        <Card size="small" title={tr('criticalAlert.severityDist')} style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            {severityDist.map((s) => (
              <Col span={6} key={s.severity}>
                <Space style={{ marginBottom: 4 }}>
                  <Tag color={severityColor[s.severity]}>{sevLabel(s.severity)}</Tag>
                  <span>{s.count}</span>
                </Space>
                <Progress percent={Math.round((s.count / maxSev) * 100)} showInfo={false}
                  strokeColor={{ from: '#faad14', to: '#ff4d4f' }} size="small" />
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* [v3.0.6.11-104 Wave 2C] 危急值聚合列表: GET /critical-alert (默认聚合, 与 /alerts 同一处理器) */}
      <Card
        size="small"
        title={<Space size={6}><Bell size={13} color="#2563eb" />{tr('criticalAgg.title')}</Space>}
        style={{ marginBottom: 16 }}
        extra={<Button size="small" icon={<RefreshCw size={12} />} loading={aggregateLoading} onClick={() => void loadAggregate()}>{tr('criticalAgg.refresh')}</Button>}
        data-testid="critical-aggregate"
      >
        {aggregateLoading && aggregate.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 16, color: '#94a3b8' }}><Spin size="small" /> {tr('criticalAgg.loading')}</div>
        ) : aggregateError ? (
          <Alert
            type="warning"
            showIcon
            message={`${tr('criticalAgg.loadFailed')}: ${aggregateError}`}
            action={<Button size="small" onClick={() => void loadAggregate()}>{tr('criticalAgg.retry')}</Button>}
          />
        ) : aggregate.length === 0 ? (
          <EmptyState description={tr('criticalAgg.empty')} />
        ) : (
          <>
            <Alert type="info" showIcon style={{ marginBottom: 12 }} message={tr('criticalAgg.aliasNote')} />
            <Row gutter={16} style={{ marginBottom: 12 }}>
              <Col span={6}><Statistic title={tr('criticalAgg.total')} value={aggregate.length} /></Col>
              <Col span={6}><Statistic title={tr('criticalAgg.active')} value={aggregate.filter((a) => a.status === 'active').length} styles={{ content: { color: '#ff4d4f' } }} /></Col>
              <Col span={6}><Statistic title={tr('criticalAgg.acknowledged')} value={aggregate.filter((a) => a.status === 'acknowledged').length} styles={{ content: { color: '#faad14' } }} /></Col>
              <Col span={6}><Statistic title={tr('criticalAgg.resolved')} value={aggregate.filter((a) => a.status === 'resolved').length} styles={{ content: { color: '#52c41a' } }} /></Col>
            </Row>
            <Space wrap size={[8, 8]}>
              {(['emergency', 'critical', 'warning', 'info'] as string[]).map((sev) => (
                <Tag key={sev} color={severityColor[sev]}>{sevLabel(sev)}: {aggBySeverity[sev] ?? 0}</Tag>
              ))}
            </Space>
            <div style={{ marginTop: 8 }}>
              <Space wrap size={[8, 8]}>
                {(['active', 'acknowledged', 'resolved', 'escalated'] as string[]).map((st) => (
                  <Tag key={st} color={statusColor[st]}>{statLabel(st)}: {aggByStatus[st] ?? 0}</Tag>
                ))}
              </Space>
            </div>
          </>
        )}
      </Card>

      {/* [G005 W4B] 危急值升级链列表 (GET /critical-escalation/chains) */}
      <Card
        size="small"
        title={<Space size={6}><ArrowUp size={13} color="#7c3aed" />{tr('w4b.esc.listTitle', { count: chains.length })}</Space>}
        style={{ marginBottom: 16 }}
        extra={
          <Space>
            <Select
              size="small"
              allowClear
              placeholder={tr('w4b.esc.filterStatus')}
              style={{ width: 140 }}
              value={chainStatusFilter}
              onChange={setChainStatusFilter}
              options={['NOTIFYING', 'PENDING_CONFIRM', 'CONFIRMED', 'ESCALATED', 'CLOSED'].map((s) => ({ value: s, label: s }))}
            />
            <Button size="small" icon={<RefreshCw size={12} />} loading={chainsLoading} onClick={() => void loadChains()}>{tr('w4b.esc.refresh')}</Button>
          </Space>
        }
        data-testid="critical-escalation-chains"
      >
        {chainsError ? (
          <Alert type="warning" showIcon message={chainsError} action={<Button size="small" onClick={() => void loadChains()}>{tr('w4b.esc.refresh')}</Button>} />
        ) : chains.length === 0 ? (
          <EmptyState description={tr('w4b.esc.empty')} />
        ) : (
          <Table
            rowKey="id"
            size="small"
            loading={chainsLoading}
            dataSource={chains}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: 'max-content' }}
            columns={[
              { title: tr('w4b.esc.thId'), dataIndex: 'id', key: 'id', width: 110, render: (v: string) => <Text code>{v}</Text> },
              { title: tr('w4b.esc.thPatient'), dataIndex: 'patientName', key: 'patientName', width: 100 },
              { title: tr('w4b.esc.thTitle'), dataIndex: 'title', key: 'title' },
              { title: tr('w4b.esc.thSeverity'), dataIndex: 'severity', key: 'severity', width: 90, render: (v: string) => <Tag color={severityColor[v] ?? 'default'}>{v}</Tag> },
              { title: tr('w4b.esc.thStatus'), dataIndex: 'status', key: 'status', width: 130, render: (v: string) => <Tag color={v === 'CLOSED' ? 'green' : v === 'ESCALATED' ? 'purple' : v === 'CONFIRMED' ? 'blue' : 'orange'}>{v}</Tag> },
              { title: tr('w4b.esc.thLevel'), dataIndex: 'currentLevel', key: 'currentLevel', width: 90 },
              { title: tr('w4b.esc.thEscalated'), dataIndex: 'escalatedCount', key: 'escalatedCount', width: 90 },
              { title: tr('w4b.esc.thDeadline'), dataIndex: 'currentDeadline', key: 'currentDeadline', width: 160, render: (v: string) => v ? new Date(v).toLocaleString() : '—' },
            ]}
          />
        )}
      </Card>

      {/* [G005 Wave1A] 按报告查询关联告警 (GET /critical-alert/for-report/:reportId) */}
      {relatedShown && (
        <Card
          size="small"
          title={t('relatedAlerts')}
          style={{ marginBottom: 16 }}
          extra={<Button size="small" onClick={() => { setRelatedShown(false); setRelatedAlerts([]) }}>{tr('criticalAlert.close')}</Button>}
        >
          <Spin spinning={relatedLoading}>
            {relatedAlerts.length === 0 ? (
              <EmptyState description={t('noRelatedAlerts')} />
            ) : (
              <Table
                rowKey="id"
                size="small"
                dataSource={relatedAlerts}
                pagination={false}
                columns={[
                  { title: tr('criticalAlert.colPatient'), dataIndex: 'patientName', key: 'patientName' },
                  { title: tr('criticalAlert.colType'), dataIndex: 'alertType', key: 'alertType', render: (v: string) => <Tag>{typLabel(v)}</Tag> },
                  { title: tr('criticalAlert.colSeverity'), dataIndex: 'severity', key: 'severity', render: (v: string) => <Tag color={severityColor[v]}>{sevLabel(v)}</Tag> },
                  { title: tr('criticalAlert.colTitle'), dataIndex: 'title', key: 'title' },
                  { title: tr('criticalAlert.colStatus'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColor[v]}>{statLabel(v)}</Tag> },
                  { title: tr('criticalAlert.colTime'), dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
                  {
                    title: tr('criticalAlert.colActions'),
                    key: 'action',
                    render: (_: unknown, r: CriticalAlert) => (
                      <Space size={4}>
                        <Button size="small" icon={<RefreshCw size={11} />} onClick={() => { setSelected(r); setDetailOpen(true); void refreshDetail(r.id) }}>{tr('criticalAlert.handle')}</Button>
                        <Button size="small" icon={<Phone size={11} />} onClick={() => void openCommunicationLog(r.id)}>{t('communicationLog')}</Button>
                      </Space>
                    ),
                  },
                ]}
              />
            )}
          </Spin>
        </Card>
      )}

      <Card
        size="small"
        title={tr('criticalAlert.listTitle')}
        extra={
          <Space>
            <Select
              size="small" allowClear placeholder={tr('criticalAlert.severityFilter')} style={{ width: 130 }}
              value={severityFilter} onChange={(v) => { setSeverityFilter(v); setAlertPage(1) }}
              options={['info', 'warning', 'critical', 'emergency'].map((s) => ({ value: s, label: s }))}
            />
            <Select
              size="small" allowClear placeholder={tr('criticalAlert.statusFilter')} style={{ width: 130 }}
              value={statusFilter} onChange={(v) => { setStatusFilter(v); setAlertPage(1) }}
              options={['active', 'acknowledged', 'resolved', 'escalated'].map((s) => ({ value: s, label: s }))}
            />
          </Space>
        }
      >
        <Spin spinning={loading}>
          {alerts.length === 0 && !loading ? (
            <EmptyState description={tr('criticalAlert.empty')} />
          ) : (
            <Table rowKey="id" dataSource={alerts} columns={columns} pagination={{ current: alertPage, pageSize: 10, total: alerts.length, onChange: setAlertPage, showSizeChanger: false, showTotal: (n) => `共 ${n} 条` }} size="small" scroll={{ x: 'max-content' }}/>
          )}
        </Spin>
      </Card>

      <Modal
        title={tr('criticalAlert.handleTitle')}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        confirmLoading={submitting}
        width={640}
        footer={selected ? [
          <Button key="cancel" onClick={() => setDetailOpen(false)}>{tr('criticalAlert.cancel')}</Button>,
          <Button key="log" icon={<Phone size={12} />} onClick={() => void openCommunicationLog(selected.id)}>{t('communicationLog')}</Button>,
          <Button key="escalate" danger icon={<ArrowUp size={12} />} onClick={() => { void handleEscalate(selected); setDetailOpen(false) }}>{tr('criticalAlert.escalateUp')}</Button>,
          <Button key="flow" type="primary" loading={submitting} disabled={!selected.flowStatus || selected.flowStatus === 'closed' || selected.flowStatus === 'escalated'} onClick={() => void handleFlowStep(nextFlowAction(selected.flowStatus))}>
            {nextFlowActionLabel(selected.flowStatus)}
          </Button>,
        ] : null}
      >
        {selected && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Space>
                  <Text strong>{selected.patientName}</Text>
                  <Tag color={severityColor[selected.severity]}>{sevLabel(selected.severity)}</Tag>
                  <Tag>{typLabel(selected.alertType)}</Tag>
                  <Badge status={(statusColor[selected.status] as any)} text={statLabel(selected.status)} />
                  {selected.flowStatus && <Tag color={selected.flowStatus === 'closed' ? 'green' : 'blue'}>{flowLabel(selected.flowStatus)}</Tag>}
                </Space>
                <Text strong>{tr('criticalAlert.detailTitle')}: {selected.title}</Text>
                <Text type="secondary">{tr('criticalAlert.detailDesc')}: {selected.description}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{tr('criticalAlert.detailStudy')}: {selected.studyId} · {tr('criticalAlert.colModality')} {selected.modality} · {tr('criticalAlert.detailTriggeredAt')} {new Date(selected.createdAt).toLocaleString()}</Text>
              </Space>
            </Card>

            {/* [v3.0.6.11-103 Wave 13] 5 步流程进度: 触发→通知→确认→处置→记录 (闭环) */}
            <Card size="small" style={{ marginBottom: 16 }} title={<Space size={6}><AlertTriangle size={13} color="#2563eb" />{t('flowTitle')}</Space>}>
              <Steps
                size="small"
                current={selected.flowStatus === 'escalated' ? 0 : Math.max(0, selected.step ?? 0)}
                status={selected.flowStatus === 'closed' ? 'finish' : selected.flowStatus === 'escalated' ? 'error' : 'process'}
                items={FLOW_STEP_KEYS.map((s) => ({ title: <span className="text-xs">{t(s.label)}</span>, description: <span className="text-[10px] text-slate-400">{t(s.desc)}</span> }))}
              />
              {selected.flowSteps && (
                <Space wrap size={[8, 4]} style={{ marginTop: 10 }}>
                  {FLOW_STEP_KEYS.map((s) => {
                    const ts = selected.flowSteps?.[s.key]
                    return (
                      <Tag key={s.key} color={ts ? 'blue' : 'default'} style={{ fontSize: 11 }}>
                        {t(s.label)}: {ts ? new Date(ts).toLocaleString() : '—'}
                      </Tag>
                    )
                  })}
                </Space>
              )}
            </Card>

            {/* 当前步骤输入 */}
            {selected.flowStatus === 'triggered' && (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Text type="secondary">{t('flowNotifyDesc')}</Text>
                <Radio.Group value={flowNotifyMethod} onChange={(e) => setFlowNotifyMethod(e.target.value)}>
                  <Radio.Button value="phone">{tr('criticalAlert.phone')}</Radio.Button>
                  <Radio.Button value="sms">{tr('criticalAlert.sms')}</Radio.Button>
                </Radio.Group>
              </Space>
            )}
            {(selected.flowStatus === 'notified' || selected.flowStatus === 'confirmed' || selected.flowStatus === 'treating') && (
              <TextArea
                placeholder={selected.flowStatus === 'notified' ? t('flowConfirmPlaceholder') : selected.flowStatus === 'confirmed' ? t('flowTreatPlaceholder') : t('flowClosePlaceholder')}
                rows={2}
                value={flowInput}
                onChange={(e) => setFlowInput(e.target.value)}
              />
            )}
            {selected.flowStatus === 'closed' && (
              <Alert type="success" showIcon message={t('flowClosed')} />
            )}
          </>
        )}
      </Modal>

      {/* [G005 Wave1A] 通知记录 (GET /critical-alert/alerts/:id/communication-log) */}
      <Modal
        title={<Space><MessageSquare size={14} color="#3b82f6" />{t('communicationLog')}</Space>}
        open={logOpen}
        onCancel={() => setLogOpen(false)}
        footer={<Button onClick={() => setLogOpen(false)}>{tr('criticalAlert.close')}</Button>}
        width={640}
      >
        <Spin spinning={logLoading}>
          {logEntries.length === 0 ? (
            <EmptyState description={t('communicationLogEmpty')} />
          ) : (
            <Table
              rowKey="id"
              size="small"
              dataSource={logEntries}
              pagination={false}
              columns={[
                {
                  title: t('channel'),
                  dataIndex: 'channel',
                  key: 'channel',
                  render: (v: string) => <Tag color={v === 'phone' ? 'blue' : 'green'} icon={v === 'phone' ? <Phone size={11} /> : <MessageSquare size={11} />}>{v === 'phone' ? tr('criticalAlert.phone') : tr('criticalAlert.sms')}</Tag>,
                },
                { title: tr('criticalAlert.colNumber'), dataIndex: 'phone', key: 'phone' },
                { title: tr('criticalAlert.colStatus'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'sent' || v === 'connected' || v === 'initiated' ? 'blue' : v === 'failed' ? 'red' : 'default'}>{v}</Tag> },
                { title: t('communicationAt'), dataIndex: 'at', key: 'at', render: (v: string) => v ? new Date(v).toLocaleString() : '—' },
                { title: tr('criticalAlert.colDuration'), dataIndex: 'durationSec', key: 'durationSec', render: (v: number) => (v != null ? `${v}s` : '—') },
              ]}
            />
          )}
        </Spin>
      </Modal>
    </PageContainer>
  )
}

export default CriticalAlertPage
