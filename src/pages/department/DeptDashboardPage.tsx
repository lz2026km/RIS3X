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
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { biApi } from '../../services/api/biApi'
import { t } from '../../i18n/appI18n'
import { ChartContainer } from '../../components/charts'
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
  { value: 30000, label: t('deptDash.refresh30s') },
  { value: 60000, label: t('deptDash.refresh1m') },
  { value: 300000, label: t('deptDash.refresh5m') },
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

function severityLabel(severity: string): string {
  if (severity === 'CRITICAL') return t('deptDash.sevCritical')
  if (severity === 'URGENT') return t('deptDash.sevUrgent')
  if (severity === 'HIGH') return t('deptDash.sevHigh')
  return severity
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
        setError(t('deptDash.loadFailed'))
        setLoading(false)
        return
      }
      if (failed > 0) setError(t('w9e.deptDashboard.partialLoadFailed', { failed, total: results.length }))

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
    () => state.trend.map((pt) => ({ date: pt.date.slice(5), [t('deptDash.examCount')]: pt.examCount, [t('deptDash.reportVolume')]: pt.reportCount })),
    [state.trend],
  )

  const rvuColumns: ColumnsType<PhysicianRvuDto> = [
    { title: t('deptDash.doctor'), dataIndex: 'doctorName', key: 'doctorName' },
    {
      title: t('deptDash.reportCount'),
      dataIndex: 'reportCount',
      key: 'reportCount',
      sorter: (a, b) => a.reportCount - b.reportCount,
    },
    {
      title: t('deptDash.rvuWorkload'),
      dataIndex: 'rvu',
      key: 'rvu',
      sorter: (a, b) => a.rvu - b.rvu,
      render: (v: number) => <Text strong>{v.toFixed(1)}</Text>,
    },
    {
      title: t('deptDash.avgDurationMin'),
      dataIndex: 'avgMinutes',
      key: 'avgMinutes',
      render: (v: number) => (
        <Tag color={v > 90 ? 'orange' : v > 60 ? 'gold' : 'green'}>{v.toFixed(0)}</Tag>
      ),
    },
  ]

  const oeeColumns: ColumnsType<DeviceOeeDto> = [
    { title: t('deptDash.device'), dataIndex: 'deviceName', key: 'deviceName' },
    { title: t('deptDash.modality'), dataIndex: 'modality', key: 'modality', width: 70 },
    {
      title: t('deptDash.oee'),
      dataIndex: 'avgOee',
      key: 'avgOee',
      sorter: (a, b) => a.avgOee - b.avgOee,
      render: (v: number) => <Tag color={oeeColor(v)}>{v.toFixed(1)}%</Tag>,
    },
    {
      title: t('deptDash.availability'),
      dataIndex: 'avgAvailability',
      key: 'avgAvailability',
      render: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      title: t('deptDash.performance'),
      dataIndex: 'avgPerformance',
      key: 'avgPerformance',
      render: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      title: t('deptDash.quality'),
      dataIndex: 'avgQuality',
      key: 'avgQuality',
      render: (v: number) => `${v.toFixed(1)}%`,
    },
  ]

  const slaColumns: ColumnsType<CriticalSlaDto['overdue'][number]> = [
    { title: t('deptDash.id'), dataIndex: 'id', key: 'id' },
    {
      title: t('deptDash.severity'),
      dataIndex: 'severity',
      key: 'severity',
      render: (v: string) => <Tag color={severityColor(v)}>{severityLabel(v)}</Tag>,
    },
    { title: t('deptDash.state'), dataIndex: 'state', key: 'state' },
    {
      title: t('deptDash.responseDuration'),
      dataIndex: 'responseMinutes',
      key: 'responseMinutes',
      render: (v: number) => <Text type="danger">{v.toFixed(0)} {t('deptDash.minutes')}</Text>,
    },
  ]

  const sourceTags = (
    <>
      {state.sources.has('database') && <Tag color="green">{t('deptDash.realtimeDb')}</Tag>}
      {state.sources.has('demo') && <Tag color="blue">{t('deptDash.demoData')}</Tag>}
    </>
  )

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <Space>
          <BarChart3 size={20} color="#2563eb" />
          <Title level={4} style={{ margin: 0 }}>
            {t('deptDash.title')}
          </Title>
          {sourceTags}
        </Space>
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {lastUpdated ? t('w9e.deptDashboard.updatedAt', { time: lastUpdated.toLocaleTimeString('zh-CN', { hour12: false }) }) : ''}
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
            {t('deptDash.refresh')}
          </Button>
        </Space>
      </Space>

      {error && (
        <Alert type="warning" showIcon message={error} style={{ marginBottom: 16 }} />
      )}

      <Spin spinning={loading} description={t('deptDash.loading')}>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={8} lg={4}>
            <Card>
              <Statistic
                title={t('deptDash.todayExam')}
                value={state.kpi?.examCount ?? 0}
                prefix={<Activity size={16} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Card>
              <Statistic
                title={t('deptDash.todayReport')}
                value={state.kpi?.reportCount ?? 0}
                prefix={<FileText size={16} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Card>
              <Statistic
                title={t('deptDash.completionRate')}
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
                title={t('deptDash.avgReportDuration')}
                value={state.kpi?.avgReportMinutes ?? 0}
                suffix={t('deptDash.minutesShort')}
                precision={0}
                prefix={<Clock size={16} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Card>
              <Statistic
                title={t('deptDash.overtimeRate')}
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
                title={t('deptDash.criticalSlaRate')}
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
              title={t('deptDash.timelinessDist')}
              extra={
                state.timeliness ? (
                  <Space size={12}>
                    <Tag color="blue">{t('deptDash.median')} {state.timeliness.medianMinutes}min</Tag>
                    <Tag color="purple">P90 {state.timeliness.p90Minutes} {t('deptDash.minutes')}</Tag>
                  </Space>
                ) : null
              }
            >
              {timelinessChartData.length > 0 ? (
                <ChartContainer height={220}>
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
                </ChartContainer>
              ) : (
                <Text type="secondary">{t('deptDash.noData')}</Text>
              )}
            </Card>
          </Col>

          <Col xs={24} lg={14}>
            <Card title={t('deptDash.doctorWorkload')}>
              <ChartContainer height={160} state={state.rvu.length === 0 ? 'empty' : 'ready'} emptyDescription={t('deptDash.noWorkload')}>
                <BarChart data={state.rvu}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="doctorName" />
                  <YAxis />
                  <ReTooltip />
                  <Legend />
                  <Bar dataKey="reportCount" name={t('deptDash.reportCount')} fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="rvu" name="RVU" fill="#52c41a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
              <Table scroll={{ x: 'max-content' }}
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
              title={t('deptDash.deviceOeeRealtime')}
              extra={
                <Select
                  value={oeeDays}
                  onChange={(v) => setOeeDays(v)}
                  options={[
                    { value: 7, label: t('deptDash.last7d') },
                    { value: 14, label: t('deptDash.last14d') },
                    { value: 30, label: t('deptDash.last30d') },
                  ]}
                  style={{ width: 100 }}
                  size="small"
                />
              }
            >
              <Table scroll={{ x: 'max-content' }}
                rowKey="deviceId"
                columns={oeeColumns}
                dataSource={state.oeeDevices}
                pagination={false}
                size="small"
             
              />
              <div style={{ marginTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('deptDash.hospitalOeeTrend')}
                </Text>
                <ChartContainer height={160} state={state.oeeTrend.length === 0 ? 'empty' : 'ready'} emptyDescription={t('deptDash.noOeeTrend')}>
                  <LineChart data={state.oeeTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <ReTooltip />
                    <Line type="monotone" dataKey="oee" name="OEE %" stroke="#722ed1" dot={false} />
                  </LineChart>
                </ChartContainer>
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title={t('deptDash.criticalSla30')}>
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title={t('deptDash.criticalTotal')}
                    value={state.sla?.total ?? 0}
                    prefix={<AlertTriangle size={16} />}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title={t('deptDash.complianceRate30')}
                    value={state.sla?.complianceRate ?? 0}
                    suffix="%"
                    precision={1}
                    styles={{ content: { color: (state.sla?.complianceRate ?? 0) >= 90 ? '#3f8600' : '#cf1322' } }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title={t('deptDash.avgResponse')}
                    value={state.sla?.avgResponseMinutes ?? 0}
                    suffix={t('deptDash.minutesShort')}
                    precision={1}
                  />
                </Col>
              </Row>
              <div style={{ marginTop: 12, height: 150 }}>
                <ChartContainer height={150} state={(state.sla?.distribution ?? []).length === 0 ? 'empty' : 'ready'} emptyDescription={t('deptDash.noSlaDist')}>
                  <BarChart data={state.sla?.distribution ?? []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <ReTooltip />
                    <Bar dataKey="count" name={t('deptDash.caseCount')} fill="#fa8c16" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
              {state.sla && state.sla.overdue.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Space style={{ marginBottom: 8 }}>
                    <AlertTriangle size={14} color="#cf1322" />
                    <Text strong type="danger">
                      {t('deptDash.overdueList', { count: state.sla.overdue.length })}
                    </Text>
                  </Space>
                  <Table scroll={{ x: 'max-content' }}
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
              title={t('deptDash.trendTitle', { days: trendDays })}
              extra={
                <Select
                  value={trendDays}
                  onChange={(v) => setTrendDays(v)}
                  options={[
                    { value: 14, label: t('deptDash.last14d') },
                    { value: 30, label: t('deptDash.last30d') },
                    { value: 90, label: t('deptDash.last90d') },
                  ]}
                  style={{ width: 100 }}
                  size="small"
                />
              }
            >
              <ChartContainer height={280} state={trendChartData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('deptDash.noTrendData')}>
                <LineChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ReTooltip />
                  <Legend />
                  <Line type="monotone" dataKey={t('deptDash.examCount')} stroke="#2563eb" dot={false} />
                  <Line type="monotone" dataKey={t('deptDash.reportVolume')} stroke="#52c41a" dot={false} />
                </LineChart>
              </ChartContainer>
              <div style={{ marginTop: 8, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <Tooltip title={t('deptDash.onTimeRatio')}>
                  <Tag color="blue" style={{ cursor: 'pointer' }}>
                    {t('deptDash.recentCompletion')} {(state.trend[state.trend.length - 1]?.completionRate ?? 0).toFixed(1)}%
                  </Tag>
                </Tooltip>
                <Tag color="orange">
                  {t('deptDash.recentAvgDuration')} {(state.trend[state.trend.length - 1]?.avgReportMinutes ?? 0).toFixed(0)}{t('deptDash.minutesShort')}
                </Tag>
                <Tag color="red">
                  {t('deptDash.recentOvertime')} {(state.trend[state.trend.length - 1]?.overtimeCount ?? 0)}{t('deptDash.cases')}
                </Tag>
                <Tag color="volcano">
                  {t('deptDash.recentCritical')} {(state.trend[state.trend.length - 1]?.criticalCount ?? 0)}{t('deptDash.cases')}
                </Tag>
              </div>
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}
