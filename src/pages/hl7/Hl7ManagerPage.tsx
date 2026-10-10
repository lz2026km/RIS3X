import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Card,
  Tabs,
  Button,
  Space,
  Tag,
  Form,
  Input,
  Select,
  message,
  Alert,
  Row,
  Col,
  InputNumber,
} from "antd";
import { Archive, Send, RefreshCw, Play, Download, Activity, AlertTriangle, PieChart as PieIcon, TrendingUp } from 'lucide-react'
import { hl7Api, type Hl7Report, type Hl7OrmOrder, type Hl7DftTransaction, type Hl7ArchiveRecord } from '../../services/api/integrationApi'
import Hl7AnalyticsSection from './Hl7AnalyticsSection'
import { t } from '../../i18n/appI18n'
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { ChartContainer, chartDefaults } from '../../components/charts'
import { DataTable, PageContainer } from "../../components/common"

// ============================================================
// [G005 v3.0.6.11-99 Wave 10E-1] HL7 监控面板
//   M1. 消息类型分布图
//   M2. 通道健康卡 (最近 24h 成功/失败/积压)
//   M3. 消息量趋势 (近 7 日)
//   M4. 错误 TOP 消息列表
// 数据源: hl7Api.getArchive + getMllpStatus 真实接口, 失败回退派生
// ============================================================
const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#14b8a6', '#ec4899', '#22c55e']

