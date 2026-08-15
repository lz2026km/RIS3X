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

const { Text } = Typography

// [v3.0.6.11-100 Wave 6A (D-4)] 病灶来源展示
const SOURCE_LABEL: Record<LesionSource, string> = {
  manual: '手动登记',
  ai: 'AI 检出',
  'from-report': '报告提取',
}

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

const RESPONSE_LABEL: Record<ResponseClass, string> = {
  CR: '完全缓解',
  PR: '部分缓解',
  SD: '疾病稳定',
  PD: '疾病进展',
  NE: '不可评估',
}

const TYPE_OPTIONS: Array<{ value: LesionType; label: string }> = [
  { value: '肺结节', label: '肺结节' },
  { value: '肝占位', label: '肝占位' },
  { value: '淋巴结', label: '淋巴结' },
  { value: '其他', label: '其他' },
]

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
      else message.error(res.error?.message ?? '病灶详情加载失败')
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
      message.success('测量已记录')
      measureForm.resetFields()
      setDetail(res.data)
      refresh()
      void loadTrend(detail.id)
    } else {
      message.error(res.error?.message ?? '新增测量失败')
    }
  }, [detail, measureForm, refresh])

  const handleCompare = useCallback(async () => {
    if (!detail || !compareA || !compareB) {
      message.warning('请选择两次测量')
      return
    }
    setCompareLoading(true)
    try {
      const res = await lesionTrackingApi.compare(detail.id, { studyIdA: compareA, studyIdB: compareB })
      if (res.success && res.data) setCompareResult(res.data)
      else message.error(res.error?.message ?? '对比失败')
    } finally {
      setCompareLoading(false)
    }
  }, [detail, compareA, compareB])

  const handleLinkFollowup = useCallback(async () => {
    if (!detail) return
    if (!followupId.trim()) {
      message.warning('请输入随访计划 ID')
      return
    }
    setFollowupLoading(true)
    try {
      const res = await lesionTrackingApi.linkFollowup(detail.id, followupId.trim())
      if (res.success && res.data) {
        message.success('已关联随访计划')
        setDetail(res.data)
        refresh()
      } else {
        message.error(res.error?.message ?? '关联随访失败')
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
      message.success('病灶已登记')
      setCreateOpen(false)
      createForm.resetFields()
      refresh()
    } else {
      message.error(res.error?.message ?? '登记失败')
    }
  }, [patientId, createForm, refresh])

  const handleDelete = useCallback(async (id: string) => {
    const res = await lesionTrackingApi.remove(id)
    if (res.success) {
      message.success('病灶已删除')
      if (detail?.id === id) setDetail(null)
      if (trendLesionId === id) {
        setTrendLesionId(undefined)
        setTrend(null)
      }
      refresh()
    } else {
      message.error(res.error?.message ?? '删除失败')
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
        尺寸: p.sizeMm,
      })),
    [trend],
  )

  const columns: ColumnsType<TrackedLesion> = [
    { title: '病灶', dataIndex: 'name', key: 'name', width: 140, render: (v: string) => (<b>{v}</b>) },
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 90,
      render: (v: LesionType) => <Tag color={v === '肺结节' ? 'geekblue' : v === '肝占位' ? 'purple' : v === '淋巴结' ? 'cyan' : 'default'}>{v}</Tag>,
    },
    { title: '部位', dataIndex: 'site', key: 'site', width: 150 },
    { title: '模态', dataIndex: 'modality', key: 'modality', width: 70 },
    {
      title: '当前状态', dataIndex: 'currentStatus', key: 'currentStatus', width: 100,
      render: (v: string) => <Tag color={STATUS_COLORS[v]}>{v}</Tag>,
    },
    {
      title: '最近尺寸', key: 'latest', width: 100,
      render: (_: unknown, r) => {
        const size = latestSize(r)
        return size === null ? <Text type="secondary">-</Text> : <span>{size.toFixed(1)} mm</span>
      },
    },
    { title: '测量次数', key: 'count', width: 90, render: (_: unknown, r) => `${r.measurements?.length ?? 0} 次` },
    {
      // [v3.0.6.11-100 Wave 6A (D-4)] 来源列: manual/ai/from-report (报告→病灶追踪自动建)
      title: '来源', key: 'source', width: 100,
      render: (_: unknown, r) => {
        const s = r.source ?? 'manual'
        return (
          <Space size={4} wrap>
            <Tag color={SOURCE_COLOR[s]} data-testid={`lt-source-${s}`}>{SOURCE_LABEL[s]}</Tag>
            {r.reportId && <span style={{ fontSize: 11, color: '#64748b' }}>{r.reportId}</span>}
          </Space>
        )
      },
    },
    {
      title: '操作', key: 'actions', width: 210,
      render: (_: unknown, r) => (
        <Space size={4} wrap>
          <Button size="small" icon={<Eye size={12} />} onClick={() => void openDetail(r.id)} data-testid="lt-detail">详情</Button>
          <Button size="small" icon={<TrendingUp size={12} />} onClick={() => setTrendLesionId(r.id)} data-testid="lt-trend">趋势</Button>
          <Popconfirm title="确认删除该病灶?" onConfirm={() => void handleDelete(r.id)}>
            <Button size="small" danger icon={<Trash2 size={12} />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const measurementOptions = useMemo(
    () =>
      (detail?.measurements ?? []).map((m) => ({
        value: m.studyId || m.id,
        label: `${m.date} · ${m.sizeMm.toFixed(1)}mm${m.response ? ` · ${RESPONSE_LABEL[m.response]}` : ''}`,
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
              <div style={{ fontSize: 18, fontWeight: 700 }}>病灶追踪工作台</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Lesion Tracking · 跨期对比 RECIST-like · 趋势随访</div>
            </div>
          </div>
        </Col>
        <Col>
          <Tag
            icon={<Database size={12} />}
            color={source === 'database' ? 'green' : 'orange'}
            data-testid="lt-source-badge"
          >
            数据源: {source === 'database' ? '数据库派生 (Exam)' : '演示数据 (Demo Seed)'}
          </Tag>
        </Col>
      </Row>

      {/* 统计卡 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { title: '病灶总数', value: stats?.total ?? 0, color: '#3b82f6' },
          { title: '新发', value: stats?.new ?? 0, color: '#f97316' },
          { title: '进展 (增大)', value: stats?.progressed ?? 0, color: '#ef4444' },
          { title: '稳定', value: stats?.stable ?? 0, color: '#3b82f6' },
          { title: '消失', value: stats?.disappeared ?? 0, color: '#64748b' },
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
              title={<span style={{ fontSize: 12, color: '#94a3b8' }}>缩小 (PR)</span>}
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
        title={<span style={{ fontSize: 14, color: '#e2e8f0' }}>患者选择</span>}
        extra={
          <Space>
            <Button size="small" icon={<RefreshCw size={12} />} onClick={refresh} data-testid="lt-refresh">刷新</Button>
            <Button size="small" type="primary" icon={<Plus size={12} />} onClick={() => setCreateOpen(true)} data-testid="lt-create">
              新建病灶
            </Button>
          </Space>
        }
      >
        <Select
          showSearch
          allowClear
          placeholder="选择患者"
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
        title={<span style={{ fontSize: 14, color: '#e2e8f0' }}>病灶列表</span>}
      >
        <Spin spinning={loading}>
          <Table<TrackedLesion>
            rowKey="id"
            columns={columns}
            dataSource={lesions}
            pagination={false}
            locale={{ emptyText: <Empty description="暂无病灶数据, 点击「新建病灶」登记" /> }}
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
            <span style={{ fontSize: 14, color: '#e2e8f0' }}>尺寸趋势</span>
          </Space>
        }
        extra={
          <Select
            size="small"
            placeholder="选择病灶"
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
                <Tag color="blue">基线 {trend.baselineSize.toFixed(1)}mm ({trend.baselineDate})</Tag>
                <Tag color="blue">末次 {trend.latestSize.toFixed(1)}mm ({trend.latestDate})</Tag>
                <Tag color={trend.changePercent >= 20 ? 'red' : trend.changePercent <= -30 ? 'green' : 'blue'}>
                  变化 {trend.changePercent > 0 ? '+' : ''}{trend.changePercent}%
                </Tag>
                <Tag color={RESPONSE_COLORS[trend.overallResponse]}>整体响应 {RESPONSE_LABEL[trend.overallResponse]}</Tag>
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
                  <Line type="monotone" dataKey="尺寸" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty description="无测量数据可绘制趋势" style={{ padding: 40, color: '#64748b' }} />
          )}
        </Spin>
      </Card>

      {/* 新建病灶 Modal */}
      <Modal
        title="新建病灶"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void handleCreate()}
        okText="登记"
        cancelText="取消"
        data-testid="lt-create-modal"
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="病灶名称" rules={[{ required: true, message: '请输入病灶名称' }]}>
            <Input placeholder="如: 肺结节 #1" />
          </Form.Item>
          <Form.Item name="site" label="部位" rules={[{ required: true, message: '请输入部位' }]}>
            <Input placeholder="如: 右肺上叶尖段" />
          </Form.Item>
          <Form.Item name="type" label="类型" initialValue="肺结节">
            <Select options={TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="initialSizeMm" label="初始尺寸 (mm)" rules={[{ required: true, message: '请输入初始尺寸' }]}>
            <InputNumber min={0} step={0.1} style={{ width: '100%' }} placeholder="如: 6.5" />
          </Form.Item>
          <Form.Item name="modality" label="模态" initialValue="CT">
            <Select options={[{ value: 'CT', label: 'CT' }, { value: 'MR', label: 'MR' }, { value: 'PET-CT', label: 'PET-CT' }, { value: 'US', label: 'US' }]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title={detail ? <Space><Activity size={16} color="#60a5fa" />{detail.name}</Space> : '病灶详情'}
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
                  { key: 'site', label: '部位', children: detail.site },
                  { key: 'type', label: '类型', children: <Tag color="purple">{detail.type}</Tag> },
                  { key: 'modality', label: '模态', children: detail.modality },
                  { key: 'status', label: '当前状态', children: <Tag color={STATUS_COLORS[detail.currentStatus]}>{detail.currentStatus}</Tag> },
                  { key: 'createdAt', label: '登记日期', children: detail.createdAt },
                  { key: 'followupId', label: '随访计划', children: detail.followupId ? <Tag color="cyan">{detail.followupId}</Tag> : <Text type="secondary">未关联</Text> },
                ]}
              />

              {/* 测量时间线 */}
              <div style={{ marginTop: 16, marginBottom: 8 }}>
                <b style={{ color: '#e2e8f0' }}>测量序列</b>
              </div>
              <Timeline
                items={(detail.measurements ?? []).map((m: LesionMeasurement) => ({
                  color: m.response ? RESPONSE_COLORS[m.response] : 'blue',
                  children: (
                    <div>
                      <div style={{ color: '#e2e8f0' }}>{m.date} · <b>{m.sizeMm.toFixed(1)}mm</b> <Text type="secondary">({m.studyId || '-'})</Text></div>
                      {m.response && <Tag color={RESPONSE_COLORS[m.response]} style={{ marginTop: 4 }}>{RESPONSE_LABEL[m.response]}</Tag>}
                      {m.notes && <div style={{ fontSize: 12, color: '#94a3b8' }}>{m.notes}</div>}
                    </div>
                  ),
                }))}
              />

              {/* 新增测量 */}
              <Card size="small" title="新增测量" style={{ background: '#0b1626', border: '1px solid #1e2b45', marginBottom: 12 }}>
                <Form form={measureForm} layout="vertical" size="small">
                  <Row gutter={8}>
                    <Col span={8}>
                      <Form.Item name="date" label="日期" rules={[{ required: true, message: '日期' }]}>
                        <DatePicker style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="sizeMm" label="尺寸 (mm)" rules={[{ required: true, message: '尺寸' }]}>
                        <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="response" label="响应分类">
                        <Select
                          allowClear
                          placeholder="CR/PR/SD/PD"
                          options={(Object.keys(RESPONSE_LABEL) as ResponseClass[]).map((r) => ({ value: r, label: `${r} ${RESPONSE_LABEL[r]}` }))}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={8}>
                    <Col span={16}>
                      <Form.Item name="studyId" label="检查 Study ID">
                        <Input placeholder={`如: STU-${Date.now()}`} />
                      </Form.Item>
                    </Col>
                    <Col span={8} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 24 }}>
                      <Button type="primary" size="small" icon={<History size={12} />} onClick={() => void handleAddMeasurement()} data-testid="lt-add-measurement">
                        记录测量
                      </Button>
                    </Col>
                  </Row>
                </Form>
              </Card>

              {/* 跨期对比 */}
              <Card size="small" title="跨期对比 (RECIST-like)" style={{ background: '#0b1626', border: '1px solid #1e2b45', marginBottom: 12 }}>
                <Row gutter={8} align="middle">
                  <Col span={9}>
                    <Select
                      size="small"
                      placeholder="测量 A (基线)"
                      value={compareA}
                      onChange={setCompareA}
                      style={{ width: '100%' }}
                      options={measurementOptions}
                    />
                  </Col>
                  <Col span={9}>
                    <Select
                      size="small"
                      placeholder="测量 B (随访)"
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
                      对比
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
                        方向: {compareResult.direction}
                      </Tag>
                      <Tag color={RESPONSE_COLORS[compareResult.response]}>
                        响应: {compareResult.response} {RESPONSE_LABEL[compareResult.response]}
                      </Tag>
                      {compareResult.deterministic && <Text type="secondary" style={{ fontSize: 11 }}>确定性判定</Text>}
                    </Space>
                  </div>
                )}
              </Card>

              {/* 随访联动 */}
              <Card size="small" title="随访联动 (Wave 3B)" style={{ background: '#0b1626', border: '1px solid #1e2b45' }}>
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    placeholder="输入随访计划 ID (如 FU001)"
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
                    关联
                  </Button>
                </Space.Compact>
                <Alert
                  style={{ marginTop: 8, background: '#0b1626', border: '1px solid #1e2b45' }}
                  type="info"
                  showIcon
                  message="关联后在随访计划页可按病灶回溯; 患者与随访计划患者不一致时后端拒绝。"
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
