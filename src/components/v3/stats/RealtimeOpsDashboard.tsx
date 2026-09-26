/**
 * G005 放射RIS系统 v3.0.2 - 实时运营看板 (大屏/综合看板)
 */
import { CHART_COLORS } from '../../../utils/chartColors'
import { ChartContainer } from '../../charts'
import { Card, Row, Col, Statistic, Tag, Space, List, Progress, Badge, Empty, Avatar } from 'antd'
import { Activity, AlertOctagon, Clock, Users, Cpu, Wifi, Stethoscope, TrendingUp, Server, Zap } from 'lucide-react'
import { Inbox } from 'lucide-react'
import React, { useState, useMemo, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, PieChart, Pie, Cell, Legend } from 'recharts'
// [G005 Wave3A G-23] BI socket 推送: 订阅 'ops-update', 不可用时保留轮询兜底
import { realtime, type RealtimePayload } from '../../../services/realtime'
import { t } from '../../../i18n/appI18n'

export interface RealtimeEvent {
  id: string
  type: 'EXAM' | 'REPORT' | 'CRITICAL' | 'LOGIN' | 'ERROR' | 'DEVICE' | 'APPOINTMENT'
  at: string
  title: string
  description: string
  severity: 'info' | 'warning' | 'error' | 'success'
  actor?: string
}

export interface DeviceRealtime {
  id: string
  name: string
  modality: string
  state: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'IDLE' | 'MAINTENANCE'
  queue: number
  currentPatient?: string
  utilization: number
}

export interface RealtimeOpsDashboardProps {
  events: RealtimeEvent[]
  devices: DeviceRealtime[]
  onlineUsers: number
  /** 自动刷新间隔(秒) */
  refreshInterval?: number
  onRefresh?: () => void
}

const COLORS = { EXAM: CHART_COLORS.primary, REPORT: CHART_COLORS.deepBlue, CRITICAL: CHART_COLORS.error, LOGIN: CHART_COLORS.success, ERROR: CHART_COLORS.error, DEVICE: CHART_COLORS.purple, APPOINTMENT: CHART_COLORS.cyan } as const

const SEVERITY_COLOR: Record<RealtimeEvent['severity'], string> = {
  info: 'blue',
  warning: 'orange',
  error: 'red',
  success: 'green',
}