function MonitorPanel({ archive, loading }: { archive: Hl7ArchiveRecord[]; loading: boolean }) {
  const [mllp, setMllp] = useState<{ running: boolean; port: number; tlsEnabled: boolean; totalMessages: number; uptimeMs: number } | null>(null)
  const [mllpReal, setMllpReal] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await hl7Api.getMllpStatus()
        if (!cancelled && res.success && res.data) {
          setMllp(res.data)
          setMllpReal(true)
          return
        }
      } catch { /* 回退演示 */ }
      if (!cancelled) {
        setMllpReal(false)
        setMllp({ running: true, port: 2575, tlsEnabled: true, totalMessages: 1842, uptimeMs: 86400000 * 12.4 })
      }
    })()
    return () => { cancelled = true }
  }, [refreshKey])

  // M1. 消息类型分布
  const typeDist = useMemo(() => {
    const map: Record<string, number> = {}
    archive.forEach(r => { map[r.messageType] = (map[r.messageType] || 0) + 1 })
    const list = Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
    if (list.length === 0) {
      return [
        { name: 'ORU^R01', count: 32 }, { name: 'ORM^O01', count: 21 },
        { name: 'DFT^P03', count: 14 }, { name: 'ACK', count: 27 }, { name: 'SIU^S12', count: 6 },
      ]
    }
    return list
  }, [archive])

  // M2. 通道健康 (最近 24h)
  const health24h = useMemo(() => {
    const cutoff = Date.now() - 86400000
    const recent = archive.filter(r => new Date(r.createdAt).getTime() >= cutoff)
    const src = recent.length > 0 ? recent : archive
    const success = src.filter(r => r.ackStatus === 'SUCCESS').length
    const failed = src.filter(r => r.ackStatus === 'FAILED').length
    const pending = src.filter(r => r.ackStatus === 'PENDING').length
    const outbound = src.filter(r => r.direction === 'OUTBOUND').length
    const inbound = src.filter(r => r.direction === 'INBOUND').length
    const real = src.length > 0
    return { success, failed, pending, outbound, inbound, total: src.length, real }
  }, [archive])

  // M3. 消息量趋势 (近 7 日)
  const trend7d = useMemo(() => {
    const days: Array<{ day: string; count: number; failed: number }> = []
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 86400000)
      days.push({ day: `${d.getMonth() + 1}/${d.getDate()}`, count: 0, failed: 0 })
    }
    archive.forEach(r => {
      const idx = days.findIndex(d => {
        const rd = new Date(r.createdAt)
        return rd.getMonth() === new Date(Date.now() - (6 - 0) * 0 * 86400000).getMonth() && rd.getDate() === Number(d.day.split('/')[1]) && rd.getMonth() === Number(d.day.split('/')[0]) - 1
      })
      if (idx < 0) return
      const slot = days[idx]
      if (!slot) return
      slot.count += 1
      if (r.ackStatus === 'FAILED') slot.failed += 1
    })
    if (days.every(d => d.count === 0)) {
      return [
        { day: '8/9', count: 18, failed: 1 }, { day: '8/10', count: 24, failed: 2 },
        { day: '8/11', count: 21, failed: 1 }, { day: '8/12', count: 27, failed: 3 },
        { day: '8/13', count: 22, failed: 0 }, { day: '8/14', count: 31, failed: 2 },
        { day: '8/15', count: 12, failed: 0 },
      ]
    }
    return days
  }, [archive])

  // M4. 错误 TOP 消息
  const errorTop = useMemo(() => {
    const src = archive.filter(r => r.ackStatus !== 'SUCCESS')
    const map = new Map<string, { messageType: string; count: number; retrySum: number; latest: string; samples: string[] }>()
    src.forEach(r => {
      const item = map.get(r.messageType) ?? { messageType: r.messageType, count: 0, retrySum: 0, latest: r.createdAt, samples: [] }
      item.count += 1
      item.retrySum += r.retryCount ?? 0
      if (!item.latest || r.createdAt > item.latest) item.latest = r.createdAt
      if (item.samples.length < 3) item.samples.push(r.controlId || r.rawMessage?.slice(0, 48) || '')
      map.set(r.messageType, item)
    })
    const list = Array.from(map.values()).sort((a, b) => b.count - a.count)
    if (list.length === 0) {
      return [
        { messageType: 'ORU^R01', count: 4, retrySum: 9, latest: new Date().toISOString(), samples: ['CTRL-ERR-001', 'CTRL-ERR-002', 'CTRL-ERR-003'] },
        { messageType: 'ORM^O01', count: 2, retrySum: 5, latest: new Date().toISOString(), samples: ['CTRL-ERR-007'] },
        { messageType: 'DFT^P03', count: 1, retrySum: 2, latest: new Date().toISOString(), samples: ['CTRL-ERR-011'] },
      ]
    }
    return list.slice(0, 8)
  }, [archive])

  const errorTotal = errorTop.reduce((s, e) => s + e.count, 0)
  const successRate = health24h.total > 0 ? Math.round((health24h.success / health24h.total) * 100) : 100
  const healthOk = successRate >= 95 && health24h.failed <= 3

  return (
    <div data-testid="hl7-monitor-panel">
      {/* 数据源徽标 */}
      <div style={{
        marginBottom: 16, padding: '8px 14px', borderRadius: 8, fontSize: 12,
        display: 'flex', alignItems: 'center', gap: 8,
        background: (mllpReal || health24h.real) ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
        border: `1px solid ${(mllpReal || health24h.real) ? '#bbf7d0' : '#fde68a'}`,
        color: (mllpReal || health24h.real) ? '#15803d' : '#92400e',
      }} data-testid="hl7-monitor-source">
        {(mllpReal || health24h.real)
          ? t('hl7Page.dataSourceReal')
          : t('hl7Page.dataSourceFallback')}
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => setRefreshKey(k => k + 1)} style={{ marginLeft: 'auto' }}>{t('hl7Page.refresh')}</Button>
      </div>

      {/* M2. 通道健康卡 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card size="small" title={<Space><Activity size={14} />{t('hl7Page.mllpChannel')}</Space>}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: mllp?.running ? '#16a34a' : '#dc2626' }}>
                {mllp?.running ? t('hl7Page.running') : t('hl7Page.stopped')}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                {mllp ? `端口 ${mllp.port}${mllp.tlsEnabled ? ' (TLS)' : ''}` : t('hl7Page.unknown')} · {t('hl7Page.totalMessages')} {mllp?.totalMessages ?? '-'}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                {t('hl7Page.uptime')} {(mllp?.uptimeMs ?? 0) / 3600000 > 24 ? `${((mllp?.uptimeMs ?? 0) / 86400000).toFixed(1)} ${t('hl7Page.day')}` : `${Math.round((mllp?.uptimeMs ?? 0) / 3600000)} ${t('hl7Page.hour')}`}
              </div>
            </div>
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small" title={<Space><TrendingUp size={14} />{t('hl7Page.successRate24h')}</Space>}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: successRate >= 95 ? '#16a34a' : '#d97706' }}>{successRate}%</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                {t('hl7Page.success')} <b style={{ color: '#16a34a' }}>{health24h.success}</b> · {t('hl7Page.failed')} <b style={{ color: '#dc2626' }}>{health24h.failed}</b> · {t('hl7Page.pending')} <b style={{ color: '#d97706' }}>{health24h.pending}</b>
              </div>
            </div>
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small" title={<Space><Send size={14} />{t('hl7Page.flow24h')}</Space>}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#2563eb' }}>{health24h.total}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                {t('hl7Page.outbound')} <b style={{ color: '#2563eb' }}>{health24h.outbound}</b> · {t('hl7Page.inbound')} <b style={{ color: '#d97706' }}>{health24h.inbound}</b>
              </div>
            </div>
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small" title={<Space><AlertTriangle size={14} />{t('hl7Page.errorMessages')}</Space>}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: errorTotal > 0 ? '#dc2626' : '#16a34a' }}>{errorTotal}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                {t('hl7Page.retryTotal')} <b style={{ color: '#d97706' }}>{errorTop.reduce((s, e) => s + e.retrySum, 0)}</b> {t('hl7Page.times')} · {t('hl7Page.typesUnit')} {errorTop.length} {t('hl7Page.classUnit')}
              </div>
            </div>
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small" title={<Space><Activity size={14} />{t('hl7Page.healthStatus')}</Space>}>
            <div style={{ textAlign: 'center', paddingTop: 8 }}>
              <div style={{
                display: 'inline-block', padding: '10px 18px', borderRadius: 999, fontSize: 14, fontWeight: 800,
                background: healthOk ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
                color: healthOk ? '#15803d' : '#b91c1c',
              }}>
                {healthOk ? t('hl7Page.healthy') : t('hl7Page.attention')}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>{t('hl7Page.threshold')}</div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {/* M1. 消息类型分布 */}
        <Col span={10}>
          <Card size="small" title={<Space><PieIcon size={14} />{t('hl7Page.typeDistribution')}</Space>} extra={<Tag color="blue">{typeDist.length} {t('hl7Page.classUnit')}</Tag>}>
            <ChartContainer type="pie" height={240}>
              <PieChart>
                <Pie data={typeDist} dataKey="count" nameKey="name" cx="50%" cy="45%" outerRadius={72} labelLine={false}>
                  {typeDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip {...chartDefaults.tooltip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ChartContainer>
          </Card>
        </Col>

        {/* M3. 消息量趋势 */}
        <Col span={14}>
          <Card size="small" title={<Space><TrendingUp size={14} />{t('hl7Page.volumeTrend')}</Space>} extra={<Tag color="green">{t('hl7Page.total')} {trend7d.reduce((s, d) => s + d.count, 0)}</Tag>}>
            <ChartContainer type="bar" height={240}>
              <BarChart data={trend7d} margin={chartDefaults.margin}>
                <CartesianGrid {...chartDefaults.grid} />
                <XAxis dataKey="day" {...chartDefaults.axis} />
                <YAxis {...chartDefaults.axis} />
                <Tooltip {...chartDefaults.tooltip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" name={t('hl7Page.volume')} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failed" name={t('hl7Page.failShort')} fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </Card>
        </Col>
      </Row>

      {/* M4. 错误 TOP 消息列表 */}
      <Card size="small" title={<Space><AlertTriangle size={14} />{t('hl7Page.errorTop')}</Space>} style={{ marginTop: 16 }}>
        <DataTable
          dataSource={errorTop}
          rowKey="messageType"
          loading={loading}
          pagination={false}
          columns={[
            {
              title: t('hl7Page.colMessageType'), dataIndex: 'messageType', key: 'messageType',
              render: (mt: string) => <Tag color="red">{mt}</Tag>,
            },
            {
              title: t('hl7Page.colFailCount'), dataIndex: 'count', key: 'count', width: 90,
              render: (v: number) => <b style={{ color: '#dc2626' }}>{v}</b>,
            },
            { title: t('hl7Page.colRetryTotal'), dataIndex: 'retrySum', key: 'retrySum', width: 90 },
            {
              title: t('hl7Page.colRatio'), key: 'pct', width: 200,
              render: (_: unknown, r: any) => {
                const pct = Math.round((r.count / Math.max(1, errorTotal)) * 100)
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: pct > 40 ? '#dc2626' : '#d97706', borderRadius: 999 }} />
                    </div>
                    <span style={{ fontSize: 12, width: 34, textAlign: 'right' }}>{pct}%</span>
                  </div>
                )
              },
            },
            { title: t('hl7Page.colLatest'), dataIndex: 'latest', key: 'latest', width: 170, render: (mt: string) => new Date(mt).toLocaleString() },
            {
              title: t('hl7Page.colSamples'), key: 'samples', render: (_: unknown, r: any) => (
                <Space size={4} wrap>
                  {(r.samples || []).map((s: string, i: number) => <Tag key={i} style={{ fontSize: 11 }}>{s}</Tag>)}
                </Space>
              ),
            },
          ]}
        />
        <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
          {errorTop.length === 0 ? t('hl7Page.noFailure') : `共 ${errorTotal} 条失败消息, 建议检查目标系统 ACK 配置与消息格式 (MSH-11 加工位)`}
        </div>
      </Card>
    </div>
  )
}

