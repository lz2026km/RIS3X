// [v3.0.6.11-99 Wave 4A] 病灶追踪工作台 (Lesion Tracking)
// 患者选择 → 病灶列表 (类型/部位/状态/最近尺寸) + 新建/详情 (测量时间线/新增测量/跨期对比/随访联动) + 趋势折线 + 统计卡 + 数据源徽标
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Card, Row, Col, Select, Button, Tag, Statistic, Spin, message, Table, Modal, Form, Input,
  InputNumber, Drawer, Timeline, Space, Alert, Popconfirm, Descriptions, Typography, Empty,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DatePicker } from 'antd'
import dayjs from 'dayjs'
import {
  Plus, RefreshCw, History, GitCompareArrows, Link2, Activity, TrendingUp, Database, Trash2, Eye, Crosshair,
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { patientApi, type ListPayload } from '../../services/api/patientApi'
import {
  lesionTrackingApi,
  type TrackedLesion,
  type LesionMeasurement,
  type LesionType,
  type LesionSource,
  type ResponseClass,
  type LesionCompareResult,
  type LesionTrendResult,
  type LesionStats,
} from '../../services/api/lesionTrackingApi'
import type { PatientDto } from '../../types/dto'
import { t } from '../../i18n/appI18n'

const { Text } = Typography

const SOURCE_COLOR: Record<LesionSource, string> = {
  manual: 'blue',
  ai: 'purple',
  'from-report': 'cyan',
}

const STATUS_COLORS: Record<string, string> = {
  稳定: 'blue',
  增大: 'red',
  缩小: 'green',
  消失: 'default',
  新发: 'orange',
}

const RESPONSE_COLORS: Record<ResponseClass, string> = {
  CR: 'green',
  PR: 'cyan',
  SD: 'blue',
  PD: 'red',
  NE: 'default',
}

const TYPE_OPTIONS: LesionType[] = ['肺结节', '肝占位', '淋巴结', '其他']
const LESION_LABEL_KEYS: Record<string, string> = {
  '肺结节': 'w9dLesion.type.lungNodule', '肝占位': 'w9dLesion.type.liverLesion',
  '淋巴结': 'w9dLesion.type.lymphNode', '其他': 'w9dLesion.type.other',
  '稳定': 'w9dLesion.status.stable', '增大': 'w9dLesion.status.increase',
  '缩小': 'w9dLesion.status.decrease', '消失': 'w9dLesion.status.disappear', '新发': 'w9dLesion.status.new',
}
const lesionLabel = (k: string) => t(LESION_LABEL_KEYS[k] ?? k)

const latestSize = (lesion: TrackedLesion): number | null => {
  if (!lesion.measurements || lesion.measurements.length === 0) return null
  const sorted = [...lesion.measurements].sort((a, b) => a.date.localeCompare(b.date))
  return sorted[sorted.length - 1]!.sizeMm
}

const LesionTrackingPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const presetPatientId = searchParams.get('patientId') ?? undefined

  // ── 患者 ────────────────────────────────────────────────────────────────
  const [patients, setPatients] = useState<PatientDto[]>([])
  const [patientId, setPatientId] = useState<string>(presetPatientId ?? '')
  const [patientLoading, setPatientLoading] = useState(false)

  // ── 病灶数据 ────────────────────────────────────────────────────────────
  const [source, setSource] = useState<'database' | 'demo'>('demo')
  const [lesions, setLesions] = useState<TrackedLesion[]>([])
  const [stats, setStats] = useState<LesionStats | null>(null)
  const [loading, setLoading] = useState(false)

  // ── 新建 ────────────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm] = Form.useForm()

  // ── 详情 Drawer ─────────────────────────────────────────────────────────
  const [detail, setDetail] = useState<TrackedLesion | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [measureForm] = Form.useForm()
  const [compareA, setCompareA] = useState<string>()
  const [compareB, setCompareB] = useState<string>()
  const [compareResult, setCompareResult] = useState<LesionCompareResult | null>(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [followupId, setFollowupId] = useState('')
  const [followupLoading, setFollowupLoading] = useState(false)

  // ── 趋势 ────────────────────────────────────────────────────────────────
  const [trendLesionId, setTrendLesionId] = useState<string>()
  const [trend, setTrend] = useState<LesionTrendResult | null>(null)
  const [trendLoading, setTrendLoading] = useState(false)

  // ── 患者列表 ────────────────────────────────────────────────────────────
  const loadPatients = useCallback(async () => {
    setPatientLoading(true)
    try {
      const res = await patientApi.list({ page: 1, pageSize: 50 })
      const payload = res.data as ListPayload<PatientDto>
      const list = Array.isArray(payload) ? payload : (payload?.items ?? [])
      setPatients(list)
      if (!patientId && list.length > 0) setPatientId(list[0]!.id ?? '')
    } catch {
      setPatients([])
    } finally {
      setPatientLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    void loadPatients()
  }, [loadPatients])

  // ── 病灶列表 + 统计 ─────────────────────────────────────────────────────
  const loadData = useCallback(async (pid: string) => {
    if (!pid) {
      setLesions([])
      setStats(null)
      return
    }
    setLoading(true)
    try {
      const [listRes, statsRes] = await Promise.all([
        lesionTrackingApi.list(pid),
        lesionTrackingApi.stats(pid),
      ])
      if (listRes.success && listRes.data) {
        setLesions(listRes.data.items ?? [])
        setSource(listRes.data.source ?? 'demo')
      } else {
        setLesions([])
        setSource('demo')
      }
      if (statsRes.success && statsRes.data) setStats(statsRes.data)
      else setStats(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData(patientId)
  }, [patientId, loadData])

  const refresh = useCallback(() => {
    void loadData(patientId)
  }, [patientId, loadData])

  // ── 详情 ────────────────────────────────────────────────────────────────
  const openDetail = useCallback(async (id: string) => {
    setDetail(null)
    setDetailLoading(true)
    setCompareResult(null)
    setCompareA(undefined)
    setCompareB(undefined)
    setFollowupId('')
    try {
      const res = await lesionTrackingApi.get(id)
      if (res.success && res.data) setDetail(res.data)
      else message.error(res.error?.message ?? t('lesionTrack.detailLoadFailed'))
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const handleAddMeasurement = useCallback(async () => {
    if (!detail) return
    const values = await measureForm.validateFields()
    const date = values.date ? dayjs(values.date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
    const res = await lesionTrackingApi.addMeasurement(detail.id, {
      studyId: values.studyId ?? `STU-${Date.now()}`,
      sizeMm: values.sizeMm,
      date,
      response: values.response as ResponseClass | undefined,
      notes: values.notes,
    })
    if (res.success && res.data) {
      message.success(t('lesionTrack.measurementSaved'))
      measureForm.resetFields()
      setDetail(res.data)
      refresh()
      void loadTrend(detail.id)
    } else {
      message.error(res.error?.message ?? t('lesionTrack.addMeasurementFailed'))
    }
  }, [detail, measureForm, refresh])

  const handleCompare = useCallback(async () => {
    if (!detail || !compareA || !compareB) {
      message.warning(t('lesionTrack.selectTwo'))
      return
    }
    setCompareLoading(true)
    try {
      const res = await lesionTrackingApi.compare(detail.id, { studyIdA: compareA, studyIdB: compareB })
      if (res.success && res.data) setCompareResult(res.data)
      else message.error(res.error?.message ?? t('lesionTrack.compareFailed'))
    } finally {
      setCompareLoading(false)
    }
  }, [detail, compareA, compareB])

  const handleLinkFollowup = useCallback(async () => {
    if (!detail) return
    if (!followupId.trim()) {
      message.warning(t('lesionTrack.followupIdRequired'))
      return
    }
    setFollowupLoading(true)
    try {
      const res = await lesionTrackingApi.linkFollowup(detail.id, followupId.trim())
      if (res.success && res.data) {
        message.success(t('lesionTrack.followupLinked'))
        setDetail(res.data)
        refresh()
      } else {
        message.error(res.error?.message ?? t('lesionTrack.followupLinkFailed'))
      }
    } finally {
      setFollowupLoading(false)
    }
  }, [detail, followupId, refresh])

  const handleCreate = useCallback(async () => {
    const values = await createForm.validateFields()
    const res = await lesionTrackingApi.create({
      patientId,
      name: values.name,
      site: values.site,
      type: values.type as LesionType,
      initialSizeMm: values.initialSizeMm,
      modality: values.modality,
    })
    if (res.success && res.data) {
      message.success(t('lesionTrack.lesionRegistered'))
      setCreateOpen(false)
      createForm.resetFields()
      refresh()
    } else {
      message.error(res.error?.message ?? t('lesionTrack.registerFailed'))
    }
  }, [patientId, createForm, refresh])

  const handleDelete = useCallback(async (id: string) => {
    const res = await lesionTrackingApi.remove(id)
    if (res.success) {
      message.success(t('lesionTrack.lesionDeleted'))
      if (detail?.id === id) setDetail(null)
      if (trendLesionId === id) {
        setTrendLesionId(undefined)
        setTrend(null)
      }
      refresh()
    } else {
      message.error(res.error?.message ?? t('lesionTrack.deleteFailed'))
    }
  }, [detail, trendLesionId, refresh])

  // ── 趋势 ────────────────────────────────────────────────────────────────
  const loadTrend = useCallback(async (id: string) => {
    setTrendLoading(true)
    try {
      const res = await lesionTrackingApi.trend(id)
      if (res.success && res.data) setTrend(res.data)
      else setTrend(null)
    } finally {
      setTrendLoading(false)
    }
  }, [])

  useEffect(() => {
    if (trendLesionId) void loadTrend(trendLesionId)
    else setTrend(null)
  }, [trendLesionId, loadTrend])

  useEffect(() => {
    if (lesions.length > 0 && !trendLesionId) setTrendLesionId(lesions[0]!.id)
  }, [lesions, trendLesionId])

  const trendChartData = useMemo(
    () =>
      (trend?.timeline ?? []).map((p) => ({
        date: p.date,
        size: p.sizeMm,
      })),
    [trend],
  )

  const columns: ColumnsType<TrackedLesion> = [
    { title: t('lesionTrack.colLesion'), dataIndex: 'name', key: 'name', width: 140, render: (v: string) => (<b>{v}</b>) },
    {
      title: t('lesionTrack.colType'), dataIndex: 'type', key: 'type', width: 90,
      render: (v: LesionType) => <Tag color={v === '肺结节' ? 'geekblue' : v === '肝占位' ? 'purple' : v === '淋巴结' ? 'cyan' : 'default'}>{lesionLabel(v)}</Tag>,
    },
    { title: t('lesionTrack.colSite'), dataIndex: 'site', key: 'site', width: 150 },
    { title: t('lesionTrack.colModality'), dataIndex: 'modality', key: 'modality', width: 70 },
    {
      title: t('lesionTrack.colStatus'), dataIndex: 'currentStatus', key: 'currentStatus', width: 100,
      render: (v: string) => <Tag color={STATUS_COLORS[v]}>{lesionLabel(v)}</Tag>,
    },
    {
      title: t('lesionTrack.colLatestSize'), key: 'latest', width: 100,
      render: (_: unknown, r) => {
        const size = latestSize(r)
        return size === null ? <Text type="secondary">-</Text> : <span>{size.toFixed(1)} mm</span>
      },
    },
    { title: t('lesionTrack.colMeasureCount'), key: 'count', width: 90, render: (_: unknown, r) => `${r.measurements?.length ?? 0} ${t('lesionTrack.timesUnit')}` },
    {
      // [v3.0.6.11-100 Wave 6A (D-4)] 来源列: manual/ai/from-report (报告→病灶追踪自动建)
      title: t('lesionTrack.colSource'), key: 'source', width: 100,
      render: (_: unknown, r) => {
        const s = r.source ?? 'manual'
        return (
          <Space size={4} wrap>
            <Tag color={SOURCE_COLOR[s]} data-testid={`lt-source-${s}`}>{t(`lesionTrack.source.${s}`)}</Tag>
            {r.reportId && <span style={{ fontSize: 11, color: '#64748b' }}>{r.reportId}</span>}
          </Space>
        )
      },
    },
    {
      title: t('lesionTrack.colActions'), key: 'actions', width: 210,
      render: (_: unknown, r) => (
        <Space size={4} wrap>
          <Button size="small" icon={<Eye size={12} />} onClick={() => void openDetail(r.id)} data-testid="lt-detail">{t('lesionTrack.detailBtn')}</Button>
          <Button size="small" icon={<TrendingUp size={12} />} onClick={() => setTrendLesionId(r.id)} data-testid="lt-trend">{t('lesionTrack.trendBtn')}</Button>
          <Popconfirm title={t('lesionTrack.confirmDelete')} onConfirm={() => void handleDelete(r.id)}>
            <Button size="small" danger icon={<Trash2 size={12} />}>{t('lesionTrack.deleteBtn')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const measurementOptions = useMemo(
    () =>
      (detail?.measurements ?? []).map((m) => ({
        value: m.studyId || m.id,
        label: `${m.date} · ${m.sizeMm.toFixed(1)}mm${m.response ? ` · ${t(`lesionTrack.response.${m.response}`)}` : ''}`,
      })),
    [detail],
  )

  return (
    <div style={{ padding: 16, background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Crosshair size={22} color="#60a5fa" />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{t('lesionTrack.pageTitle')}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{t('lesionTrack.pageSubtitle')}</div>
            </div>
          </div>
        </Col>
        <Col>
          <Tag
            icon={<Database size={12} />}
            color={source === 'database' ? 'green' : 'orange'}
            data-testid="lt-source-badge"
          >
            {t('lesionTrack.dataSource')} {source === 'database' ? t('lesionTrack.sourceDatabase') : t('lesionTrack.sourceDemo')}
          </Tag>
        </Col>
      </Row>

      {/* 统计卡 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { title: t('lesionTrack.statTotal'), value: stats?.total ?? 0, color: '#3b82f6' },
          { title: t('lesionTrack.statNew'), value: stats?.new ?? 0, color: '#f97316' },
          { title: t('lesionTrack.statProgressed'), value: stats?.progressed ?? 0, color: '#ef4444' },
          { title: t('lesionTrack.statStable'), value: stats?.stable ?? 0, color: '#3b82f6' },
          { title: t('lesionTrack.statDisappeared'), value: stats?.disappeared ?? 0, color: '#64748b' },
        ].map((s) => (
          <Col key={s.title} xs={12} sm={8} md={4} lg={4}>
            <Card size="small" style={{ background: '#111c33', border: '1px solid #1e2b45', borderRadius: 10 }}>
              <Statistic title={<span style={{ fontSize: 12, color: '#94a3b8' }}>{s.title}</span>} value={s.value} valueStyle={{ color: s.color, fontSize: 26, fontWeight: 700 }} />
            </Card>
          </Col>
        ))}
        <Col xs={12} sm={8} md={4} lg={4}>
          <Card size="small" style={{ background: '#111c33', border: '1px solid #1e2b45', borderRadius: 10 }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#94a3b8' }}>{t('lesionTrack.statShrunk')}</span>}
              value={stats?.shrunk ?? 0}
              valueStyle={{ color: '#22c55e', fontSize: 26, fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 患者选择 + 新建 */}
      <Card
        size="small"
        style={{ background: '#111c33', border: '1px solid #1e2b45', borderRadius: 10, marginBottom: 16 }}
        title={<span style={{ fontSize: 14, color: '#e2e8f0' }}>{t('lesionTrack.patientSelect')}</span>}
        extra={
          <Space>
            <Button size="small" icon={<RefreshCw size={12} />} onClick={refresh} data-testid="lt-refresh">{t('lesionTrack.refresh')}</Button>
            <Button size="small" type="primary" icon={<Plus size={12} />} onClick={() => setCreateOpen(true)} data-testid="lt-create">
              {t('lesionTrack.newLesion')}
            </Button>
          </Space>
        }
      >
        <Select
          showSearch
          allowClear
          placeholder={t('lesionTrack.selectPatient')}
          loading={patientLoading}
          value={patientId || undefined}
          onChange={(v) => setPatientId(v ?? '')}
          style={{ width: 360 }}
          optionFilterProp="label"
          options={patients.map((p) => ({
            value: p.id,
            label: `${p.name} (${p.id})`,
          }))}
          data-testid="lt-patient-select"
        />
      </Card>

      {/* 病灶列表 */}
      <Card
        size="small"
        style={{ background: '#111c33', border: '1px solid #1e2b45', borderRadius: 10, marginBottom: 16 }}
        title={<span style={{ fontSize: 14, color: '#e2e8f0' }}>{t('lesionTrack.lesionList')}</span>}
      >
        <Spin spinning={loading}>
          <Table<TrackedLesion>
            rowKey="id"
            columns={columns}
            dataSource={lesions}
            pagination={false}
            locale={{ emptyText: <Empty description={t('lesionTrack.emptyLesions')} /> }}
            size="small"
            scroll={{ x: 900 }}
          />
        </Spin>
      </Card>

      {/* 趋势图 */}
      <Card
        size="small"
        style={{ background: '#111c33', border: '1px solid #1e2b45', borderRadius: 10 }}
        title={
          <Space>
            <TrendingUp size={14} color="#60a5fa" />
            <span style={{ fontSize: 14, color: '#e2e8f0' }}>{t('lesionTrack.sizeTrend')}</span>
          </Space>
        }
        extra={
          <Select
            size="small"
            placeholder={t('lesionTrack.selectLesion')}
            value={trendLesionId}
            onChange={setTrendLesionId}
            style={{ width: 260 }}
            options={lesions.map((l) => ({ value: l.id, label: `${l.name} (${l.site})` }))}
            data-testid="lt-trend-select"
          />
        }
      >
        <Spin spinning={trendLoading}>
          {trend && trend.timeline.length > 0 ? (
            <div>
              <Space size={12} wrap style={{ marginBottom: 8 }}>
                <Tag color="blue">{t('lesionTrack.baseline')} {trend.baselineSize.toFixed(1)}mm ({trend.baselineDate})</Tag>
                <Tag color="blue">{t('lesionTrack.latest')} {trend.latestSize.toFixed(1)}mm ({trend.latestDate})</Tag>
                <Tag color={trend.changePercent >= 20 ? 'red' : trend.changePercent <= -30 ? 'green' : 'blue'}>
                  {t('lesionTrack.change')} {trend.changePercent > 0 ? '+' : ''}{trend.changePercent}%
                </Tag>
                <Tag color={RESPONSE_COLORS[trend.overallResponse]}>{t('lesionTrack.overallResponse')} {t(`lesionTrack.response.${trend.overallResponse}`)}</Tag>
              </Space>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trendChartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2b45" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} unit="mm" />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #1e2b45', borderRadius: 8 }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                  <Line type="monotone" dataKey="size" name={t('w9dLesion.size')} stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty description={t('lesionTrack.emptyTrend')} style={{ padding: 40, color: '#64748b' }} />
          )}
        </Spin>
      </Card>

      {/* 新建病灶 Modal */}
      <Modal
        title={t('lesionTrack.newLesionModal')}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void handleCreate()}
        okText={t('lesionTrack.register')}
        cancelText={t('lesionTrack.cancel')}
        data-testid="lt-create-modal"
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label={t('lesionTrack.lesionName')} rules={[{ required: true, message: t('lesionTrack.lesionNameRequired') }]}>
            <Input placeholder={t('lesionTrack.lesionNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="site" label={t('lesionTrack.colSite')} rules={[{ required: true, message: t('lesionTrack.siteRequired') }]}>
            <Input placeholder={t('lesionTrack.sitePlaceholder')} />
          </Form.Item>
          <Form.Item name="type" label={t('lesionTrack.colType')} initialValue="肺结节">
            <Select options={TYPE_OPTIONS.map((v) => ({ value: v, label: lesionLabel(v) }))} />
          </Form.Item>
          <Form.Item name="initialSizeMm" label={t('lesionTrack.initialSize')} rules={[{ required: true, message: t('lesionTrack.initialSizeRequired') }]}>
            <InputNumber min={0} step={0.1} style={{ width: '100%' }} placeholder={t('lesionTrack.initialSizePlaceholder')} />
          </Form.Item>
          <Form.Item name="modality" label={t('lesionTrack.colModality')} initialValue="CT">
            <Select options={[{ value: 'CT', label: 'CT' }, { value: 'MR', label: 'MR' }, { value: 'PET-CT', label: 'PET-CT' }, { value: 'US', label: 'US' }]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title={detail ? <Space><Activity size={16} color="#60a5fa" />{detail.name}</Space> : t('lesionTrack.lesionDetail')}
        open={!!detail}
        onClose={() => setDetail(null)}
        width={560}
        data-testid="lt-detail-drawer"
      >
        <Spin spinning={detailLoading}>
          {detail && (
            <div>
              <Descriptions
                column={2}
                size="small"
                items={[
                  { key: 'site', label: t('lesionTrack.colSite'), children: detail.site },
                  { key: 'type', label: t('lesionTrack.colType'), children: <Tag color="purple">{detail.type}</Tag> },
                  { key: 'modality', label: t('lesionTrack.colModality'), children: detail.modality },
                  { key: 'status', label: t('lesionTrack.colStatus'), children: <Tag color={STATUS_COLORS[detail.currentStatus]}>{detail.currentStatus}</Tag> },
                  { key: 'createdAt', label: t('lesionTrack.registeredAt'), children: detail.createdAt },
                  { key: 'followupId', label: t('lesionTrack.followupPlan'), children: detail.followupId ? <Tag color="cyan">{detail.followupId}</Tag> : <Text type="secondary">{t('lesionTrack.notLinked')}</Text> },
                ]}
              />

              {/* 测量时间线 */}
              <div style={{ marginTop: 16, marginBottom: 8 }}>
                <b style={{ color: '#e2e8f0' }}>{t('lesionTrack.measurementSeries')}</b>
              </div>
              <Timeline
                items={(detail.measurements ?? []).map((m: LesionMeasurement) => ({
                  color: m.response ? RESPONSE_COLORS[m.response] : 'blue',
                  children: (
                    <div>
                      <div style={{ color: '#e2e8f0' }}>{m.date} · <b>{m.sizeMm.toFixed(1)}mm</b> <Text type="secondary">({m.studyId || '-'})</Text></div>
                      {m.response && <Tag color={RESPONSE_COLORS[m.response]} style={{ marginTop: 4 }}>{t(`lesionTrack.response.${m.response}`)}</Tag>}
                      {m.notes && <div style={{ fontSize: 12, color: '#94a3b8' }}>{m.notes}</div>}
                    </div>
                  ),
                }))}
              />

              {/* 新增测量 */}
              <Card size="small" title={t('lesionTrack.addMeasurement')} style={{ background: '#0b1626', border: '1px solid #1e2b45', marginBottom: 12 }}>
                <Form form={measureForm} layout="vertical" size="small">
                  <Row gutter={8}>
                    <Col span={8}>
                      <Form.Item name="date" label={t('lesionTrack.dateLabel')} rules={[{ required: true, message: t('lesionTrack.dateRequired') }]}>
                        <DatePicker style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="sizeMm" label={t('lesionTrack.sizeMm')} rules={[{ required: true, message: t('lesionTrack.sizeRequired') }]}>
                        <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="response" label={t('lesionTrack.responseClass')}>
                        <Select
                          allowClear
                          placeholder="CR/PR/SD/PD"
                          options={(['CR', 'PR', 'SD', 'PD', 'NE'] as ResponseClass[]).map((r) => ({ value: r, label: `${r} ${t(`lesionTrack.response.${r}`)}` }))}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={8}>
                    <Col span={16}>
                      <Form.Item name="studyId" label={t('lesionTrack.studyId')}>
                        <Input placeholder={t('w9dLesion.studyPlaceholder', { id: Date.now() })} />
                      </Form.Item>
                    </Col>
                    <Col span={8} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 24 }}>
                      <Button type="primary" size="small" icon={<History size={12} />} onClick={() => void handleAddMeasurement()} data-testid="lt-add-measurement">
                        {t('lesionTrack.recordMeasurement')}
                      </Button>
                    </Col>
                  </Row>
                </Form>
              </Card>

              {/* 跨期对比 */}
              <Card size="small" title={t('lesionTrack.compareCard')} style={{ background: '#0b1626', border: '1px solid #1e2b45', marginBottom: 12 }}>
                <Row gutter={8} align="middle">
                  <Col span={9}>
                    <Select
                      size="small"
                      placeholder={t('lesionTrack.measureA')}
                      value={compareA}
                      onChange={setCompareA}
                      style={{ width: '100%' }}
                      options={measurementOptions}
                    />
                  </Col>
                  <Col span={9}>
                    <Select
                      size="small"
                      placeholder={t('lesionTrack.measureB')}
                      value={compareB}
                      onChange={setCompareB}
                      style={{ width: '100%' }}
                      options={measurementOptions}
                    />
                  </Col>
                  <Col span={6}>
                    <Button
                      size="small"
                      icon={<GitCompareArrows size={12} />}
                      loading={compareLoading}
                      onClick={() => void handleCompare()}
                      data-testid="lt-compare"
                    >
                      {t('lesionTrack.compareBtn')}
                    </Button>
                  </Col>
                </Row>
                {compareResult && (
                  <div style={{ marginTop: 12, padding: 12, background: '#111c33', border: '1px solid #1e2b45', borderRadius: 8 }} data-testid="lt-compare-result">
                    <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 6 }}>
                      {compareResult.sizeA.toFixed(1)}mm → {compareResult.sizeB.toFixed(1)}mm
                      <b style={{ color: compareResult.changeMm > 0 ? '#ef4444' : compareResult.changeMm < 0 ? '#22c55e' : '#94a3b8', marginLeft: 8 }}>
                        {compareResult.changeMm > 0 ? '+' : ''}{compareResult.changeMm}mm ({compareResult.changePercent > 0 ? '+' : ''}{compareResult.changePercent}%)
                      </b>
                    </div>
                    <Space size={8} wrap>
                      <Tag color={compareResult.direction === '增大' ? 'red' : compareResult.direction === '缩小' ? 'green' : compareResult.direction === '消失' ? 'default' : 'blue'}>
                        {t('lesionTrack.directionLabel')} {lesionLabel(compareResult.direction)}
                      </Tag>
                      <Tag color={RESPONSE_COLORS[compareResult.response]}>
                        {t('lesionTrack.responseLabel')} {compareResult.response} {t(`lesionTrack.response.${compareResult.response}`)}
                      </Tag>
                      {compareResult.deterministic && <Text type="secondary" style={{ fontSize: 11 }}>{t('lesionTrack.deterministic')}</Text>}
                    </Space>
                  </div>
                )}
              </Card>

              {/* 随访联动 */}
              <Card size="small" title={t('lesionTrack.followupCard')} style={{ background: '#0b1626', border: '1px solid #1e2b45' }}>
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    placeholder={t('lesionTrack.followupInputPlaceholder')}
                    value={followupId}
                    onChange={(e) => setFollowupId(e.target.value)}
                    prefix={<Link2 size={12} />}
                  />
                  <Button
                    type="primary"
                    loading={followupLoading}
                    onClick={() => void handleLinkFollowup()}
                    data-testid="lt-link-followup"
                  >
                    {t('lesionTrack.linkBtn')}
                  </Button>
                </Space.Compact>
                <Alert
                  style={{ marginTop: 8, background: '#0b1626', border: '1px solid #1e2b45' }}
                  type="info"
                  showIcon
                  message={t('lesionTrack.followupAlert')}
                />
              </Card>
            </div>
          )}
        </Spin>
      </Drawer>
    </div>
  )
}

export default LesionTrackingPage