export const RealtimeOpsDashboard: React.FC<RealtimeOpsDashboardProps> = ({
  events,
  devices,
  onlineUsers,
  refreshInterval = 5,
}) => {
  const [tick, setTick] = useState(0)
  // [G005 Wave3A G-23] socket 推送状态 (与 props 数据合并, 推送可用时优先)
  const [socketConnected, setSocketConnected] = useState(false)
  const [pushOnlineUsers, setPushOnlineUsers] = useState<number | null>(null)
  const [pushDevices, setPushDevices] = useState<DeviceRealtime[]>([])
  const [pushEvents, setPushEvents] = useState<RealtimeEvent[]>([])

  useEffect(() => {
    // 轮询兜底 (socket 不可用时沿用原逻辑: tick 驱动汇总/展示)
    const timer = setInterval(() => setTick((x) => x + 1), refreshInterval * 1000)
    return () => clearInterval(timer)
  }, [refreshInterval])

  useEffect(() => {
    // [G005 Wave3A G-23] 订阅后端 ops-update 快照; 断线重连由 socket.io 自动处理 (realtime.ts 已配置)
    realtime.connect()
    const offUpdate = realtime.subscribe('ops-update', (payload: RealtimePayload) => {
      const kpi = (payload?.kpi ?? {}) as { examsToday?: number; reportsToday?: number; criticalsToday?: number; onlineUsers?: number }
      const occupancy = (payload?.occupancy ?? []) as Array<{ modality: string; utilization?: number; count?: number }>
      if (typeof kpi.onlineUsers === 'number') setPushOnlineUsers(kpi.onlineUsers)
      if (occupancy.length > 0) {
        setPushDevices(occupancy.map((o) => ({
          id: `ops-${o.modality}`,
          name: o.modality,
          modality: o.modality,
          state: (o.utilization ?? 0) > 80 ? 'BUSY' : (o.utilization ?? 0) > 0 ? 'IDLE' : 'OFFLINE',
          queue: 0,
          utilization: Math.min(100, o.utilization ?? 0),
          currentPatient: undefined,
        })))
      }
      const snapshotEvent: RealtimeEvent = {
        id: `ops-${payload?.timestamp ?? Date.now()}`,
        type: 'EXAM',
        at: new Date(payload?.timestamp ?? Date.now()).toLocaleString(),
        title: t('w9e.realtimeOps.snapshotUpdate'),
        description: t('w9e.realtimeOps.snapshotDesc', { exams: kpi.examsToday ?? 0, reports: kpi.reportsToday ?? 0, criticals: kpi.criticalsToday ?? 0 }),
        severity: 'info',
      }
      setPushEvents(prev => [snapshotEvent, ...prev].slice(0, 50))
    })
    const offConnect = realtime.subscribe('connect', () => setSocketConnected(true))
    const offDisconnect = realtime.subscribe('disconnect', () => setSocketConnected(false))
    return () => {
      offUpdate()
      offConnect()
      offDisconnect()
    }
  }, [])

  // 推送数据可用时覆盖 props (页面首屏 props + 推送增量合并)
  const mergedEvents = useMemo(() => [...pushEvents, ...events], [pushEvents, events])
  const mergedDevices = pushDevices.length > 0 ? pushDevices : devices
  const mergedOnlineUsers = pushOnlineUsers ?? onlineUsers

  const summary = useMemo(() => {
    void tick
    const now = Date.now()
    const recent = mergedEvents.filter((e) => now - new Date(e.at).getTime() < 60 * 60 * 1000) // 1h
    return {
      examsLastHour: recent.filter((e) => e.type === 'EXAM').length,
      reportsLastHour: recent.filter((e) => e.type === 'REPORT').length,
      criticalsLastHour: recent.filter((e) => e.type === 'CRITICAL').length,
      errorsLastHour: recent.filter((e) => e.type === 'ERROR').length,
    }
  }, [mergedEvents, tick])

  const deviceStats = useMemo(() => {
    return {
      total: mergedDevices.length,
      online: mergedDevices.filter((d) => d.state === 'ONLINE' || d.state === 'IDLE' || d.state === 'BUSY').length,
      busy: mergedDevices.filter((d) => d.state === 'BUSY').length,
      avgUtilization: mergedDevices.length
        ? (mergedDevices.reduce((s, d) => s + d.utilization, 0) / mergedDevices.length * 100).toFixed(1)
        : 0,
    }
  }, [mergedDevices])

  const eventTypeData = useMemo(() => {
    const m: Record<string, number> = {}
    mergedEvents.forEach((e) => (m[e.type] = (m[e.type] ?? 0) + 1))
    return Object.entries(m).map(([k, v]) => ({ name: k, value: v }))
  }, [mergedEvents])

  return (
    <div data-testid="realtime-ops-dashboard">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('w9e.realtimeOps.onlineUsers')}
              value={mergedOnlineUsers}
              prefix={<Users size={14} color={CHART_COLORS.primary} />}
              styles={{ content: {  color: CHART_COLORS.primary  } }}
            />
            {/* [G005 Wave3A G-23] 实时徽标: socket 在线点亮 / 断线回退轮询模式 */}
            <Badge
              status={socketConnected ? 'processing' : 'warning'}
              text={socketConnected ? t('w9e.realtimeOps.realtimePush') : t('w9e.realtimeOps.pollingMode')}
              data-testid="ops-realtime-badge"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t('w9e.realtimeOps.examsLastHour')} value={summary.examsLastHour} prefix={<Activity size={14} color={CHART_COLORS.deepBlue} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t('w9e.realtimeOps.reportsLastHour')} value={summary.reportsLastHour} prefix={<Stethoscope size={14} color={CHART_COLORS.success} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('w9e.realtimeOps.criticalsLastHour')}
              value={summary.criticalsLastHour}
              prefix={<AlertOctagon size={14} color={CHART_COLORS.error} />}
              styles={{ content: {  color: summary.criticalsLastHour > 0 ? CHART_COLORS.error : CHART_COLORS.success  } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t('w9e.realtimeOps.deviceOnlineRate')} value={deviceStats.total > 0 ? (deviceStats.online / deviceStats.total * 100).toFixed(1) : 0} suffix="%" prefix={<Wifi size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t('w9e.realtimeOps.deviceBusy')} value={deviceStats.busy} prefix={<Cpu size={14} color={CHART_COLORS.amber} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t('w9e.realtimeOps.avgUtilization')} value={deviceStats.avgUtilization} suffix="%" prefix={<TrendingUp size={14} color={CHART_COLORS.purple} />} />
            <Progress percent={Number(deviceStats.avgUtilization)} size="small" showInfo={false} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('w9e.realtimeOps.systemErrorsLastHour')}
              value={summary.errorsLastHour}
              prefix={<Server size={14} color={summary.errorsLastHour > 0 ? CHART_COLORS.error : CHART_COLORS.success} />}
              styles={{ content: {  color: summary.errorsLastHour > 0 ? CHART_COLORS.error : CHART_COLORS.success  } }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col span={10}>
          <Card
            size="small"
            title={
              <Space>
                <Zap size={14} color={CHART_COLORS.amber} />
                <span>{t('w9e.realtimeOps.eventStream')}</span>
              </Space>
            }
            extra={<Tag color="red">{t('w9e.realtimeOps.realtime')}</Tag>}
            data-testid="ops-event-stream"
          >
            {mergedEvents.length === 0 ? (
              <Empty description={t('w9e.realtimeOps.noData')} image={<Inbox size={48} style={{opacity:0.4}}/>} />
            ) : (
              <List
                size="small"
                dataSource={mergedEvents.slice(0, 12)}
                renderItem={(e) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          size="small"
                          style={{ background: COLORS[e.type] }}
                          icon={<Zap size={10} />}
                        />
                      }
                      title={
                        <Space size={4}>
                          <Tag color={SEVERITY_COLOR[e.severity]}>{e.severity}</Tag>
                          <span style={{ fontSize: 12 }}>{e.title}</span>
                        </Space>
                      }
                      description={
                        <div>
                          <div style={{ fontSize: 12, color: CHART_COLORS.grayDark }}>{e.description}</div>
                          <div style={{ fontSize: 12, color: CHART_COLORS.gray }}>
                            <Clock size={8} /> {e.at} {e.actor ? `· ${e.actor}` : ''}
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
                style={{ maxHeight: 360, overflow: 'auto' }}
              />
            )}
          </Card>
        </Col>
        <Col span={14}>
          <Card
            size="small"
            title={
              <Space>
                <Cpu size={14} />
                <span>{t('w9e.realtimeOps.deviceStatus')}</span>
              </Space>
            }
            data-testid="ops-device-status"
          >
            <Row gutter={[12, 12]}>
              {mergedDevices.map((d) => {
                const stateColor =
                  d.state === 'BUSY' ? CHART_COLORS.error : d.state === 'IDLE' ? CHART_COLORS.success : d.state === 'OFFLINE' ? CHART_COLORS.gray : d.state === 'MAINTENANCE' ? CHART_COLORS.amber : CHART_COLORS.primary
                return (
                  <Col key={d.id} xs={12} sm={8} md={6}>
                    <Card
                      size="small"
                      data-testid={`ops-device-${d.id}`}
                      style={{ borderColor: stateColor }}
                    >
                      <Space orientation="vertical" size={2} style={{ width: '100%' }}>
                        <Space size={4}>
                          <Tag color="blue">{d.modality}</Tag>
                          <span style={{ fontSize: 12, fontWeight: 500 }}>{d.name}</span>
                        </Space>
                        <Tag color={stateColor} style={{ fontSize: 12 }}>{d.state}</Tag>
                        {d.currentPatient && <div style={{ fontSize: 12, color: CHART_COLORS.grayDark }}>{t('w9e.realtimeOps.patientLabel', { name: d.currentPatient })}</div>}
                        {d.queue > 0 && <div style={{ fontSize: 12, color: CHART_COLORS.amber }}>{t('w9e.realtimeOps.queueLabel', { count: d.queue })}</div>}
                        <Progress
                          percent={Math.round(d.utilization)}
                          size="small"
                          showInfo={false}
                          strokeColor={d.utilization > 80 ? CHART_COLORS.error : CHART_COLORS.primary}
                        />
                      </Space>
                    </Card>
                  </Col>
                )
              })}
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={12} style={{ marginTop: 12 }}>
        <Col span={8}>
          <Card size="small" title={t('w9e.realtimeOps.eventDistribution')} data-testid="ops-event-distribution">
            <ChartContainer
              height={220}
              state={eventTypeData.length === 0 ? 'empty' : 'ready'}
              emptyDescription={t('w9e.realtimeOps.noEventData')}
            >
              <PieChart>
                <Pie
                  data={eventTypeData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label
                >
                  {eventTypeData.map((e, i) => <Cell key={i} fill={COLORS[e.name as keyof typeof COLORS] ?? CHART_COLORS.gray} />)}
                </Pie>
                <Legend verticalAlign="bottom" align="center" />
                <RTooltip />
              </PieChart>
            </ChartContainer>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={t('w9e.realtimeOps.deviceUtilization')} data-testid="ops-device-utilization">
            <ChartContainer
              height={220}
              state={mergedDevices.length === 0 ? 'empty' : 'ready'}
              emptyDescription={t('w9e.realtimeOps.noDeviceData')}
            >
              <BarChart
                data={mergedDevices.map((d) => ({ name: d.name, util: d.utilization }))}
                layout="vertical"
              >
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="name" type="category" width={80} />
                <RTooltip />
                <Bar dataKey="util" fill={CHART_COLORS.primary} />
              </BarChart>
            </ChartContainer>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={t('w9e.realtimeOps.systemStatus')} data-testid="ops-system-status">
            <Space orientation="vertical" size={6} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('w9e.realtimeOps.database')}</span>
                <Badge status="success" text={t('w9e.realtimeOps.normal')} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('w9e.realtimeOps.dicomGateway')}</span>
                <Badge status="success" text={t('w9e.realtimeOps.normal')} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('w9e.realtimeOps.hl7Engine')}</span>
                <Badge status="success" text={t('w9e.realtimeOps.normal')} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('w9e.realtimeOps.messageQueue')}</span>
                <Badge status="success" text={t('w9e.realtimeOps.normal')} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('w9e.realtimeOps.aiService')}</span>
                <Badge status="processing" text={t('w9e.realtimeOps.running')} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('w9e.realtimeOps.cache')}</span>
                <Badge status="success" text={t('w9e.realtimeOps.cacheHitRate')} />
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default RealtimeOpsDashboard