export const Hl7ManagerPage: React.FC = () => {
  const [tab, setTab] = useState('oru')
  const [archive, setArchive] = useState<Hl7ArchiveRecord[]>([])
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [oruForm] = Form.useForm()
  const [ormForm] = Form.useForm()
  const [dftForm] = Form.useForm()
  const [sending, setSending] = useState(false)
  // [W2-C] 受控分页
  const [archivePage, setArchivePage] = useState(1)
  // [G005 2B] getArchive 失败回退硬编码 2 条 → 回退态徽标
  const [archiveFallback, setArchiveFallback] = useState(false)

  const fetchArchive = useCallback(async () => {
    setArchiveLoading(true)
    try {
      const res = await hl7Api.getArchive()
      if (res.success && res.data) {
        setArchive(Array.isArray(res.data) ? res.data : [])
        setArchiveFallback(false)
      }
    } catch {
      setArchiveFallback(true)
      setArchive([
        { id: 1, messageType: 'ORU^R01', controlId: 'CTRL-001', direction: 'OUTBOUND', ackStatus: 'SUCCESS', retryCount: 0, rawMessage: 'MSH|^~\\&|G005|HIS|PACS|PACS|...', createdAt: new Date().toISOString() },
        { id: 2, messageType: 'ORM^O01', controlId: 'CTRL-002', direction: 'INBOUND', ackStatus: 'SUCCESS', retryCount: 0, rawMessage: 'MSH|^~\\&|HIS|HIS|G005|G005|...', createdAt: new Date().toISOString() },
      ])
    }
    setArchiveLoading(false)
  }, [])

  useEffect(() => { fetchArchive() }, [fetchArchive])

  const handleSendOru = async () => {
    try {
      const values = await oruForm.validateFields()
      setSending(true)
      const data: Hl7Report = {
        accessionNumber: values.accessionNumber,
        patientName: values.patientName,
        patientId: values.patientId,
        patientSex: values.patientSex || 'O',
        modality: values.modality,
        studyDate: values.studyDate,
        studyTime: values.studyTime || '',
        findings: values.findings,
        conclusion: values.conclusion,
        authorName: values.authorName,
        authorId: values.authorId,
        reportId: values.reportId,
      }
      const res = await hl7Api.buildOru(data)
      if (res.success) {
        message.success(`ORU 报告发送成功: ${res.data?.controlId || ''}`)
        fetchArchive()
      } else {
        message.error(t('hl7Page.sendOruFailed'))
      }
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(t('hl7Page.operationFailed'))
    } finally {
      setSending(false)
    }
  }

  const handleSendOrm = async () => {
    try {
      const values = await ormForm.validateFields()
      setSending(true)
      const data: Hl7OrmOrder = {
        patientId: values.patientId,
        patientName: values.patientName,
        patientSex: values.patientSex || 'O',
        accessionNumber: values.accessionNumber,
        modality: values.modality,
        bodyPart: values.bodyPart,
        orderNumber: values.orderNumber,
        orderingDoctor: values.orderingDoctor,
      }
      const res = await hl7Api.buildOrm(data)
      if (res.success) {
        message.success(`ORM 医嘱发送成功: ${res.data?.controlId || ''}`)
        fetchArchive()
      } else {
        message.error(t('hl7Page.sendOrmFailed'))
      }
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(t('hl7Page.operationFailed'))
    } finally {
      setSending(false)
    }
  }

  const handleSendDft = async () => {
    try {
      const values = await dftForm.validateFields()
      setSending(true)
      const data: Hl7DftTransaction = {
        patientId: values.patientId,
        patientName: values.patientName,
        invoiceNumber: values.invoiceNumber,
        totalAmount: String(values.totalAmount),
        chargeCode: values.chargeCode,
        chargeName: values.chargeName,
      }
      const res = await hl7Api.buildDft(data)
      if (res.success) {
        message.success(`DFT 财务交易发送成功: ${res.data?.controlId || ''}`)
        fetchArchive()
      } else {
        message.error(t('hl7Page.sendDftFailed'))
      }
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(t('hl7Page.operationFailed'))
    } finally {
      setSending(false)
    }
  }

  const archiveColumns = [
    { title: t('hl7Page.colNo'), dataIndex: 'id', key: 'id', width: 60 },
    {
      title: t('hl7Page.colMessageType'),
      dataIndex: 'messageType',
      key: 'messageType',
      render: (mt: string) => <Tag color="blue">{mt}</Tag>,
    },
    {
      title: t('hl7Page.colDirection'),
      dataIndex: 'direction',
      key: 'direction',
      render: (d: string) => {
        const map: Record<string, { color: string; label: string }> = { OUTBOUND: { color: 'green', label: t('hl7Page.dirOutbound') }, INBOUND: { color: 'orange', label: t('hl7Page.dirInbound') }, ACK: { color: 'purple', label: t('hl7Page.dirAck') } }
        const item = map[d] || { color: 'default', label: d }
        return <Tag color={item.color}>{item.label}</Tag>
      },
    },
    {
      title: t('hl7Page.colAckStatus'),
      dataIndex: 'ackStatus',
      key: 'ackStatus',
      render: (s: string) => {
        const map: Record<string, string> = { SUCCESS: 'green', FAILED: 'red', PENDING: 'orange' }
        return <Tag color={map[s] || 'default'}>{s}</Tag>
      },
    },
    { title: t('hl7Page.colControlId'), dataIndex: 'controlId', key: 'controlId', ellipsis: true },
    { title: t('hl7Page.colRetry'), dataIndex: 'retryCount', key: 'retryCount', width: 60 },
    { title: t('hl7Page.colTime'), dataIndex: 'createdAt', key: 'createdAt', render: (mt: string) => new Date(mt).toLocaleString() },
  ]

  const tabItems = [
    {
      key: 'monitor',
      label: <Space><Activity size={14} />{t('hl7Page.tabMonitor')}</Space>,
      children: <MonitorPanel archive={archive} loading={archiveLoading} />,
    },
    {
      key: 'analytics',
      label: <Space><TrendingUp size={14} />{t('hl7Page.tabAnalytics')}</Space>,
      children: <Hl7AnalyticsSection />,
    },
    {
      key: 'oru',
      label: <Space><Send size={14} />{t('hl7Page.tabOru')}</Space>,
      children: (
        <Card size="small" title={t('hl7Page.oruTitle')}>
          <Form form={oruForm} layout="vertical" size="small">
            <Row gutter={16}>
              <Col span={8}><Form.Item name="accessionNumber" label={t('hl7Page.examId')} rules={[{ required: true }]}><Input placeholder={t('hl7Page.examIdPlaceholder')} /></Form.Item></Col>
              <Col span={8}><Form.Item name="patientId" label={t('hl7Page.patientId')} rules={[{ required: true }]}><Input placeholder={t('hl7Page.patientIdPlaceholder')} /></Form.Item></Col>
              <Col span={8}><Form.Item name="patientName" label={t('hl7Page.patientName')} rules={[{ required: true }]}><Input placeholder={t('hl7Page.patientNamePlaceholder')} /></Form.Item></Col>
              <Col span={8}><Form.Item name="modality" label={t('hl7Page.modality')} rules={[{ required: true }]}><Select placeholder={t('hl7Page.select')}><Select.Option value="CT">CT</Select.Option><Select.Option value="MR">MR</Select.Option><Select.Option value="US">US</Select.Option><Select.Option value="XA">XA</Select.Option></Select></Form.Item></Col>
              <Col span={8}><Form.Item name="patientSex" label={t('hl7Page.sex')}><Select placeholder={t('hl7Page.select')} allowClear><Select.Option value="M">M</Select.Option><Select.Option value="F">F</Select.Option><Select.Option value="O">O</Select.Option></Select></Form.Item></Col>
              <Col span={8}><Form.Item name="studyDate" label={t('hl7Page.examDate')}><Input placeholder="YYYY-MM-DD" /></Form.Item></Col>
              <Col span={12}><Form.Item name="findings" label={t('hl7Page.findings')} rules={[{ required: true }]}><Input.TextArea rows={3} placeholder={t('hl7Page.findingsPlaceholder')} /></Form.Item></Col>
              <Col span={12}><Form.Item name="conclusion" label={t('hl7Page.conclusion')} rules={[{ required: true }]}><Input.TextArea rows={3} placeholder={t('hl7Page.conclusionPlaceholder')} /></Form.Item></Col>
              <Col span={8}><Form.Item name="authorName" label={t('hl7Page.doctor')}><Input placeholder={t('hl7Page.doctorPlaceholder')} /></Form.Item></Col>
              <Col span={8}><Form.Item name="authorId" label={t('hl7Page.doctorId')}><Input placeholder={t('hl7Page.doctorIdPlaceholder')} /></Form.Item></Col>
              <Col span={8}><Form.Item name="reportId" label={t('hl7Page.reportId')}><Input placeholder={t('hl7Page.reportIdPlaceholder')} /></Form.Item></Col>
            </Row>
            <Form.Item>
              <Button type="primary" icon={<Send size={14} />} loading={sending} onClick={handleSendOru}>{t('hl7Page.sendOru')}</Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'orm',
      label: <Space><Play size={14} />{t('hl7Page.tabOrm')}</Space>,
      children: (
        <Card size="small" title={t('hl7Page.ormTitle')}>
          <Form form={ormForm} layout="vertical" size="small">
            <Row gutter={16}>
              <Col span={8}><Form.Item name="patientId" label={t('hl7Page.patientId')} rules={[{ required: true }]}><Input placeholder={t('hl7Page.patientIdPlaceholder')} /></Form.Item></Col>
              <Col span={8}><Form.Item name="patientName" label={t('hl7Page.patientName')} rules={[{ required: true }]}><Input placeholder={t('hl7Page.patientNamePlaceholder')} /></Form.Item></Col>
              <Col span={8}><Form.Item name="accessionNumber" label={t('hl7Page.examId')} rules={[{ required: true }]}><Input placeholder={t('hl7Page.examIdPlaceholder')} /></Form.Item></Col>
              <Col span={8}><Form.Item name="modality" label={t('hl7Page.modality')} rules={[{ required: true }]}><Select placeholder={t('hl7Page.select')}><Select.Option value="CT">CT</Select.Option><Select.Option value="MR">MR</Select.Option><Select.Option value="US">US</Select.Option></Select></Form.Item></Col>
              <Col span={8}><Form.Item name="bodyPart" label={t('hl7Page.bodyPart')} rules={[{ required: true }]}><Input placeholder={t('hl7Page.bodyPartPlaceholder')} /></Form.Item></Col>
              <Col span={8}><Form.Item name="orderNumber" label={t('hl7Page.orderNumber')} rules={[{ required: true }]}><Input placeholder={t('hl7Page.orderNumberPlaceholder')} /></Form.Item></Col>
              <Col span={8}><Form.Item name="orderingDoctor" label={t('hl7Page.orderingDoctor')} rules={[{ required: true }]}><Input placeholder={t('hl7Page.orderingDoctorPlaceholder')} /></Form.Item></Col>
              <Col span={8}><Form.Item name="patientSex" label={t('hl7Page.sex')}><Select placeholder={t('hl7Page.select')} allowClear><Select.Option value="M">M</Select.Option><Select.Option value="F">F</Select.Option></Select></Form.Item></Col>
            </Row>
            <Form.Item>
              <Button type="primary" icon={<Send size={14} />} loading={sending} onClick={handleSendOrm}>{t('hl7Page.sendOrm')}</Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'dft',
      label: <Space><Download size={14} />{t('hl7Page.tabDft')}</Space>,
      children: (
        <Card size="small" title={t('hl7Page.dftTitle')}>
          <Form form={dftForm} layout="vertical" size="small">
            <Row gutter={16}>
              <Col span={8}><Form.Item name="patientId" label={t('hl7Page.patientId')} rules={[{ required: true }]}><Input placeholder={t('hl7Page.patientIdPlaceholder')} /></Form.Item></Col>
              <Col span={8}><Form.Item name="patientName" label={t('hl7Page.patientName')} rules={[{ required: true }]}><Input placeholder={t('hl7Page.patientNamePlaceholder')} /></Form.Item></Col>
              <Col span={8}><Form.Item name="invoiceNumber" label={t('hl7Page.invoiceNumber')} rules={[{ required: true }]}><Input placeholder={t('hl7Page.invoiceNumberPlaceholder')} /></Form.Item></Col>
              <Col span={8}><Form.Item name="totalAmount" label={t('hl7Page.totalAmount')} rules={[{ required: true }]}><InputNumber placeholder={t('hl7Page.amountPlaceholder')} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={8}><Form.Item name="chargeCode" label={t('hl7Page.chargeCode')} rules={[{ required: true }]}><Input placeholder={t('hl7Page.chargeCodePlaceholder')} /></Form.Item></Col>
              <Col span={8}><Form.Item name="chargeName" label={t('hl7Page.chargeName')} rules={[{ required: true }]}><Input placeholder={t('hl7Page.chargeNamePlaceholder')} /></Form.Item></Col>
            </Row>
            <Form.Item>
              <Button type="primary" icon={<Send size={14} />} loading={sending} onClick={handleSendDft}>{t('hl7Page.sendDft')}</Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'archive',
      label: <Space><Archive size={14} />{t('hl7Page.tabArchive')}</Space>,
      children: (
        <Card size="small" title={<Space><Archive size={14} />{t('hl7Page.archiveTitle')}{archiveFallback && <Tag color="orange" style={{ fontSize: 10 }}>{t('hl7Page.fallbackTag')}</Tag>}</Space>} extra={<Button icon={<RefreshCw size={14} />} onClick={fetchArchive}>{t('hl7Page.refresh')}</Button>}>
          <DataTable
            dataSource={archive}
            columns={archiveColumns}
            rowKey="id"
            loading={archiveLoading}
            pagination={{ current: archivePage, pageSize: 10, total: archive.length, onChange: setArchivePage, showSizeChanger: false, showTotal: (t) => `共 ${t} 条` }}
          scroll={{ x: 'max-content' }}
          />
        </Card>
      ),
    },
  ]

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 16 }}>
        <Archive size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('hl7Page.archiveHeader')}</span>
        <Tag color="blue">v2.x</Tag>
        <Tag color="green">ORU / ORM / DFT</Tag>
      </Space>
      <Alert title={t('hl7Page.archiveDesc')} type="info" showIcon style={{ marginBottom: 16 }} />
      <Tabs activeKey={tab} onChange={setTab} items={tabItems} />
    </PageContainer>
  )
}

export default Hl7ManagerPage
