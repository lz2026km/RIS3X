import React, { useCallback, useEffect, useState } from 'react'
import { Card, Space, Tag, Button, Select, Row, Col, Statistic, Tabs, message, Alert, Descriptions } from 'antd'
import { Activity, RefreshCw, RotateCcw, AlertTriangle, Send, Server, Radio } from 'lucide-react'
import {
  interopApi,
  type InterfaceMessageRecord,
  type RetryQueueRecord,
  type InterfaceStatsResponse,
  type InterfaceType,
} from '../../services/api/integrationApi'
import { DataTable } from '../../components/common/DataTable'
import { usePagination } from '../../hooks/usePagination'
import { t } from '../../i18n/appI18n'

const INTERFACES: InterfaceType[] = ['HL7', 'FHIR', 'DICOM', 'ORU', 'XDS']

const IFACE_COLOR: Record<string, string> = { HL7: 'purple', FHIR: 'geekblue', DICOM: 'cyan', ORU: 'green', XDS: 'gold' }
const STATUS_COLOR: Record<string, string> = { success: 'green', fail: 'red', retry: 'orange', pending: 'default', retrying: 'orange', dead_letter: 'volcano' }

const FALLBACK_MESSAGES: InterfaceMessageRecord[] = [
  { id: 'MSG-00001', interfaceType: 'HL7', direction: 'OUTBOUND', messageType: 'ORU^R01', status: 'success', ackStatus: 'AA', retryCount: 0, endpoint: 'mllp://his.local/1', summary: '报告结果发送 HIS', createdAt: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: 'MSG-00003', interfaceType: 'HL7', direction: 'OUTBOUND', messageType: 'ORM^O01', status: 'fail', ackStatus: 'AE', retryCount: 0, endpoint: 'mllp://his.local/3', summary: '检查申请接收失败', createdAt: new Date(Date.now() - 19 * 60000).toISOString() },
  { id: 'MSG-00005', interfaceType: 'FHIR', direction: 'OUTBOUND', messageType: 'Patient', status: 'success', ackStatus: 'AA', retryCount: 0, endpoint: 'fhir://his.local/5', summary: '患者资源同步', createdAt: new Date(Date.now() - 33 * 60000).toISOString() },
  { id: 'MSG-00008', interfaceType: 'DICOM', direction: 'INBOUND', messageType: 'C-STORE', status: 'success', ackStatus: 'AA', retryCount: 0, endpoint: 'dicom://his.local/8', summary: '影像存储 PACS', createdAt: new Date(Date.now() - 54 * 60000).toISOString() },
  { id: 'MSG-00012', interfaceType: 'XDS', direction: 'INBOUND', messageType: 'ITI-41', status: 'success', ackStatus: 'AA', retryCount: 0, endpoint: 'xds://his.local/12', summary: '文档注册上架', createdAt: new Date(Date.now() - 82 * 60000).toISOString() },
]

const FALLBACK_QUEUE: RetryQueueRecord[] = [
  { id: 'RQ-00001', interfaceType: 'HL7', endpoint: 'hl7://his.local/retry/1', payload: {}, status: 'pending', attempts: 0, maxAttempts: 3, nextAttemptAt: new Date().toISOString(), createdAt: new Date(Date.now() - 30 * 60000).toISOString(), updatedAt: new Date(Date.now() - 10 * 60000).toISOString() },
  { id: 'RQ-00002', interfaceType: 'FHIR', endpoint: 'fhir://his.local/retry/2', payload: {}, status: 'retrying', attempts: 1, maxAttempts: 3, nextAttemptAt: new Date(Date.now() + 60000).toISOString(), lastError: 'attempt 1/3 failed', createdAt: new Date(Date.now() - 25 * 60000).toISOString(), updatedAt: new Date(Date.now() - 7 * 60000).toISOString() },
  { id: 'RQ-00003', interfaceType: 'DICOM', endpoint: 'dicom://his.local/retry/3', payload: {}, status: 'dead_letter', attempts: 3, maxAttempts: 3, nextAttemptAt: new Date().toISOString(), lastError: 'exceeded maxAttempts=3', createdAt: new Date(Date.now() - 20 * 60000).toISOString(), updatedAt: new Date(Date.now() - 4 * 60000).toISOString() },
]

