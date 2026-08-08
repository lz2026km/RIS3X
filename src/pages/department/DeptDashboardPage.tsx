import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  FileText,
  Gauge,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { biApi } from '../../services/api/biApi'
import type {
  CriticalSlaDto,
  DeviceOeeDto,
  KpiDto,
  PhysicianRvuDto,
  TimelinessDto,
  TrendPointDto,
} from '../../services/api/biApi'

const { Text, Title } = Typography

const TIMELINESS_COLORS = ['#52c41a', '#7cb305', '#faad14', '#fa8c16', '#f5222d']
const REFRESH_OPTIONS = [
  { value: 30000, label: '30秒' },
  { value: 60000, label: '1分钟' },
  { value: 300000, label: '5分钟' },
]

interface DashboardState {
  kpi: KpiDto | null
  timeliness: TimelinessDto | null
  rvu: PhysicianRvuDto[]
  oeeDevices: DeviceOeeDto[]
  oeeTrend: Array<{ date: string; oee: number }>
  sla: CriticalSlaDto | null
  trend: TrendPointDto[]
  sources: Set<string>
}

const EMPTY_STATE: DashboardState = {
  kpi: null,
  timeliness: null,
  rvu: [],
  oeeDevices: [],
  oeeTrend: [],
  sla: null,
  trend: [],
  sources: new Set(),
}

function severityColor(severity: string): string {
  if (severity === 'CRITICAL') return 'red'
  if (severity === 'URGENT') return 'volcano'
  if (severity === 'HIGH') return 'orange'
  return 'blue'
}

function oeeColor(oee: number): string {
  if (oee >= 85) return 'green'
  if (oee >= 70) return 'orange'
  return 'red'
}

