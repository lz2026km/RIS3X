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

const { TextArea } = Input

const LEVEL_META: Record<string, { color: string; label: string; bg: string }> = {
  critical: { color: '#dc2626', label: '危急', bg: 'var(--color-error-bg)' },
  urgent: { color: '#f59e0b', label: '紧急', bg: 'var(--color-warning-bg)' },
  warning: { color: '#3b82f6', label: '警告', bg: 'var(--color-info-bg)' },
}

const CHANNEL_META: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  phone: { color: '#10b981', label: '电话', icon: <Phone size={12} /> },
  sms: { color: '#3b82f6', label: '短信', icon: <MessageSquare size={12} /> },
  message: { color: '#7c3aed', label: '站内消息', icon: <Bell size={12} /> },
}

const NOTIF_STATUS_META: Record<string, { color: string; label: string }> = {
  sent: { color: '#3b82f6', label: '已发送' },
  failed: { color: '#dc2626', label: '发送失败' },
  accepted: { color: '#10b981', label: '已接受' },
  rejected: { color: '#f59e0b', label: '已拒绝' },
}

const TRIGGER_STATUS_META: Record<string, { color: string; label: string }> = {
  triggered: { color: '#dc2626', label: '已触发' },
  notified: { color: '#f59e0b', label: '已通知' },
  confirmed: { color: '#10b981', label: '已确认' },
  rejected: { color: '#64748b', label: '已拒绝' },
  resolved: { color: '#0ea5e9', label: '已处置' },
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
      const [r, t, n, s] = await Promise.allSettled([
        criticalV2Api.listRules(),
        criticalV2Api.listTriggers(),
        criticalV2Api.listNotifications(),
        criticalV2Api.stats(),
      ])
      if (r.status === 'fulfilled' && r.value.success) setRules(r.value.data ?? [])
      if (t.status === 'fulfilled' && t.value.success) {
        setTriggers(t.value.data ?? [])
        if (!selectedTriggerId && (t.value.data ?? []).length > 0) setSelectedTriggerId(t.value.data![0]!.id)
      }
      if (n.status === 'fulfilled' && n.value.success) setNotifications(n.value.data ?? [])
      if (s.status === 'fulfilled' && s.value.success) setStats(s.value.data)
    } catch {
      message.error('加载危急值数据失败')
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

  const selectedTrigger = useMemo(() => triggers.find((t) => t.id === selectedTriggerId), [triggers, selectedTriggerId])
  const selectedNotifications = useMemo(
    () => notifications.filter((n) => n.triggerId === selectedTriggerId),
    [notifications, selectedTriggerId],
  )

  const ruleColumns: ColumnsType<CriticalRuleV2> = [
    { title: '编码', dataIndex: 'code', width: 90, fixed: 'left' as const, render: (v: string) => <Tag color="red">{v}</Tag> },
    { title: '规则名称', dataIndex: 'name', width: 170, render: (v: string, r) => (
        <Space size={4} wrap>
          <span>{v}</span>
          <Tag color={LEVEL_META[r.level]?.color}>{LEVEL_META[r.level]?.label}</Tag>
        </Space>
      ) },
    { title: '检查类型', dataIndex: 'examType', width: 120 },
    { title: '项目', dataIndex: 'item', width: 140 },
    { title: '阈值', width: 110, render: (_, r) => {
        if (r.operator === 'contains' || r.operator === 'notContains') return <code>含「{r.thresholdText}」</code>
        return <code>{r.operator} {r.threshold}{r.unit ?? ''}</code>
      } },
    { title: '时限(min)', dataIndex: 'responseDeadlineMin', width: 90 },
    { title: '建议处置', dataIndex: 'suggestion', ellipsis: true, width: 240 },
    { title: '启用', width: 70, render: (_, r) => (
        <Switch size="small" checked={r.enabled} onChange={async (checked) => {
          const res = await criticalV2Api.updateRule(r.id, { enabled: checked })
          if (res.success) {
            setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, enabled: checked } : x)))
          } else {
            message.error(res.error?.message ?? '操作失败')
          }
        }} />
      ) },
  ]

  const triggerColumns: ColumnsType<CriticalTriggerV2> = [
    { title: '患者', dataIndex: 'patientName', width: 90 },
    { title: '规则', dataIndex: 'ruleName', width: 170, render: (v: string, t) => (
        <Space size={4}>
          <Tag color={LEVEL_META[t.level]?.color}>{LEVEL_META[t.level]?.label}</Tag>
          <span>{v}</span>
        </Space>
      ) },
    { title: '触发说明', dataIndex: 'matchedText', ellipsis: true },
    { title: '状态', dataIndex: 'status', width: 90, render: (v: string) => {
        const m = TRIGGER_STATUS_META[v] ?? { color: 'default', label: v }
        return <Tag color={m.color}>{m.label}</Tag>
      } },
    { title: '触发时间', dataIndex: 'createdAt', width: 120, render: (v: string) => formatHM(v) },
  ]

  const notifColumns: ColumnsType<CriticalNotificationV2> = [
    { title: '渠道', dataIndex: 'channel', width: 90, render: (v: string) => {
        const m = CHANNEL_META[v]
        return <Tag color={m?.color} icon={m?.icon}>{m?.label ?? v}</Tag>
      } },
    { title: '对象', width: 130, render: (_, n) => (
        <Space size={4}>
          <span>{n.recipientName}</span>
          {n.recipientDept && <span style={{ fontSize: 12, color: '#94a3b8' }}>{n.recipientDept}</span>}
        </Space>
      ) },
    { title: '内容', dataIndex: 'content', ellipsis: true },
    { title: '时间', dataIndex: 'sentAt', width: 120, render: (v: string, n) => (n.status === 'failed' ? '-' : formatHM(v)) },
    { title: '状态', dataIndex: 'status', width: 90, render: (v: string) => {
        const m = NOTIF_STATUS_META[v] ?? { color: 'default', label: v }
        return <Tag color={m.color}>{m.label}</Tag>
      } },
    { title: '操作', width: 150, render: (_, n) => {
        if (n.status !== 'sent') return <span style={{ color: '#94a3b8', fontSize: 12 }}>已终态</span>
        return (
          <Space size={4}>
            <Button size="small" type="primary" icon={<CheckCircle2 size={12} />} onClick={() => { setConfirmTarget({ notification: n, decision: 'accepted' }); setConfirmComment('') }}>
              接受
            </Button>
            <Button size="small" danger icon={<XCircle size={12} />} onClick={() => { setConfirmTarget({ notification: n, decision: 'rejected' }); setConfirmComment('') }}>
              拒绝
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
        if ((res.data?.triggers ?? []).length === 0) message.info('未命中任何危急值规则')
      } else {
        message.error(res.error?.message ?? '判定失败')
      }
    } catch {
      message.error('判定服务不可用')
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
        message.success(`已生成 ${created.length} 条危急值触发记录, 自动通知已发送`)
        setPreview([])
        setTab('triggers')
        await loadAll()
      } else {
        message.error(res.error?.message ?? '生成失败')
      }
    } catch {
      message.error('生成服务不可用')
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
      message.success(decision === 'accepted' ? '已确认接收' : '已拒绝并备注')
      setConfirmTarget(null)
      await loadAll()
    } else {
      message.error(res.error?.message ?? '确认失败')
    }
  }

  const doNotify = async (triggerId: string) => {
    const res = await criticalV2Api.notifyTrigger(triggerId, {
      recipients: [{ name: '急诊值班医生', dept: '急诊科', phone: '13800000000' }],
    })
    if (res.success) {
      message.success('通知已发送 (电话/短信/消息)')
      await loadAll()
    } else {
      message.error(res.error?.message ?? '通知失败')
    }
  }

  const statsItems = [
    { title: '累计触发', value: stats?.totalTriggers ?? '-', color: '#fff', prefix: <AlertOctagon size={14} /> },
    { title: '触发率(%)', value: stats?.triggerRate ?? '-', color: '#fff', prefix: <Activity size={14} /> },
    { title: '确认及时率(%)', value: stats?.onTimeConfirmRate ?? '-', color: '#bbf7d0', prefix: <Zap size={14} /> },
    { title: '超时率(%)', value: stats?.timeoutRate ?? '-', color: (stats?.timeoutRate ?? 0) > 20 ? '#fca5a5' : '#fff', prefix: <Clock size={14} /> },
    { title: '平均响应(min)', value: stats?.avgResponseMinutes ?? '-', color: '#fff', prefix: <TrendingUp size={14} /> },
    ...(compact ? [] : [{ title: '已确认', value: stats?.confirmedCount ?? '-', color: '#bbf7d0', prefix: <CheckCircle2 size={14} /> }]),
  ]

  return (
    <div data-testid="critical-value-panel-v2" role="region" aria-label="危急值管理 V2 面板">
      <div style={{ background: 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)', color: '#fff', padding: '12px 16px', borderRadius: 8, marginBottom: 12 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <AlertOctagon size={18} />
            <strong style={{ fontSize: 16 }}>危急值管理 V2</strong>
            <Tag color="purple">Wave 6C · F5</Tag>
            <Tag color="cyan">规则库判定</Tag>
          </Space>
          <Tooltip title="刷新">
            <Button size="small" ghost icon={<RefreshCw size={12} />} onClick={() => void loadAll()}>
              刷新
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
          { label: '规则库', value: 'rules' },
          { label: '自动判定', value: 'evaluate' },
          { label: '触发与通知', value: 'triggers' },
        ]}
        style={{ marginBottom: 12 }}
      />

      {tab === 'rules' && (
        <Card size="small" title={<Space><FileSearch size={14} color="#dc2626" />规则库表格</Space>} extra={<Tag color="red">{filteredRules.length} 条</Tag>}>
          <Space wrap style={{ marginBottom: 12 }}>
            <Input
              allowClear prefix={<Search size={12} />} placeholder="搜索规则名称/编码/检查类型" style={{ width: 240 }}
              value={keyword} onChange={(e) => setKeyword(e.target.value)}
            />
            <Select
              allowClear placeholder="按类别过滤" style={{ width: 140 }} value={categoryFilter}
              onChange={(v) => setCategoryFilter(v)}
              options={categories.map((c) => ({ label: c, value: c }))}
            />
          </Space>
          <Table
            rowKey="id" size="small" loading={loading} dataSource={filteredRules} columns={ruleColumns}
            pagination={{ pageSize: 8, showSizeChanger: false, showTotal: (t) => `共 ${t} 条规则` }}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: <Empty description="暂无规则" /> }}
          />
        </Card>
      )}

      {tab === 'evaluate' && (
        <Row gutter={12}>
          <Col span={10}>
            <Card size="small" title={<Space><Activity size={14} color="#dc2626" />自动判定输入</Space>}>
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <Row gutter={8}>
                  <Col span={12}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>患者姓名</div>
                    <Input placeholder="如: 张伟" value={evalForm.patientName} onChange={(e) => setEvalForm({ ...evalForm, patientName: e.target.value })} />
                  </Col>
                  <Col span={12}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>模态</div>
                    <Select
                      allowClear placeholder="如: CT" style={{ width: '100%' }} value={evalForm.modality || undefined}
                      onChange={(v) => setEvalForm({ ...evalForm, modality: v ?? '' })}
                      options={modalities.map((m) => ({ label: m, value: m }))}
                    />
                  </Col>
                </Row>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>检查类型</div>
                  <Select
                    showSearch allowClear placeholder="选择检查类型" style={{ width: '100%' }} value={evalForm.examType || undefined}
                    onChange={(v) => setEvalForm({ ...evalForm, examType: v ?? '' })}
                    options={examTypes.map((t) => ({ label: t, value: t }))}
                  />
                </div>
                <Row gutter={8}>
                  <Col span={12}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>检查项目</div>
                    <Select
                      style={{ width: '100%' }} value={evalForm.itemKey}
                      onChange={(v) => setEvalForm({ ...evalForm, itemKey: v })}
                      options={rules.map((r) => ({ label: `${r.item} (${r.code})`, value: r.itemKey }))}
                    />
                  </Col>
                  <Col span={12}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>数值</div>
                    <Input placeholder="如: 82" value={evalForm.itemValue} onChange={(e) => setEvalForm({ ...evalForm, itemValue: e.target.value })} />
                  </Col>
                </Row>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>影像所见描述</div>
                  <TextArea rows={3} placeholder="如: 升主动脉见内膜片及真假双腔" value={evalForm.description} onChange={(e) => setEvalForm({ ...evalForm, description: e.target.value })} />
                </div>
                <Space>
                  <Button type="primary" loading={previewing} icon={<Search size={12} />} onClick={() => void doEvaluate()}>
                    规则匹配预览
                  </Button>
                  <Button type="primary" danger loading={judging} icon={<Send size={12} />} onClick={() => void doJudge()}>
                    确认触发 + 自动通知
                  </Button>
                </Space>
              </Space>
            </Card>
          </Col>
          <Col span={14}>
            <Card size="small" title={<Space><Zap size={14} color="#dc2626" />判定结果 ({preview.length})</Space>}>
              {preview.length === 0 ? (
                <Empty description="填写检查结果后点击「规则匹配预览」" />
              ) : (
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  {preview.map((t) => (
                    <div key={t.id} style={{ border: `1px solid ${LEVEL_META[t.level]?.color}33`, borderLeft: `4px solid ${LEVEL_META[t.level]?.color}`, borderRadius: 6, padding: 10, background: LEVEL_META[t.level]?.bg }}>
                      <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space wrap>
                          <Tag color={LEVEL_META[t.level]?.color}>{LEVEL_META[t.level]?.label}</Tag>
                          <Tag color="red">{t.ruleCode}</Tag>
                          <strong>{t.ruleName}</strong>
                        </Space>
                        <span style={{ fontSize: 12, color: '#64748b' }}>{t.matchedText}</span>
                      </Space>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>{t.description}</div>
                      <div style={{ fontSize: 12, color: LEVEL_META[t.level]?.color, marginTop: 4 }}>
                        <strong>建议处置:</strong> {t.suggestion}
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
            <Card size="small" title={<Space><Bell size={14} color="#dc2626" />触发记录</Space>}>
              <Table
                rowKey="id" size="small" loading={loading} dataSource={triggers} columns={triggerColumns}
                pagination={{ pageSize: 6, showSizeChanger: false }}
                onRow={(record) => ({ onClick: () => setSelectedTriggerId(record.id), style: { cursor: 'pointer' } })}
                rowClassName={(record) => (record.id === selectedTriggerId ? 'ant-table-row-selected' : '')}
                scroll={{ x: 'max-content' }}
                locale={{ emptyText: <Empty description="暂无触发记录" /> }}
              />
            </Card>
          </Col>
          <Col span={14}>
            <Card
              size="small"
              title={<Space><AlertOctagon size={14} color="#dc2626" />通知记录与确认</Space>}
              extra={selectedTrigger && (
                <Space>
                  <Badge color={LEVEL_META[selectedTrigger.level]?.color} text={LEVEL_META[selectedTrigger.level]?.label} />
                  {selectedTrigger.status === 'triggered' && (
                    <Button size="small" type="primary" icon={<Send size={12} />} onClick={() => void doNotify(selectedTrigger.id)}>
                      发送通知
                    </Button>
                  )}
                </Space>
              )}
            >
              {!selectedTrigger ? (
                <Empty description="请选择触发记录" />
              ) : (
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  <div style={{ background: 'var(--bg-secondary, #f8fafc)', borderRadius: 6, padding: 10, fontSize: 12 }}>
                    <Space wrap>
                      <strong>{selectedTrigger.patientName}</strong>
                      <span style={{ color: '#94a3b8' }}>{selectedTrigger.modality} / {selectedTrigger.examType}</span>
                      <Tag color={TRIGGER_STATUS_META[selectedTrigger.status]?.color}>{TRIGGER_STATUS_META[selectedTrigger.status]?.label}</Tag>
                      {selectedTrigger.responseMinutes !== undefined && (
                        <Tag color={selectedTrigger.responseMinutes <= 30 ? 'green' : 'red'}>
                          响应 {selectedTrigger.responseMinutes} min
                        </Tag>
                      )}
                    </Space>
                    <div style={{ marginTop: 4 }}><strong>{selectedTrigger.ruleCode}</strong> · {selectedTrigger.ruleName}</div>
                    <div style={{ marginTop: 4 }}>{selectedTrigger.description}</div>
                    <div style={{ color: '#dc2626', marginTop: 4 }}><strong>建议处置:</strong> {selectedTrigger.suggestion}</div>
                    {selectedTrigger.confirmComment && (
                      <div style={{ color: '#64748b', marginTop: 4 }}>备注: {selectedTrigger.confirmComment}</div>
                    )}
                  </div>
                  <Table
                    rowKey="id" size="small" dataSource={selectedNotifications} columns={notifColumns}
                    pagination={false} scroll={{ x: 'max-content' }}
                    locale={{ emptyText: <Empty description="暂无通知记录" /> }}
                  />
                  {selectedTrigger.status !== 'triggered' && (
                    <Timeline
                      items={[
                        { color: 'red', children: <>触发 {formatHM(selectedTrigger.createdAt)}</> },
                        ...(selectedTrigger.notifiedAt ? [{ color: 'orange', children: <>通知 {formatHM(selectedTrigger.notifiedAt)}</> }] : []),
                        ...(selectedTrigger.confirmedAt ? [{
                          color: selectedTrigger.confirmDecision === 'accepted' ? 'green' : 'gray',
                          children: <>{selectedTrigger.confirmDecision === 'accepted' ? '确认' : '拒绝'} {formatHM(selectedTrigger.confirmedAt)} · {selectedTrigger.confirmedBy}</>,
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
        危急值规则: 确定性阈值匹配 (含边界语义) · 通知渠道: 电话/短信/站内消息 · 确认流程: 接受/拒绝/备注
      </div>

      <Modal
        title={confirmTarget?.decision === 'accepted' ? '确认接收' : '拒绝并备注'}
        open={!!confirmTarget}
        onCancel={() => setConfirmTarget(null)}
        onOk={() => void doConfirm()}
        okText="提交"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ fontSize: 13 }}>
            患者 <strong>{selectedTrigger?.patientName}</strong> · {selectedTrigger?.ruleName}
            <br />
            <span style={{ color: '#64748b', fontSize: 12 }}>对象: {confirmTarget?.notification.recipientName} ({confirmTarget?.notification.recipientDept})</span>
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>备注 (可选)</div>
            <TextArea rows={3} placeholder="填写处理备注" value={confirmComment} onChange={(e) => setConfirmComment(e.target.value)} />
          </div>
        </Space>
      </Modal>
    </div>
  )
}

export default CriticalValuePanelV2