const FALLBACK_STATS: InterfaceStatsResponse = {
  totalMessages: FALLBACK_MESSAGES.length,
  success: FALLBACK_MESSAGES.filter((m) => m.status === 'success').length,
  fail: FALLBACK_MESSAGES.filter((m) => m.status === 'fail').length,
  retry: 0,
  pending: 0,
  successRate: 80,
  byInterface: INTERFACES.map((interfaceType) => {
    const rows = FALLBACK_MESSAGES.filter((m) => m.interfaceType === interfaceType)
    return { interfaceType, total: rows.length, success: rows.filter((m) => m.status === 'success').length, fail: rows.filter((m) => m.status === 'fail').length, retry: 0 }
  }),
  queue: { total: FALLBACK_QUEUE.length, pending: 1, retrying: 1, success: 0, deadLetter: 1 },
}

export const InterfaceMonitorPage: React.FC = () => {
  const [tab, setTab] = useState('messages')
  const [messages, setMessages] = useState<InterfaceMessageRecord[]>(FALLBACK_MESSAGES)
  const [queue, setQueue] = useState<RetryQueueRecord[]>(FALLBACK_QUEUE)
  const [stats, setStats] = useState<InterfaceStatsResponse>(FALLBACK_STATS)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filterIface, setFilterIface] = useState<InterfaceType | undefined>()
  const [filterStatus, setFilterStatus] = useState<string | undefined>()
  const { pageData, pagination } = usePagination(messages, 10)
  const { pageData: queuePage, pagination: queuePagination } = usePagination(queue, 10)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [msgRes, statsRes, queueRes] = await Promise.all([
        interopApi.getMessages({ interfaceType: filterIface, status: filterStatus, limit: 200 }),
        interopApi.getStats(),
        interopApi.getQueue({ limit: 200 }),
      ])
      if (msgRes.success) setMessages(msgRes.data.entries)
      if (statsRes.success) setStats(statsRes.data)
      if (queueRes.success) setQueue(queueRes.data.entries)
      if (!msgRes.success || !statsRes.success || !queueRes.success) setLoadError(t('w10Interop.monitor.loadFailed'))
    } catch {
      setLoadError(t('w10Interop.monitor.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [filterIface, filterStatus])

  useEffect(() => { fetchAll() }, [fetchAll])

  const doProcess = async () => {
    try {
      const res = await interopApi.process()
      if (res.success) {
        const d = res.data
        message.success(t('w10Interop.msg.processed', { succeeded: d.succeeded, retried: d.retried, deadLettered: d.deadLettered }))
        fetchAll()
      } else message.error(t('w10Interop.msg.opFailed'))
    } catch { message.error(t('w10Interop.msg.opFailed')) }
  }

  const doRetry = async (id: string) => {
    try {
      const res = await interopApi.retry(id)
      if (res.success) { message.success(t('w10Interop.msg.retried', { id })); fetchAll() }
      else message.error(t('w10Interop.msg.opFailed'))
    } catch { message.error(t('w10Interop.msg.opFailed')) }
  }

  const doDeadLetter = async (id: string) => {
    try {
      const res = await interopApi.deadLetter(id)
      if (res.success) { message.success(t('w10Interop.msg.deadLettered', { id })); fetchAll() }
      else message.error(t('w10Interop.msg.opFailed'))
    } catch { message.error(t('w10Interop.msg.opFailed')) }
  }

  const doRequeue = async (id: string) => {
    try {
      const res = await interopApi.requeue(id)
      if (res.success) { message.success(t('w10Interop.msg.requeued', { id })); fetchAll() }
      else message.error(t('w10Interop.msg.opFailed'))
    } catch { message.error(t('w10Interop.msg.opFailed')) }
  }

  const enqueueTest = async () => {
    try {
      const res = await interopApi.enqueue({
        interfaceType: filterIface ?? 'HL7',
        endpoint: `mllp://his.local/test-${Date.now()}`,
        payload: { failTimes: 1 },
        maxAttempts: 3,
      })
      if (res.success) { message.success(t('w10Interop.msg.enqueued', { id: res.data.id })); fetchAll() }
      else message.error(t('w10Interop.msg.opFailed'))
    } catch { message.error(t('w10Interop.msg.opFailed')) }
  }

  const messageColumns = [
    { title: t('w10Interop.col.id'), dataIndex: 'id', key: 'id', width: 110 },
    { title: t('w10Interop.col.interface'), dataIndex: 'interfaceType', key: 'interfaceType', width: 90, render: (v: string) => <Tag color={IFACE_COLOR[v] ?? 'default'}>{v}</Tag> },
    { title: t('w10Interop.col.direction'), dataIndex: 'direction', key: 'direction', width: 100, render: (v: string) => <Tag color={v === 'INBOUND' ? 'blue' : 'orange'}>{v}</Tag> },
    { title: t('w10Interop.col.messageType'), dataIndex: 'messageType', key: 'messageType', width: 140 },
    { title: t('w10Interop.col.status'), dataIndex: 'status', key: 'status', width: 100, render: (v: string) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{t(`w10Interop.status.${v}`)}</Tag> },
    { title: t('w10Interop.col.ack'), dataIndex: 'ackStatus', key: 'ackStatus', width: 80, render: (v?: string) => v ?? '-' },
    { title: t('w10Interop.col.retryCount'), dataIndex: 'retryCount', key: 'retryCount', width: 80 },
    { title: t('w10Interop.col.endpoint'), dataIndex: 'endpoint', key: 'endpoint', width: 200 },
    { title: t('w10Interop.col.summary'), dataIndex: 'summary', key: 'summary', ellipsis: true },
    { title: t('w10Interop.col.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 170, render: (v: string) => new Date(v).toLocaleString() },
  ]

  const queueColumns = [
    { title: t('w10Interop.col.id'), dataIndex: 'id', key: 'id', width: 110 },
    { title: t('w10Interop.col.interface'), dataIndex: 'interfaceType', key: 'interfaceType', width: 90, render: (v: string) => <Tag color={IFACE_COLOR[v] ?? 'default'}>{v}</Tag> },
    { title: t('w10Interop.col.status'), dataIndex: 'status', key: 'status', width: 110, render: (v: string) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{t(`w10Interop.status.${v}`)}</Tag> },
    { title: t('w10Interop.col.attempts'), key: 'attempts', width: 90, render: (_: unknown, r: RetryQueueRecord) => `${r.attempts}/${r.maxAttempts}` },
    { title: t('w10Interop.col.endpoint'), dataIndex: 'endpoint', key: 'endpoint', width: 220 },
    { title: t('w10Interop.col.nextAttemptAt'), dataIndex: 'nextAttemptAt', key: 'nextAttemptAt', width: 170, render: (v: string) => new Date(v).toLocaleString() },
    { title: t('w10Interop.col.lastError'), dataIndex: 'lastError', key: 'lastError', ellipsis: true, render: (v?: string) => v ?? '-' },
    {
      title: t('w10Interop.col.actions'), key: 'actions', width: 200,
      render: (_: unknown, r: RetryQueueRecord) => (
        <Space size={4}>
          <Button size="small" icon={<RotateCcw size={12} />} disabled={r.status === 'success'} onClick={() => doRetry(r.id)}>{t('w10Interop.action.retry')}</Button>
          {r.status === 'dead_letter'
            ? <Button size="small" type="primary" onClick={() => doRequeue(r.id)}>{t('w10Interop.action.requeue')}</Button>
            : <Button size="small" danger onClick={() => doDeadLetter(r.id)}>{t('w10Interop.action.deadLetter')}</Button>}
        </Space>
      ),
    },
  ]

  const messagesTab = (
    <div>
      <Card size="small" className="shadow-sm" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Select allowClear placeholder={t('w10Interop.filter.interface')} value={filterIface} onChange={setFilterIface} style={{ width: 150 }}
            options={INTERFACES.map((i) => ({ value: i, label: i }))} />
          <Select allowClear placeholder={t('w10Interop.filter.status')} value={filterStatus} onChange={setFilterStatus} style={{ width: 150 }}
            options={['success', 'fail', 'retry', 'pending'].map((s) => ({ value: s, label: t(`w10Interop.status.${s}`) }))} />
          <Button type="primary" icon={<Activity size={12} />} onClick={fetchAll}>{t('w10Interop.monitor.refresh')}</Button>
          <Button icon={<Send size={12} />} onClick={enqueueTest}>{t('w10Interop.action.enqueue')}</Button>
          <Button icon={<RotateCcw size={12} />} onClick={doProcess}>{t('w10Interop.action.process')}</Button>
        </Space>
      </Card>
      <DataTable rowKey="id" loading={loading} dataSource={pageData} columns={messageColumns} emptyText={t('w10Interop.msg.empty')} scroll={{ x: 'max-content' }} pagination={pagination} />
    </div>
  )

  const queueTab = (
    <DataTable rowKey="id" loading={loading} dataSource={queuePage} columns={queueColumns} emptyText={t('w10Interop.msg.empty')} scroll={{ x: 'max-content' }} pagination={queuePagination} />
  )

  const deadTab = (
    <DataTable rowKey="id" loading={loading} dataSource={queue.filter((q) => q.status === 'dead_letter')} columns={queueColumns} emptyText={t('w10Interop.msg.noDeadLetter')} scroll={{ x: 'max-content' }} />
  )

  const byInterfaceTab = (
    <Row gutter={16}>
      {stats.byInterface.map((b) => (
        <Col xs={24} sm={12} md={8} lg={6} key={b.interfaceType} style={{ marginBottom: 12 }}>
          <Card size="small">
            <Statistic title={<Space><Tag color={IFACE_COLOR[b.interfaceType]}>{b.interfaceType}</Tag></Space>} value={b.total} />
            <Descriptions column={1} size="small" style={{ marginTop: 8 }}>
              <Descriptions.Item label={t('w10Interop.stat.success')}><Tag color="green">{b.success}</Tag></Descriptions.Item>
              <Descriptions.Item label={t('w10Interop.stat.fail')}><Tag color="red">{b.fail}</Tag></Descriptions.Item>
              <Descriptions.Item label={t('w10Interop.stat.retry')}><Tag color="orange">{b.retry}</Tag></Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      ))}
    </Row>
  )

  return (
    <div style={{ padding: 16 }}>
      <Card size="small" className="shadow-sm" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            <Radio className="w-5 h-5 text-blue-600" size={20} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{t('w10Interop.monitor.title')}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{t('w10Interop.monitor.subtitle')}</div>
            </div>
          </Space>
          <Button size="small" icon={<RefreshCw size={12} />} onClick={fetchAll} loading={loading}>{t('w10Interop.monitor.refresh')}</Button>
        </div>
      </Card>

      {loadError && <Alert type="warning" showIcon message={loadError} style={{ marginBottom: 12 }} />}

      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col span={6}><Card size="small"><Statistic title={t('w10Interop.stat.total')} value={stats.totalMessages} prefix={<Server size={14} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('w10Interop.stat.successRate')} value={stats.successRate} suffix="%" valueStyle={{ color: '#16a34a' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('w10Interop.stat.fail')} value={stats.fail} valueStyle={{ color: '#dc2626' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('w10Interop.stat.deadLetter')} value={stats.queue.deadLetter} valueStyle={{ color: '#ea580c' }} prefix={<AlertTriangle size={14} />} /></Card></Col>
      </Row>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'messages', label: t('w10Interop.tab.messages'), children: messagesTab },
          { key: 'queue', label: `${t('w10Interop.tab.queue')} (${stats.queue.total})`, children: queueTab },
          { key: 'dead-letter', label: `${t('w10Interop.tab.deadLetter')} (${stats.queue.deadLetter})`, children: deadTab },
          { key: 'by-interface', label: t('w10Interop.tab.byInterface'), children: byInterfaceTab },
        ]}
      />
    </div>
  )
}

export default InterfaceMonitorPage
