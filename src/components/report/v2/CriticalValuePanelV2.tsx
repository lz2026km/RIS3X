/**
 * [G005 v3.0.6.11-101 Wave 6C] 危急值管理 V2 面板 (F5)
 * 能力: 规则库表格 (搜索/过滤/启停) + 自动判定 (规则匹配预览 + 落库)
 *      + 通知记录 (渠道/对象/时间/状态) + 确认操作 (接受/拒绝/备注)
 * 数据源: criticalV2Api (后端孤儿模块 + seed 回退)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card, Table, Tag, Space, Row, Col, Statistic, Button, Input, Select, Switch, Modal,
  message, Empty, Tooltip, Timeline, Segmented, Badge, Divider,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  AlertOctagon, Activity, Clock, Zap, RefreshCw, Search, Send, CheckCircle2,
  XCircle, Phone, MessageSquare, Bell, TrendingUp, FileSearch,
} from 'lucide-react'
import {
  criticalV2Api,
  type CriticalRuleV2,
  type CriticalTriggerV2,
  type CriticalNotificationV2,
  type CriticalStatsV2,
  type EvaluateInputV2,
} from '../../../services/api/criticalV2Api'
import { t } from '../../../i18n/appI18n'

const { TextArea } = Input

const LEVEL_META: Record<string, { color: string; label: string; bg: string }> = {
  critical: { color: '#dc2626', label: t('criticalValue.level.critical'), bg: 'var(--color-error-bg)' },
  urgent: { color: '#f59e0b', label: t('criticalValue.level.urgent'), bg: 'var(--color-warning-bg)' },
  warning: { color: '#3b82f6', label: t('criticalValue.level.warning'), bg: 'var(--color-info-bg)' },
}

const CHANNEL_META: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  phone: { color: '#10b981', label: t('criticalValue.channel.phone'), icon: <Phone size={12} /> },
  sms: { color: '#3b82f6', label: t('criticalValue.channel.sms'), icon: <MessageSquare size={12} /> },
  message: { color: '#7c3aed', label: t('criticalValueV2.channel.message'), icon: <Bell size={12} /> },
}

const NOTIF_STATUS_META: Record<string, { color: string; label: string }> = {
  sent: { color: '#3b82f6', label: t('criticalValueV2.notifStatus.sent') },
  failed: { color: '#dc2626', label: t('criticalValueV2.notifStatus.failed') },
  accepted: { color: '#10b981', label: t('criticalValueV2.notifStatus.accepted') },
  rejected: { color: '#f59e0b', label: t('criticalValueV2.notifStatus.rejected') },
}

const TRIGGER_STATUS_META: Record<string, { color: string; label: string }> = {
  triggered: { color: '#dc2626', label: t('criticalValueV2.triggerStatus.triggered') },
  notified: { color: '#f59e0b', label: t('criticalValueV2.triggerStatus.notified') },
  confirmed: { color: '#10b981', label: t('criticalValueV2.triggerStatus.confirmed') },
  rejected: { color: '#64748b', label: t('criticalValueV2.triggerStatus.rejected') },
  resolved: { color: '#0ea5e9', label: t('criticalValueV2.triggerStatus.resolved') },
}

function formatHM(iso?: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export interface CriticalValuePanelV2Props {
  compact?: boolean
  defaultTab?: string
}

const CriticalValuePanelV2: React.FC<CriticalValuePanelV2Props> = ({ compact = false, defaultTab = 'rules' }) => {
  const [tab, setTab] = useState(defaultTab)
  const [rules, setRules] = useState<CriticalRuleV2[]>([])
  const [triggers, setTriggers] = useState<CriticalTriggerV2[]>([])
  const [notifications, setNotifications] = useState<CriticalNotificationV2[]>([])
  const [stats, setStats] = useState<CriticalStatsV2 | null>(null)
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>()
  const [selectedTriggerId, setSelectedTriggerId] = useState<string>()

  // 自动判定表单
  const [evalForm, setEvalForm] = useState<{
    patientName: string
    examType: string
    modality: string
    itemKey: string
    itemValue: string
    description: string
  }>({ patientName: '', examType: '', modality: '', itemKey: 'ct_value_hu', itemValue: '', description: '' })
  const [preview, setPreview] = useState<CriticalTriggerV2[]>([])
  const [previewing, setPreviewing] = useState(false)
  const [judging, setJudging] = useState(false)

  // 确认弹窗
  const [confirmTarget, setConfirmTarget] = useState<{ notification: CriticalNotificationV2; decision: 'accepted' | 'rejected' } | null>(null)
  const [confirmComment, setConfirmComment] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [r, trg, n, s] = await Promise.allSettled([
        criticalV2Api.listRules(),
        criticalV2Api.listTriggers(),
        criticalV2Api.listNotifications(),
        criticalV2Api.stats(),
      ])
      if (r.status === 'fulfilled' && r.value.success) setRules(r.value.data ?? [])
      if (trg.status === 'fulfilled' && trg.value.success) {
        setTriggers(trg.value.data ?? [])
        if (!selectedTriggerId && (trg.value.data ?? []).length > 0) setSelectedTriggerId(trg.value.data![0]!.id)
      }
      if (n.status === 'fulfilled' && n.value.success) setNotifications(n.value.data ?? [])
      if (s.status === 'fulfilled' && s.value.success) setStats(s.value.data)
    } catch {
      message.error(t('criticalValueV2.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [selectedTriggerId])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const categories = useMemo(() => Array.from(new Set(rules.map((r) => r.category))), [rules])
  const examTypes = useMemo(() => Array.from(new Set(rules.map((r) => r.examType))), [rules])
  const modalities = useMemo(() => Array.from(new Set(rules.map((r) => r.modality))), [rules])

  const filteredRules = useMemo(() => {
    let list = rules
    if (categoryFilter) list = list.filter((r) => r.category === categoryFilter)
    if (keyword.trim()) {
      const q = keyword.trim().toLowerCase()
      list = list.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) || r.examType.toLowerCase().includes(q))
    }
    return list
  }, [rules, categoryFilter, keyword])

  const selectedTrigger = useMemo(() => triggers.find((tr) => tr.id === selectedTriggerId), [triggers, selectedTriggerId])
  const selectedNotifications = useMemo(
    () => notifications.filter((n) => n.triggerId === selectedTriggerId),
    [notifications, selectedTriggerId],
  )

  const ruleColumns: ColumnsType<CriticalRuleV2> = [
    { title: t('criticalValueV2.col.code'), dataIndex: 'code', width: 90, fixed: 'left' as const, render: (v: string) => <Tag color="red">{v}</Tag> },
    { title: t('criticalValueV2.col.ruleName'), dataIndex: 'name', width: 170, render: (v: string, r) => (
        <Space size={4} wrap>
          <span>{v}</span>
          <Tag color={LEVEL_META[r.level]?.color}>{LEVEL_META[r.level]?.label}</Tag>
        </Space>
      ) },
    { title: t('criticalValueV2.col.examType'), dataIndex: 'examType', width: 120 },
    { title: t('criticalValueV2.col.item'), dataIndex: 'item', width: 140 },
    { title: t('criticalValueV2.col.threshold'), width: 110, render: (_, r) => {
        if (r.operator === 'contains' || r.operator === 'notContains') return <code>{t('criticalValueV2.containsPrefix')}{r.thresholdText}{t('criticalValueV2.containsSuffix')}</code>
        return <code>{r.operator} {r.threshold}{r.unit ?? ''}</code>
      } },
    { title: t('criticalValueV2.col.deadlineMin'), dataIndex: 'responseDeadlineMin', width: 90 },
    { title: t('criticalValueV2.col.suggestion'), dataIndex: 'suggestion', ellipsis: true, width: 240 },
    { title: t('criticalValueV2.col.enabled'), width: 70, render: (_, r) => (
        <Switch size="small" checked={r.enabled} onChange={async (checked) => {
          const res = await criticalV2Api.updateRule(r.id, { enabled: checked })
          if (res.success) {
            setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, enabled: checked } : x)))
          } else {
            message.error(res.error?.message ?? t('criticalValueV2.opFailed'))
          }
        }} />
      ) },
  ]

  const triggerColumns: ColumnsType<CriticalTriggerV2> = [
    { title: t('criticalValueV2.col.patient'), dataIndex: 'patientName', width: 90 },
    { title: t('criticalValueV2.col.rule'), dataIndex: 'ruleName', width: 170, render: (v: string, tr) => (
        <Space size={4}>
          <Tag color={LEVEL_META[tr.level]?.color}>{LEVEL_META[tr.level]?.label}</Tag>
          <span>{v}</span>
        </Space>
      ) },
    { title: t('criticalValueV2.col.triggerDesc'), dataIndex: 'matchedText', ellipsis: true },
    { title: t('criticalValueV2.col.status'), dataIndex: 'status', width: 90, render: (v: string) => {
        const m = TRIGGER_STATUS_META[v] ?? { color: 'default', label: v }
        return <Tag color={m.color}>{m.label}</Tag>
      } },
    { title: t('criticalValueV2.col.triggerTime'), dataIndex: 'createdAt', width: 120, render: (v: string) => formatHM(v) },
  ]

  const notifColumns: ColumnsType<CriticalNotificationV2> = [
    { title: t('criticalValueV2.col.channel'), dataIndex: 'channel', width: 90, render: (v: string) => {
        const m = CHANNEL_META[v]
        return <Tag color={m?.color} icon={m?.icon}>{m?.label ?? v}</Tag>
      } },
    { title: t('criticalValueV2.col.recipient'), width: 130, render: (_, n) => (
        <Space size={4}>
          <span>{n.recipientName}</span>
          {n.recipientDept && <span style={{ fontSize: 12, color: '#94a3b8' }}>{n.recipientDept}</span>}
        </Space>
      ) },
    { title: t('criticalValueV2.col.content'), dataIndex: 'content', ellipsis: true },
    { title: t('criticalValueV2.col.time'), dataIndex: 'sentAt', width: 120, render: (v: string, n) => (n.status === 'failed' ? '-' : formatHM(v)) },
    { title: t('criticalValueV2.col.status'), dataIndex: 'status', width: 90, render: (v: string) => {
        const m = NOTIF_STATUS_META[v] ?? { color: 'default', label: v }
        return <Tag color={m.color}>{m.label}</Tag>
      } },
    { title: t('criticalValueV2.col.action'), width: 150, render: (_, n) => {
        if (n.status !== 'sent') return <span style={{ color: '#94a3b8', fontSize: 12 }}>{t('criticalValueV2.finalState')}</span>
        return (
          <Space size={4}>
            <Button size="small" type="primary" icon={<CheckCircle2 size={12} />} onClick={() => { setConfirmTarget({ notification: n, decision: 'accepted' }); setConfirmComment('') }}>
              {t('criticalValueV2.accept')}
            </Button>
            <Button size="small" danger icon={<XCircle size={12} />} onClick={() => { setConfirmTarget({ notification: n, decision: 'rejected' }); setConfirmComment('') }}>
              {t('criticalValueV2.reject')}
            </Button>
          </Space>
        )
      } },
  ]

  const doEvaluate = async () => {
    setPreviewing(true)
    try {
      const input: EvaluateInputV2 = {
        patientName: evalForm.patientName || undefined,
        examType: evalForm.examType || undefined,
        modality: evalForm.modality || undefined,
        items: evalForm.itemKey && evalForm.itemValue !== ''
          ? [{ key: evalForm.itemKey, value: Number(evalForm.itemValue) }]
          : undefined,
        description: evalForm.description || undefined,
      }
      const res = await criticalV2Api.evaluate(input)
      if (res.success) {
        setPreview(res.data?.triggers ?? [])
        if ((res.data?.triggers ?? []).length === 0) message.info(t('criticalValueV2.noRuleMatched'))
      } else {
        message.error(res.error?.message ?? t('criticalValueV2.judgeFailed'))
      }
    } catch {
      message.error(t('criticalValueV2.judgeUnavailable'))
    } finally {
      setPreviewing(false)
    }
  }

  const doJudge = async () => {
    setJudging(true)
    try {
      const res = await criticalV2Api.judge({
        patientName: evalForm.patientName || undefined,
        examType: evalForm.examType || undefined,
        modality: evalForm.modality || undefined,
        items: evalForm.itemKey && evalForm.itemValue !== ''
          ? [{ key: evalForm.itemKey, value: Number(evalForm.itemValue) }]
          : undefined,
        description: evalForm.description || undefined,
        recipients: [{ name: '急诊值班医生', dept: '急诊科', phone: '13800000000' }],
      })
      if (res.success) {
        const created = res.data ?? []
        message.success(t('w9e.criticalValuePanelV2.triggeredCount', { count: created.length }))
        setPreview([])
        setTab('triggers')
        await loadAll()
      } else {
        message.error(res.error?.message ?? t('criticalValueV2.generateFailed'))
      }
    } catch {
      message.error(t('criticalValueV2.generateUnavailable'))
    } finally {
      setJudging(false)
    }
  }

  const doConfirm = async () => {
    if (!confirmTarget) return
    const { notification, decision } = confirmTarget
    const res = await criticalV2Api.confirmNotification(notification.id, {
      decision,
      comment: confirmComment || undefined,
      confirmedBy: '当前用户',
    })
    if (res.success) {
      message.success(decision === 'accepted' ? t('criticalValueV2.confirmAccepted') : t('criticalValueV2.rejectedWithComment'))
      setConfirmTarget(null)
      await loadAll()
    } else {
      message.error(res.error?.message ?? t('criticalValueV2.confirmFailed'))
    }
  }

  const doNotify = async (triggerId: string) => {
    const res = await criticalV2Api.notifyTrigger(triggerId, {
      recipients: [{ name: '急诊值班医生', dept: '急诊科', phone: '13800000000' }],
    })
    if (res.success) {
      message.success(t('criticalValueV2.notifySent'))
      await loadAll()
    } else {
      message.error(res.error?.message ?? t('criticalValueV2.notifyFailed'))
    }
  }

  const statsItems = [
    { title: t('criticalValueV2.stat.totalTriggers'), value: stats?.totalTriggers ?? '-', color: '#fff', prefix: <AlertOctagon size={14} /> },
    { title: t('criticalValueV2.stat.triggerRate'), value: stats?.triggerRate ?? '-', color: '#fff', prefix: <Activity size={14} /> },
    { title: t('criticalValueV2.stat.onTimeConfirmRate'), value: stats?.onTimeConfirmRate ?? '-', color: '#bbf7d0', prefix: <Zap size={14} /> },
    { title: t('criticalValueV2.stat.timeoutRate'), value: stats?.timeoutRate ?? '-', color: (stats?.timeoutRate ?? 0) > 20 ? '#fca5a5' : '#fff', prefix: <Clock size={14} /> },
    { title: t('criticalValueV2.stat.avgResponse'), value: stats?.avgResponseMinutes ?? '-', color: '#fff', prefix: <TrendingUp size={14} /> },
    ...(compact ? [] : [{ title: t('criticalValueV2.stat.confirmed'), value: stats?.confirmedCount ?? '-', color: '#bbf7d0', prefix: <CheckCircle2 size={14} /> }]),
  ]

  return (
    <div data-testid="critical-value-panel-v2" role="region" aria-label={t('criticalValueV2.ariaLabel')}>
      <div style={{ background: 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)', color: '#fff', padding: '12px 16px', borderRadius: 8, marginBottom: 12 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <AlertOctagon size={18} />
            <strong style={{ fontSize: 16 }}>{t('criticalValueV2.title')}</strong>
            <Tag color="purple">Wave 6C · F5</Tag>
            <Tag color="cyan">{t('criticalValueV2.ruleEngine')}</Tag>
          </Space>
          <Tooltip title={t('criticalValueV2.refresh')}>
            <Button size="small" ghost icon={<RefreshCw size={12} />} onClick={() => void loadAll()}>
              {t('criticalValueV2.refresh')}
            </Button>
          </Tooltip>
        </Space>
        <Row gutter={12} style={{ marginTop: 12 }}>
          {statsItems.map((s) => (
            <Col span={compact ? 4 : 24 / statsItems.length} key={s.title}>
              <Statistic
                title={<span style={{ color: '#fff' }}>{s.title}</span>}
                value={s.value}
                styles={{ content: { color: s.color, fontSize: 18 } }}
                prefix={s.prefix}
              />
            </Col>
          ))}
        </Row>
      </div>

      <Segmented
        block
        value={tab}
        onChange={(v) => setTab(String(v))}
        options={[
          { label: t('criticalValueV2.tab.rules'), value: 'rules' },
          { label: t('criticalValueV2.tab.evaluate'), value: 'evaluate' },
          { label: t('criticalValueV2.tab.triggers'), value: 'triggers' },
        ]}
        style={{ marginBottom: 12 }}
      />

      {tab === 'rules' && (
        <Card size="small" title={<Space><FileSearch size={14} color="#dc2626" />{t('criticalValueV2.rulesTable')}</Space>} extra={<Tag color="red">{filteredRules.length} {t('criticalValueV2.itemsUnit')}</Tag>}>
          <Space wrap style={{ marginBottom: 12 }}>
            <Input
              allowClear prefix={<Search size={12} />} placeholder={t('criticalValueV2.searchRules')} style={{ width: 240 }}
              value={keyword} onChange={(e) => setKeyword(e.target.value)}
            />
            <Select
              allowClear placeholder={t('criticalValueV2.filterByCategory')} style={{ width: 140 }} value={categoryFilter}
              onChange={(v) => setCategoryFilter(v)}
              options={categories.map((c) => ({ label: c, value: c }))}
            />
          </Space>
          <Table
            rowKey="id" size="small" loading={loading} dataSource={filteredRules} columns={ruleColumns}
            pagination={{ pageSize: 8, showSizeChanger: false, showTotal: (total) => `${t('criticalValueV2.totalPrefix')} ${total} ${t('criticalValueV2.rulesUnit')}` }}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: <Empty description={t('criticalValueV2.noRules')} /> }}
          />
        </Card>
      )}

      {tab === 'evaluate' && (
        <Row gutter={12}>
          <Col span={10}>
            <Card size="small" title={<Space><Activity size={14} color="#dc2626" />{t('criticalValueV2.evalInput')}</Space>}>
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <Row gutter={8}>
                  <Col span={12}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{t('criticalValueV2.patientName')}</div>
                    <Input placeholder={t('criticalValueV2.patientPlaceholder')} value={evalForm.patientName} onChange={(e) => setEvalForm({ ...evalForm, patientName: e.target.value })} />
                  </Col>
                  <Col span={12}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{t('criticalValueV2.modality')}</div>
                    <Select
                      allowClear placeholder={t('criticalValueV2.modalityPlaceholder')} style={{ width: '100%' }} value={evalForm.modality || undefined}
                      onChange={(v) => setEvalForm({ ...evalForm, modality: v ?? '' })}
                      options={modalities.map((m) => ({ label: m, value: m }))}
                    />
                  </Col>
                </Row>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{t('criticalValueV2.examType')}</div>
                  <Select
                    showSearch allowClear placeholder={t('criticalValueV2.examTypePlaceholder')} style={{ width: '100%' }} value={evalForm.examType || undefined}
                    onChange={(v) => setEvalForm({ ...evalForm, examType: v ?? '' })}
                    options={examTypes.map((et) => ({ label: et, value: et }))}
                  />
                </div>
                <Row gutter={8}>
                  <Col span={12}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{t('criticalValueV2.examItem')}</div>
                    <Select
                      style={{ width: '100%' }} value={evalForm.itemKey}
                      onChange={(v) => setEvalForm({ ...evalForm, itemKey: v })}
                      options={rules.map((r) => ({ label: `${r.item} (${r.code})`, value: r.itemKey }))}
                    />
                  </Col>
                  <Col span={12}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{t('criticalValueV2.value')}</div>
                    <Input placeholder={t('criticalValueV2.valuePlaceholder')} value={evalForm.itemValue} onChange={(e) => setEvalForm({ ...evalForm, itemValue: e.target.value })} />
                  </Col>
                </Row>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{t('criticalValueV2.description')}</div>
                  <TextArea rows={3} placeholder={t('criticalValueV2.descriptionPlaceholder')} value={evalForm.description} onChange={(e) => setEvalForm({ ...evalForm, description: e.target.value })} />
                </div>
                <Space>
                  <Button type="primary" loading={previewing} icon={<Search size={12} />} onClick={() => void doEvaluate()}>
                    {t('criticalValueV2.previewMatch')}
                  </Button>
                  <Button type="primary" danger loading={judging} icon={<Send size={12} />} onClick={() => void doJudge()}>
                    {t('criticalValueV2.confirmTriggerNotify')}
                  </Button>
                </Space>
              </Space>
            </Card>
          </Col>
          <Col span={14}>
            <Card size="small" title={<Space><Zap size={14} color="#dc2626" />{t('criticalValueV2.judgeResult')} ({preview.length})</Space>}>
              {preview.length === 0 ? (
                <Empty description={t('criticalValueV2.judgeResultEmpty')} />
              ) : (
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  {preview.map((pv) => (
                    <div key={pv.id} style={{ border: `1px solid ${LEVEL_META[pv.level]?.color}33`, borderLeft: `4px solid ${LEVEL_META[pv.level]?.color}`, borderRadius: 6, padding: 10, background: LEVEL_META[pv.level]?.bg }}>
                      <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space wrap>
                          <Tag color={LEVEL_META[pv.level]?.color}>{LEVEL_META[pv.level]?.label}</Tag>
                          <Tag color="red">{pv.ruleCode}</Tag>
                          <strong>{pv.ruleName}</strong>
                        </Space>
                        <span style={{ fontSize: 12, color: '#64748b' }}>{pv.matchedText}</span>
                      </Space>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>{pv.description}</div>
                      <div style={{ fontSize: 12, color: LEVEL_META[pv.level]?.color, marginTop: 4 }}>
                        <strong>{t('criticalValueV2.suggestedAction')}</strong> {pv.suggestion}
                      </div>
                    </div>
                  ))}
                </Space>
              )}
            </Card>
          </Col>
        </Row>
      )}

      {tab === 'triggers' && (
        <Row gutter={12}>
          <Col span={10}>
            <Card size="small" title={<Space><Bell size={14} color="#dc2626" />{t('criticalValueV2.triggerRecords')}</Space>}>
              <Table
                rowKey="id" size="small" loading={loading} dataSource={triggers} columns={triggerColumns}
                pagination={{ pageSize: 6, showSizeChanger: false }}
                onRow={(record) => ({ onClick: () => setSelectedTriggerId(record.id), style: { cursor: 'pointer' } })}
                rowClassName={(record) => (record.id === selectedTriggerId ? 'ant-table-row-selected' : '')}
                scroll={{ x: 'max-content' }}
                locale={{ emptyText: <Empty description={t('criticalValueV2.noTriggerRecords')} /> }}
              />
            </Card>
          </Col>
          <Col span={14}>
            <Card
              size="small"
              title={<Space><AlertOctagon size={14} color="#dc2626" />{t('criticalValueV2.notifAndConfirm')}</Space>}
              extra={selectedTrigger && (
                <Space>
                  <Badge color={LEVEL_META[selectedTrigger.level]?.color} text={LEVEL_META[selectedTrigger.level]?.label} />
                  {selectedTrigger.status === 'triggered' && (
                    <Button size="small" type="primary" icon={<Send size={12} />} onClick={() => void doNotify(selectedTrigger.id)}>
                      {t('criticalValueV2.sendNotification')}
                    </Button>
                  )}
                </Space>
              )}
            >
              {!selectedTrigger ? (
                <Empty description={t('criticalValueV2.selectTrigger')} />
              ) : (
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  <div style={{ background: 'var(--bg-secondary, #f8fafc)', borderRadius: 6, padding: 10, fontSize: 12 }}>
                    <Space wrap>
                      <strong>{selectedTrigger.patientName}</strong>
                      <span style={{ color: '#94a3b8' }}>{selectedTrigger.modality} / {selectedTrigger.examType}</span>
                      <Tag color={TRIGGER_STATUS_META[selectedTrigger.status]?.color}>{TRIGGER_STATUS_META[selectedTrigger.status]?.label}</Tag>
                      {selectedTrigger.responseMinutes !== undefined && (
                        <Tag color={selectedTrigger.responseMinutes <= 30 ? 'green' : 'red'}>
                          {t('criticalValueV2.response')} {selectedTrigger.responseMinutes} min
                        </Tag>
                      )}
                    </Space>
                    <div style={{ marginTop: 4 }}><strong>{selectedTrigger.ruleCode}</strong> · {selectedTrigger.ruleName}</div>
                    <div style={{ marginTop: 4 }}>{selectedTrigger.description}</div>
                    <div style={{ color: '#dc2626', marginTop: 4 }}><strong>{t('criticalValueV2.suggestedAction')}</strong> {selectedTrigger.suggestion}</div>
                    {selectedTrigger.confirmComment && (
                      <div style={{ color: '#64748b', marginTop: 4 }}>{t('criticalValueV2.remark')} {selectedTrigger.confirmComment}</div>
                    )}
                  </div>
                  <Table
                    rowKey="id" size="small" dataSource={selectedNotifications} columns={notifColumns}
                    pagination={false} scroll={{ x: 'max-content' }}
                    locale={{ emptyText: <Empty description={t('criticalValueV2.noNotifRecords')} /> }}
                  />
                  {selectedTrigger.status !== 'triggered' && (
                    <Timeline
                      items={[
                        { color: 'red', children: <>{t('criticalValueV2.timeline.triggered')} {formatHM(selectedTrigger.createdAt)}</> },
                        ...(selectedTrigger.notifiedAt ? [{ color: 'orange', children: <>{t('criticalValueV2.timeline.notified')} {formatHM(selectedTrigger.notifiedAt)}</> }] : []),
                        ...(selectedTrigger.confirmedAt ? [{
                          color: selectedTrigger.confirmDecision === 'accepted' ? 'green' : 'gray',
                          children: <>{selectedTrigger.confirmDecision === 'accepted' ? t('criticalValueV2.timeline.confirmed') : t('criticalValueV2.timeline.rejected')} {formatHM(selectedTrigger.confirmedAt)} · {selectedTrigger.confirmedBy}</>,
                        }] : []),
                      ]}
                    />
                  )}
                </Space>
              )}
            </Card>
          </Col>
        </Row>
      )}

      <Divider style={{ margin: '12px 0 0' }} />
      <div style={{ fontSize: 12, color: '#94a3b8', padding: '8px 0' }}>
        {t('criticalValueV2.footerNote')}
      </div>

      <Modal
        title={confirmTarget?.decision === 'accepted' ? t('criticalValueV2.modal.acceptTitle') : t('criticalValueV2.modal.rejectTitle')}
        open={!!confirmTarget}
        onCancel={() => setConfirmTarget(null)}
        onOk={() => void doConfirm()}
        okText={t('criticalValueV2.submit')}
        cancelText={t('criticalValueV2.cancel')}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ fontSize: 12 }}>
            {t('criticalValueV2.modal.patient')} <strong>{selectedTrigger?.patientName}</strong> · {selectedTrigger?.ruleName}
            <br />
            <span style={{ color: '#64748b', fontSize: 12 }}>{t('criticalValueV2.modal.recipient')} {confirmTarget?.notification.recipientName} ({confirmTarget?.notification.recipientDept})</span>
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>{t('criticalValueV2.modal.commentOptional')}</div>
            <TextArea rows={3} placeholder={t('criticalValueV2.modal.commentPlaceholder')} value={confirmComment} onChange={(e) => setConfirmComment(e.target.value)} />
          </div>
        </Space>
      </Modal>
    </div>
  )
}

export default CriticalValuePanelV2