export default function DeptDashboardPage() {
  const [state, setState] = useState<DashboardState>(EMPTY_STATE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshMs, setRefreshMs] = useState(60000)
  const [oeeDays, setOeeDays] = useState(14)
  const [trendDays, setTrendDays] = useState(30)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadAll = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      setError('')
      const sources = new Set<string>()
      const results = await Promise.allSettled([
        biApi.getKpi(),
        biApi.getReportTimeliness(),
        biApi.getPhysicianRvu(),
        biApi.getDeviceOee(oeeDays),
        biApi.getCriticalSla(),
        biApi.getTrend(trendDays),
      ])
      const failed = results.filter((r) => r.status === 'rejected').length
      const ok = results.filter(
        (r) => r.status === 'fulfilled' && r.value.success === true,
      ).length
      if (ok === 0) {
        setError('BI 数据加载失败，请检查网络后重试')
        setLoading(false)
        return
      }
      if (failed > 0) setError(`部分数据源加载失败 (${failed}/${results.length})，当前展示可用数据`)

      const r0 = results[0]
      const r1 = results[1]
      const r2 = results[2]
      const r3 = results[3]
      const r4 = results[4]
      const r5 = results[5]
      const kpi = r0?.status === 'fulfilled' && r0.value.success === true ? r0.value.data : null
      const timeliness = r1?.status === 'fulfilled' && r1.value.success === true ? r1.value.data : null
      const rvuEnvelope = r2?.status === 'fulfilled' && r2.value.success === true ? r2.value.data : null
      const oeeEnvelope = r3?.status === 'fulfilled' && r3.value.success === true ? r3.value.data : null
      const sla = r4?.status === 'fulfilled' && r4.value.success === true ? r4.value.data : null
      const trend = r5?.status === 'fulfilled' && r5.value.success === true ? r5.value.data : null

      for (const item of [kpi, timeliness, rvuEnvelope, oeeEnvelope, sla, trend]) {
        if (item && typeof item === 'object' && 'source' in item) {
          sources.add(String(item.source))
        }
      }

      setState({
        kpi: kpi?.data ?? null,
        timeliness: timeliness?.data ?? null,
        rvu: rvuEnvelope?.data?.physicians ?? [],
        oeeDevices: oeeEnvelope?.data?.devices ?? [],
        oeeTrend: (oeeEnvelope?.data?.dailyTrend ?? []).map((d) => ({ date: d.date, oee: d.oee })),
        sla: sla?.data ?? null,
        trend: trend?.data ?? [],
        sources,
      })
      setLastUpdated(new Date())
      setLoading(false)
    },
    [oeeDays, trendDays],
  )

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void loadAll(true)
    }, refreshMs)
    return () => clearInterval(timer)
  }, [refreshMs, loadAll])

  const timelinessChartData = useMemo(() => {
    const buckets = state.timeliness?.buckets ?? []
    if (buckets.length === 0) return []
    return buckets.map((b, i) => ({
      name: b.bucket,
      [`s${i}`]: b.count,
      percent: b.percent,
    }))
  }, [state.timeliness])

  const trendChartData = useMemo(
    () => state.trend.map((t) => ({ date: t.date.slice(5), 检查量: t.examCount, 报告量: t.reportCount })),
    [state.trend],
  )

  const rvuColumns: ColumnsType<PhysicianRvuDto> = [
    { title: '医生', dataIndex: 'doctorName', key: 'doctorName' },
    {
      title: '报告数',
      dataIndex: 'reportCount',
      key: 'reportCount',
      sorter: (a, b) => a.reportCount - b.reportCount,
    },
    {
      title: 'RVU 工作量',
      dataIndex: 'rvu',
      key: 'rvu',
      sorter: (a, b) => a.rvu - b.rvu,
      render: (v: number) => <Text strong>{v.toFixed(1)}</Text>,
    },
    {
      title: '平均时长(分)',
      dataIndex: 'avgMinutes',
      key: 'avgMinutes',
      render: (v: number) => (
        <Tag color={v > 90 ? 'orange' : v > 60 ? 'gold' : 'green'}>{v.toFixed(0)}</Tag>
      ),
    },
  ]

  const oeeColumns: ColumnsType<DeviceOeeDto> = [
    { title: '设备', dataIndex: 'deviceName', key: 'deviceName' },
    { title: '模态', dataIndex: 'modality', key: 'modality', width: 70 },
    {
      title: 'OEE',
      dataIndex: 'avgOee',
      key: 'avgOee',
      sorter: (a, b) => a.avgOee - b.avgOee,
      render: (v: number) => <Tag color={oeeColor(v)}>{v.toFixed(1)}%</Tag>,
    },
    {
      title: '可用性',
      dataIndex: 'avgAvailability',
      key: 'avgAvailability',
      render: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      title: '性能',
      dataIndex: 'avgPerformance',
      key: 'avgPerformance',
      render: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      title: '质量',
      dataIndex: 'avgQuality',
      key: 'avgQuality',
      render: (v: number) => `${v.toFixed(1)}%`,
    },
  ]

  const slaColumns: ColumnsType<CriticalSlaDto['overdue'][number]> = [
    { title: '编号', dataIndex: 'id', key: 'id' },
    {
      title: '严重度',
      dataIndex: 'severity',
      key: 'severity',
      render: (v: string) => <Tag color={severityColor(v)}>{v}</Tag>,
    },
    { title: '状态', dataIndex: 'state', key: 'state' },
    {
      title: '响应时长',
      dataIndex: 'responseMinutes',
      key: 'responseMinutes',
      render: (v: number) => <Text type="danger">{v.toFixed(0)} 分钟</Text>,
    },
  ]

  const sourceTags = (
    <>
      {state.sources.has('database') && <Tag color="green">实时数据库</Tag>}
      {state.sources.has('demo') && <Tag color="blue">演示数据 (seed)</Tag>}
    </>
  )

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <Space>
          <BarChart3 size={20} color="#2563eb" />
          <Title level={4} style={{ margin: 0 }}>
            放射科运营 BI 实时仪表板
          </Title>
          {sourceTags}
        </Space>
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {lastUpdated ? `更新于 ${lastUpdated.toLocaleTimeString('zh-CN', { hour12: false })}` : ''}
          </Text>
          <Select
            value={refreshMs}
            onChange={(v) => setRefreshMs(v)}
            options={REFRESH_OPTIONS}
            style={{ width: 110 }}
            size="middle"
          />
          <Button
            icon={<RefreshCw size={14} />}
            loading={loading}
            onClick={() => void loadAll()}
          >
            刷新
          </Button>
        </Space>
      </Space>

      {error && (
        <Alert type="warning" showIcon message={error} style={{ marginBottom: 16 }} />
      )}

      <Spin spinning={loading} description="加载中...">
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={8} lg={4}>
            <Card>
              <Statistic
                title="今日检查量"
                value={state.kpi?.examCount ?? 0}
                prefix={<Activity size={16} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Card>
              <Statistic
                title="今日报告量"
                value={state.kpi?.reportCount ?? 0}
                prefix={<FileText size={16} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Card>
              <Statistic
                title="报告完成率"
                value={state.kpi?.completionRate ?? 0}
                suffix="%"
                precision={1}
                prefix={<TrendingUp size={16} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Card>
              <Statistic
                title="平均报告时长"
                value={state.kpi?.avgReportMinutes ?? 0}
                suffix="分"
                precision={0}
                prefix={<Clock size={16} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Card>
              <Statistic
                title="报告超时率"
                value={state.kpi?.overtimeRate ?? 0}
                suffix="%"
                precision={1}
                styles={{ content: { color: (state.kpi?.overtimeRate ?? 0) > 8 ? '#cf1322' : '#3f8600' } }}
                prefix={<AlertTriangle size={16} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Card>
              <Statistic
                title="危急值 SLA 达标率"
                value={state.kpi?.criticalSlaRate ?? 0}
                suffix="%"
                precision={1}
                styles={{ content: { color: (state.kpi?.criticalSlaRate ?? 0) >= 90 ? '#3f8600' : '#cf1322' } }}
                prefix={<Gauge size={16} />}
              />
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <Card
              title="报告时效分布 (近30天)"
              extra={
                state.timeliness ? (
                  <Space size={12}>
                    <Tag color="blue">中位数 {state.timeliness.medianMinutes}min</Tag>
                    <Tag color="purple">P90 {state.timeliness.p90Minutes}min</Tag>
                  </Space>
                ) : null
              }
            >
              {timelinessChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={timelinessChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <ReTooltip />
                    <Legend />
                    {timelinessChartData[0] &&
                      Object.keys(timelinessChartData[0]!)
                        .filter((k) => k.startsWith('s'))
                        .map((k, i) => (
                          <Bar
                            key={k}
                            dataKey={k}
                            stackId="t"
                            name={state.timeliness?.buckets[i]?.bucket ?? k}
                            fill={TIMELINESS_COLORS[i % TIMELINESS_COLORS.length] ?? '#2563eb'}
                          />
                        ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Text type="secondary">暂无数据</Text>
              )}
            </Card>
          </Col>

          <Col xs={24} lg={14}>
            <Card title="医生工作量 (报告数 / RVU)">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={state.rvu}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="doctorName" />
                  <YAxis />
                  <ReTooltip />
                  <Legend />
                  <Bar dataKey="reportCount" name="报告数" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="rvu" name="RVU" fill="#52c41a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <Table
                rowKey="doctorName"
                columns={rvuColumns}
                dataSource={state.rvu}
                pagination={false}
                size="small"
                style={{ marginTop: 12 }}
              />
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              title="设备 OEE 实时"
              extra={
                <Select
                  value={oeeDays}
                  onChange={(v) => setOeeDays(v)}
                  options={[
                    { value: 7, label: '近7天' },
                    { value: 14, label: '近14天' },
                    { value: 30, label: '近30天' },
                  ]}
                  style={{ width: 100 }}
                  size="small"
                />
              }
            >
              <Table
                rowKey="deviceId"
                columns={oeeColumns}
                dataSource={state.oeeDevices}
                pagination={false}
                size="small"
              scroll={{ x: 'max-content' }}
              />
              <div style={{ marginTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  全院日均 OEE 趋势
                </Text>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={state.oeeTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <ReTooltip />
                    <Line type="monotone" dataKey="oee" name="OEE %" stroke="#722ed1" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="危急值 SLA (近30天)">
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="危急值总数"
                    value={state.sla?.total ?? 0}
                    prefix={<AlertTriangle size={16} />}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="达标率 (≤30min)"
                    value={state.sla?.complianceRate ?? 0}
                    suffix="%"
                    precision={1}
                    styles={{ content: { color: (state.sla?.complianceRate ?? 0) >= 90 ? '#3f8600' : '#cf1322' } }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="平均响应"
                    value={state.sla?.avgResponseMinutes ?? 0}
                    suffix="分"
                    precision={1}
                  />
                </Col>
              </Row>
              <div style={{ marginTop: 12, height: 150 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={state.sla?.distribution ?? []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <ReTooltip />
                    <Bar dataKey="count" name="例数" fill="#fa8c16" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {state.sla && state.sla.overdue.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Space style={{ marginBottom: 8 }}>
                    <AlertTriangle size={14} color="#cf1322" />
                    <Text strong type="danger">
                      超时清单 (Top {state.sla.overdue.length})
                    </Text>
                  </Space>
                  <Table
                    rowKey="id"
                    columns={slaColumns}
                    dataSource={state.sla.overdue.slice(0, 5)}
                    pagination={false}
                    size="small"
                  />
                </div>
              )}
            </Card>
          </Col>

          <Col span={24}>
            <Card
              title={`核心指标趋势 (近${trendDays}天)`}
              extra={
                <Select
                  value={trendDays}
                  onChange={(v) => setTrendDays(v)}
                  options={[
                    { value: 14, label: '近14天' },
                    { value: 30, label: '近30天' },
                    { value: 90, label: '近90天' },
                  ]}
                  style={{ width: 100 }}
                  size="small"
                />
              }
            >
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ReTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="检查量" stroke="#2563eb" dot={false} />
                  <Line type="monotone" dataKey="报告量" stroke="#52c41a" dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 8, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <Tooltip title="按时完成的报告占比">
                  <Tag color="blue" style={{ cursor: 'pointer' }}>
                    最近完成率 {(state.trend[state.trend.length - 1]?.completionRate ?? 0).toFixed(1)}%
                  </Tag>
                </Tooltip>
                <Tag color="orange">
                  最近平均时长 {(state.trend[state.trend.length - 1]?.avgReportMinutes ?? 0).toFixed(0)}分
                </Tag>
                <Tag color="red">
                  最近超时 {(state.trend[state.trend.length - 1]?.overtimeCount ?? 0)}例
                </Tag>
                <Tag color="volcano">
                  最近危急值 {(state.trend[state.trend.length - 1]?.criticalCount ?? 0)}例
                </Tag>
              </div>
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}
