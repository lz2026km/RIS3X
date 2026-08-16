/**
 * G005 放射RIS系统 v3.0.6.11-103 Wave 4B - 急诊通道管理页面
 * 覆盖后端 emergency-channel.controller 全部 5 端点:
 *   GET/PUT  /emergency-channel/config        通道配置 (读取/保存)
 *   GET      /emergency-channel/records       触发记录列表 (patientId/status 过滤)
 *   POST     /emergency-channel/trigger       手动触发 + 模拟通知
 *   POST     /emergency-channel/records/:id/acknowledge  确认处置
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Card, Table, Switch, Space, Row, Col, Statistic, Button, Tag, message, Form, Input, Select, Alert,
  Descriptions, Spin, Modal, InputNumber, Badge, Tooltip, Empty,
} from 'antd'
import { HeartPulse, Settings, Zap, History, Save, RefreshCw, CheckCircle2, BellRing, AlertTriangle } from 'lucide-react'
import { emergencyChannelApi, type EmergencyChannelConfigItem, type EmergencyTriggerRecord, type EmergencyChannelType } from '../../services/api/emergencyChannelApi'

const TRIGGER_TYPES: Array<{ value: string; label: string }> = [
  { value: 'critical-finding', label: '危急值发现' },
  { value: 'stat-imaging', label: '急诊影像加急' },
  { value: 'icu-request', label: 'ICU 会诊请求' },
  { value: 'er-request', label: '急诊科请求' },
  { value: 'manual', label: '手动触发' },
]

const STATUS_META: Record<string, { color: string; label: string }> = {
  sent: { color: 'red', label: '已发送' },
  acknowledged: { color: 'blue', label: '已确认' },
  completed: { color: 'green', label: '已完成' },
}

export default function EmergencyChannelPage() {
  const { t } = useTranslation('v3emergency')
  const [configLoading, setConfigLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [channels, setChannels] = useState<EmergencyChannelConfigItem[]>([])
  const [autoTriggerEnabled, setAutoTriggerEnabled] = useState(false)
  const [keywords, setKeywords] = useState<string[]>([])
  const [records, setRecords] = useState<EmergencyTriggerRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [recordFilter, setRecordFilter] = useState<{ patientId?: string; status?: string }>({})
  const [detail, setDetail] = useState<EmergencyTriggerRecord | null>(null)
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null)
  const [triggerForm] = Form.useForm()

  const fetchConfig = useCallback(async () => {
    setConfigLoading(true)
    try {
      const res = await emergencyChannelApi.getConfig()
      if (res.success && res.data) {
        setChannels(res.data.channels ?? [])
        setAutoTriggerEnabled(Boolean(res.data.autoTrigger?.enabled))
        setKeywords(Array.isArray(res.data.autoTrigger?.keywords) ? res.data.autoTrigger.keywords : [])
      }
    } catch { /* 配置接口不可用时保持空 */ }
    setConfigLoading(false)
  }, [])

  const fetchRecords = useCallback(async () => {
    setRecordsLoading(true)
    try {
      const res = await emergencyChannelApi.listRecords(recordFilter.patientId || recordFilter.status ? recordFilter : undefined)
      const data = res.data as unknown
      const list = Array.isArray(data) ? data : Array.isArray((data as { items?: unknown })?.items) ? (data as { items: EmergencyTriggerRecord[] }).items : []
      setRecords(list as EmergencyTriggerRecord[])
    } catch { /* 记录接口不可用时保持空 */ }
    setRecordsLoading(false)
  }, [recordFilter])

  useEffect(() => {
    void fetchConfig()
    void fetchRecords()
  }, [fetchConfig, fetchRecords])

  // PUT /emergency-channel/config — 保存通道配置 + 自动触发关键词
  const handleSaveConfig = async () => {
    setSaving(true)
    try {
      const res = await emergencyChannelApi.saveConfig({
        channels: channels.map((c) => ({ type: c.type, enabled: c.enabled, priority: c.priority, targetRole: c.targetRole })),
        autoTrigger: { enabled: autoTriggerEnabled, keywords },
      })
      if (res.success) {
        message.success(t('saveSuccess', '通道配置已保存'))
        void fetchConfig()
      } else {
        message.error(res.error?.message ?? t('saveFailed', '保存失败'))
      }
    } catch {
      message.error(t('saveFailed', '保存失败'))
    }
    setSaving(false)
  }

  const patchChannel = (type: EmergencyChannelType, patch: Partial<EmergencyChannelConfigItem>) => {
    setChannels((prev) => prev.map((c) => (c.type === type ? { ...c, ...patch } : c)))
  }

  // POST /emergency-channel/trigger — 手动触发 (含模拟通知回显)
  const handleTrigger = async () => {
    const values = await triggerForm.validateFields()
    try {
      const res = await emergencyChannelApi.trigger({
        patientId: values.patientId,
        patientName: values.patientName,
        type: values.type ?? 'manual',
        reason: values.reason,
        triggeredBy: '当前用户',
      })
      if (res.success && res.data) {
        setDetail(res.data)
        message.success(t('triggerSuccess', '急诊通知已触发并发送'))
        triggerForm.resetFields()
        void fetchRecords()
      } else {
        message.error(res.error?.message ?? t('triggerFailed', '触发失败'))
      }
    } catch (e) {
      message.error((e as Error)?.message || t('triggerFailed', '触发失败'))
    }
  }

  // POST /emergency-channel/records/:id/acknowledge — 确认处置
  const handleAcknowledge = async (id: string) => {
    setAcknowledgingId(id)
    try {
      const res = await emergencyChannelApi.acknowledge(id)
      if (res.success) {
        setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'acknowledged' } : r)))
        message.success(t('acknowledgeSuccess', '已确认处置'))
      } else {
        message.error(res.error?.message ?? t('acknowledgeFailed', '确认失败'))
      }
    } catch {
      message.error(t('acknowledgeFailed', '确认失败'))
    }
    setAcknowledgingId(null)
  }

  const enabledCount = channels.filter((c) => c.enabled).length

  return (
    <div style={{ padding: 24 }}>
      <Alert
        type="info"
        showIcon
        banner
        message={t('title', '急诊通道管理')}
        description={t('desc', 'PACS 危急值/急诊影像通知通道: 配置短信/电话/微信等通道, 手动触发并跟踪确认处置')}
        style={{ marginBottom: 16 }}
      />
      <Space style={{ marginBottom: 16 }}>
        <HeartPulse size={20} color="#e11d48" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('title', '急诊通道管理')}</span>
        <Tag color="red">{t('stat', '急诊')}</Tag>
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title={t('statEnabled', '启用通道')} value={enabledCount} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title={t('statTotal', '通道总数')} value={channels.length} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title={t('statAutoTrigger', '自动触发')} value={autoTriggerEnabled ? t('on', '开启') : t('off', '关闭')} styles={{ content: { color: autoTriggerEnabled ? '#52c41a' : '#999' } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title={t('statRecords', '触发记录')} value={records.length} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title={t('statSent', '待确认')} value={records.filter((r) => r.status === 'sent').length} styles={{ content: { color: records.some((r) => r.status === 'sent') ? '#fa8c16' : '#52c41a' } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title={t('statKeywords', '触发关键词')} value={keywords.length} /></Card></Col>
      </Row>

      {/* ─────────── 通道配置 (GET/PUT /emergency-channel/config) ─────────── */}
      <Card
        size="small"
        title={<Space><Settings size={14} />{t('config', '通道配置')}</Space>}
        extra={<Space><Button size="small" icon={<RefreshCw size={12} />} onClick={() => void fetchConfig()} loading={configLoading}>{t('refresh', '刷新')}</Button><Button type="primary" size="small" icon={<Save size={12} />} loading={saving} onClick={() => void handleSaveConfig()}>{t('saveConfig', '保存配置')}</Button></Space>}
        style={{ marginBottom: 16 }}
      >
        <Spin spinning={configLoading}>
          <Card size="small" type="inner" title={t('autoTrigger', '自动触发规则')} style={{ marginBottom: 12 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <Switch checked={autoTriggerEnabled} onChange={setAutoTriggerEnabled} />
                <span>{t('autoTriggerDesc', '报告/记录命中关键词时自动触发通知')}</span>
              </Space>
              <Space style={{ width: '100%' }} align="start">
                <span style={{ minWidth: 80, paddingTop: 4 }}>{t('keywords', '触发关键词')}:</span>
                <Select
                  mode="tags"
                  style={{ flex: 1 }}
                  placeholder={t('keywordsPlaceholder', '输入关键词后回车, 如: 主动脉夹层')}
                  value={keywords}
                  onChange={setKeywords}
                  tokenSeparators={[',', '，', ';', '；']}
                />
              </Space>
            </Space>
          </Card>
          <Table<EmergencyChannelConfigItem>
            rowKey="type"
            size="small"
            pagination={false}
            dataSource={channels}
            locale={{ emptyText: t('noData', '暂无通道') }}
            columns={[
              { title: t('channelName', '通道'), dataIndex: 'label', width: 120, render: (v) => <b>{String(v)}</b> },
              { title: t('channelType', '类型'), dataIndex: 'type', width: 100, render: (v) => <Tag color="blue" style={{ fontFamily: 'monospace' }}>{String(v)}</Tag> },
              {
                title: t('enable', '启用'), dataIndex: 'enabled', width: 90,
                render: (_, c) => <Switch checked={c.enabled} onChange={(checked) => patchChannel(c.type, { enabled: checked })} />,
              },
              {
                title: t('priority', '优先级'), dataIndex: 'priority', width: 110,
                render: (_, c) => <InputNumber size="small" min={1} max={99} value={c.priority} onChange={(v) => patchChannel(c.type, { priority: Number(v ?? 1) })} />,
              },
              {
                title: t('targetRole', '目标角色'), dataIndex: 'targetRole',
                render: (_, c) => <Input size="small" value={c.targetRole} onChange={(e) => patchChannel(c.type, { targetRole: e.target.value })} />,
              },
            ]}
          />
        </Spin>
      </Card>

      {/* ─────────── 手动触发 (POST /emergency-channel/trigger) ─────────── */}
      <Card size="small" title={<Space><Zap size={14} />{t('manualTrigger', '手动触发')}</Space>} style={{ marginBottom: 16 }}>
        <Form form={triggerForm} layout="vertical" style={{ maxWidth: 640 }} initialValues={{ type: 'critical-finding' }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="patientId" label={t('patientId', '患者 ID')} rules={[{ required: true, message: t('patientIdRequired', '请输入患者 ID') }]}>
                <Input placeholder="如: RAD-P003" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="patientName" label={t('patientName', '患者姓名')}>
                <Input placeholder={t('patientNamePlaceholder', '如: 李明')} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="type" label={t('triggerType', '触发类型')}>
                <Select options={TRIGGER_TYPES} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="reason" label={t('reason', '触发原因')} rules={[{ required: true, min: 5, message: t('reasonMin', '原因至少 5 个字符') }]}>
            <Input.TextArea rows={3} placeholder={t('reasonPlaceholder', '如: CTA 显示主动脉增宽伴内膜片, 疑似主动脉夹层')} />
          </Form.Item>
          <Button type="primary" icon={<BellRing size={14} />} onClick={() => void handleTrigger()}>{t('trigger', '触发通知')}</Button>
        </Form>
      </Card>

      {/* ─────────── 触发记录 (GET /emergency-channel/records + acknowledge) ─────────── */}
      <Card
        size="small"
        title={<Space><History size={14} />{t('records', '触发记录')}</Space>}
        extra={<Space>
          <Input size="small" allowClear placeholder={t('filterPatient', '按患者 ID 筛选')} style={{ width: 160 }} onChange={(e) => setRecordFilter((p) => ({ ...p, patientId: e.target.value }))} />
          <Select size="small" allowClear placeholder={t('filterStatus', '按状态筛选')} style={{ width: 130 }} onChange={(v) => setRecordFilter((p) => ({ ...p, status: v }))} options={Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }))} />
          <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void fetchRecords()}>{t('refresh', '刷新')}</Button>
        </Space>}
      >
        <Table<EmergencyTriggerRecord>
          rowKey="id"
          size="small"
          loading={recordsLoading}
          dataSource={records}
          pagination={{ pageSize: 10, showTotal: (total) => `${t('total', '共')} ${total} ${t('records', '条')}` }}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('noData', '暂无触发记录')} /> }}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 150, render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(v)}</span> },
            { title: t('patient', '患者'), width: 140, render: (_, r) => <Space direction="vertical" size={0}><b>{r.patientName ?? '-'}</b><span style={{ fontSize: 11, color: '#999' }}>{r.patientId}</span></Space> },
            { title: t('triggerType', '类型'), dataIndex: 'type', width: 130, render: (v) => <Tag color="volcano">{String(v)}</Tag> },
            { title: t('reason', '原因'), dataIndex: 'reason', ellipsis: true, render: (v) => <Tooltip title={String(v)}>{String(v)}</Tooltip> },
            { title: t('channels', '通知通道'), dataIndex: 'channels', width: 190, render: (v: EmergencyChannelType[]) => Array.isArray(v) ? v.map((c) => <Tag key={c} color="blue">{c}</Tag>) : '-' },
            { title: t('triggeredBy', '触发人'), dataIndex: 'triggeredBy', width: 120 },
            { title: t('triggeredAt', '触发时间'), dataIndex: 'triggeredAt', width: 160, render: (v) => v ? new Date(String(v)).toLocaleString('zh-CN') : '-' },
            {
              title: t('status', '状态'), dataIndex: 'status', width: 100,
              render: (v: string) => {
                const m = STATUS_META[v] ?? { color: 'default', label: v }
                return <Badge status={m.color as 'success' | 'processing' | 'error' | 'default' | 'warning'} text={m.label} />
              },
            },
            {
              title: t('actions', '操作'), width: 150,
              render: (_, r) => (
                <Space size={4}>
                  <Button size="small" type="link" icon={<History size={12} />} onClick={() => setDetail(r)}>{t('detail', '详情')}</Button>
                  {r.status === 'sent' && (
                    <Button size="small" type="primary" ghost icon={<CheckCircle2 size={12} />} loading={acknowledgingId === r.id} onClick={() => void handleAcknowledge(r.id)}>{t('acknowledge', '确认处置')}</Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {/* 触发/详情 Modal: 展示通知投递结果 */}
      <Modal
        title={`${t('detail', '通知详情')} - ${detail?.id ?? ''}`}
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={<Button type="primary" onClick={() => setDetail(null)}>{t('close', '关闭')}</Button>}
        width={560}
      >
        {detail && (
          <>
            <Alert
              type={detail.status === 'completed' ? 'success' : detail.status === 'acknowledged' ? 'info' : 'warning'}
              showIcon
              icon={detail.status === 'sent' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
              message={<Space><Tag>{detail.id}</Tag><Badge status={(STATUS_META[detail.status]?.color ?? 'default') as 'success' | 'processing' | 'error' | 'default' | 'warning'} text={STATUS_META[detail.status]?.label ?? detail.status} /></Space>}
              description={detail.reason}
              style={{ marginBottom: 12 }}
            />
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label={t('patient', '患者')} span={2}>{detail.patientName ?? '-'} ({detail.patientId})</Descriptions.Item>
              <Descriptions.Item label={t('triggerType', '类型')}>{detail.type}</Descriptions.Item>
              <Descriptions.Item label={t('triggeredBy', '触发人')}>{detail.triggeredBy}</Descriptions.Item>
              <Descriptions.Item label={t('triggeredAt', '触发时间')} span={2}>{new Date(detail.triggeredAt).toLocaleString('zh-CN')}</Descriptions.Item>
            </Descriptions>
            <Card size="small" title={t('notifications', '通知投递记录')} style={{ marginTop: 12 }}>
              {detail.notifications?.length ? (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {detail.notifications.map((n, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg-secondary, #f8fafc)', borderRadius: 6 }}>
                      <Space>
                        <Tag color="blue">{n.channel}</Tag>
                        <span style={{ fontSize: 12 }}>{n.targetRole}</span>
                      </Space>
                      <Space size={4}>
                        {n.simulated && <Tag color="gold" style={{ fontSize: 11 }}>模拟</Tag>}
                        <span style={{ fontSize: 11, color: '#999' }}>{new Date(n.deliveredAt).toLocaleString('zh-CN')}</span>
                      </Space>
                    </div>
                  ))}
                </Space>
              ) : (
                <div style={{ color: '#999', fontSize: 12, textAlign: 'center', padding: 12 }}>{t('noData', '暂无通知记录')}</div>
              )}
            </Card>
          </>
        )}
      </Modal>
    </div>
  )
}
