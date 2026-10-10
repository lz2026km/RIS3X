/**
 * [v3.0.6.11-104 Wave 2A] 设备管理看板
 * 数据源 (backend/src/devicemgmt/devicemgmt.controller.ts):
 *   GET /device-mgmt/overview            → 设备总览卡
 *   GET /device-mgmt/usage-trend         → 利用率/使用趋势图
 *   GET /device-mgmt/by-room             → 按机房分布
 *   GET /device-mgmt/maintenance-calendar→ 维护日历
 *   GET /device-mgmt/equipment-lifecycle/:id → 设备生命周期详情
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, CalendarDays, Gauge, Monitor, Server, TrendingUp, Wrench } from 'lucide-react'
import { DashboardCard } from '../../components/dashboard/DashboardCard'
import { TrendChart } from '../../components/dashboard/TrendChart'
import { StatCard, StatCardGrid } from '../../components/common/StatCard'
import { DataTable } from '../../components/common'
import { t } from '../../i18n/appI18n'
import {
  deviceMgmtApi,
  type DeviceByRoom,
  type DeviceLifecycleDetail,
  type DeviceMgmtOverview,
  type DeviceUsageTrend,
  type EquipmentLifecycle,
  type MaintenanceCalendar,
} from '../../services/api/deviceMgmtApi'

const RANGE_OPTIONS = [7, 30, 90]

const STATE_LABEL_KEYS: Record<string, string> = {
  IDLE: 'deviceMgmtBoard.stateIdle',
  IN_USE: 'deviceMgmtBoard.stateInUse',
  MAINTENANCE: 'deviceMgmtBoard.stateMaintenance',
  BROKEN: 'deviceMgmtBoard.stateBroken',
  OFFLINE: 'deviceMgmtBoard.stateOffline',
}

const NUM = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0)

function fmtDate(v?: string | null): string {
  if (!v) return '—'
  return String(v).replace('T', ' ').slice(0, 16)
}

export interface DeviceMgmtDashboardProps {
  /** 使用趋势天数 (默认 30) */
  defaultDays?: number
}

export function DeviceMgmtDashboard({ defaultDays = 30 }: DeviceMgmtDashboardProps) {
  const [days, setDays] = useState(defaultDays)
  const [overview, setOverview] = useState<DeviceMgmtOverview | null>(null)
  const [trend, setTrend] = useState<DeviceUsageTrend | null>(null)
  const [rooms, setRooms] = useState<DeviceByRoom | null>(null)
  const [calendar, setCalendar] = useState<MaintenanceCalendar | null>(null)
  const [devices, setDevices] = useState<EquipmentLifecycle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [detail, setDetail] = useState<DeviceLifecycleDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const results = await Promise.allSettled([
      deviceMgmtApi.getOverview(),
      deviceMgmtApi.getUsageTrend(days),
      deviceMgmtApi.getByRoom(),
      deviceMgmtApi.getMaintenanceCalendar(),
      deviceMgmtApi.listEquipmentLifecycle(),
    ])
    const [ov, tr, rm, cal, list] = results
    if (ov.status === 'fulfilled' && ov.value.success) setOverview(ov.value.data)
    if (tr.status === 'fulfilled' && tr.value.success) setTrend(tr.value.data)
    if (rm.status === 'fulfilled' && rm.value.success) setRooms(rm.value.data)
    if (cal.status === 'fulfilled' && cal.value.success) setCalendar(cal.value.data)
    if (list.status === 'fulfilled' && list.value.success) setDevices(list.value.data.items ?? [])
    const anySuccess = results.some((r) => r.status === 'fulfilled' && r.value.success)
    if (!anySuccess) setError(t('deviceMgmtBoard.loadFailed'))
    setLoading(false)
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    if (!selectedDeviceId) {
      setDetail(null)
      return
    }
    setDetailLoading(true)
    void deviceMgmtApi
      .getEquipmentLifecycle(selectedDeviceId)
      .then((res) => {
        if (!cancelled) setDetail(res.success ? res.data : null)
      })
      .catch(() => {
        if (!cancelled) setDetail(null)
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedDeviceId])

  const trendData = useMemo(
    () => (trend?.items ?? []).map((p) => ({ date: String(p.date).slice(5), count: NUM(p.count) })),
    [trend],
  )

  const hasData = !!overview || !!trend || !!rooms || !!calendar

  return (
    <div style={{ marginTop: 'var(--space-5, 20px)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
      <DashboardCard
        title={t('deviceMgmtBoard.title')}
        icon={<Gauge size={16} />}
        extra={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {RANGE_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                style={{
                  padding: '3px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${days === d ? 'var(--color-primary-600, var(--color-primary-600))' : 'var(--border-color, #e2e8f0)'}`,
                  background: days === d ? 'var(--color-primary-50, #eff6ff)' : 'transparent',
                  color: days === d ? 'var(--color-primary-700, var(--color-primary-700))' : 'var(--text-secondary, #475569)',
                }}
              >
                {t('deviceMgmtBoard.days', { count: d })}
              </button>
            ))}
          </div>
        }
        loading={loading && !hasData}
        error={!loading && error && !hasData ? error : undefined}
        onRetry={load}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
          <StatCardGrid minWidth={170} gap={12}>
            <StatCard title={t('deviceMgmtBoard.total')} value={NUM(overview?.total)} icon={<Server size={18} />} color="primary" />
            <StatCard title={t('deviceMgmtBoard.online')} value={NUM(overview?.online)} icon={<Monitor size={18} />} color="success" />
            <StatCard title={t('deviceMgmtBoard.todayExams')} value={NUM(overview?.todayExams)} icon={<Activity size={18} />} color="info" />
            <StatCard title={t('deviceMgmtBoard.todayUsage')} value={NUM(overview?.todayUsageMin)} suffix={t('deviceMgmtBoard.minute')} icon={<Gauge size={18} />} color="primary" />
            <StatCard title={t('deviceMgmtBoard.faultsToday')} value={NUM(overview?.faultsToday)} icon={<AlertTriangle size={18} />} color={NUM(overview?.faultsToday) > 0 ? 'error' : 'success'} />
            <StatCard title={t('deviceMgmtBoard.maintenanceDue')} value={NUM(overview?.maintenanceDue)} icon={<Wrench size={18} />} color={NUM(overview?.maintenanceDue) > 0 ? 'warning' : 'success'} />
          </StatCardGrid>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-4, 16px)' }}>
            <DashboardCard
              title={t('deviceMgmtBoard.usageTrend')}
              icon={<TrendingUp size={15} />}
              bodyPadding={12}
              flat
              style={{ border: '1px solid var(--border-color, var(--border-color, #e2e8f0))' }}
            >
              <TrendChart
                type="area"
                data={trendData}
                xKey="date"
                series={[{ key: 'count', name: t('deviceMgmtBoard.examCount'), color: 'var(--color-primary-600)' }]}
                height={220}
                testId="device-usage-trend"
              />
            </DashboardCard>

            <DashboardCard
              title={t('deviceMgmtBoard.byRoom')}
              icon={<Monitor size={15} />}
              bodyPadding={0}
              flat
              style={{ border: '1px solid var(--border-color, var(--border-color, #e2e8f0))' }}
            >
              <div style={{ overflowX: 'auto' }}>
                <DataTable
                  rowKey="room"
                  dataSource={rooms?.items ?? []}
                  showPagination={false}
                  showExport={false}
                  showDensity={false}
                  emptyText={t('deviceMgmtBoard.noData')}
                  columns={[
                    { title: t('deviceMgmtBoard.room'), dataIndex: 'room', key: 'room', render: (v: string) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v}</span> },
                    { title: t('deviceMgmtBoard.deviceCount'), dataIndex: 'devices', key: 'devices', render: (v: number) => NUM(v), align: 'right' },
                    { title: t('deviceMgmtBoard.onlineCount'), dataIndex: 'online', key: 'online', render: (v: number) => <span style={{ color: 'var(--color-success-600)', fontWeight: 600 }}>{NUM(v)}</span>, align: 'right' },
                    { title: t('deviceMgmtBoard.examsCount'), dataIndex: 'todayExams', key: 'todayExams', render: (v: number) => NUM(v), align: 'right' },
                  ]}
                />
              </div>
            </DashboardCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-4, 16px)' }}>
            <DashboardCard
              title={t('deviceMgmtBoard.maintCalendar')}
              icon={<CalendarDays size={15} />}
              bodyPadding={12}
              flat
              style={{ border: '1px solid var(--border-color, var(--border-color, #e2e8f0))' }}
              extra={
                calendar ? (
                  <span style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)' }}>
                    {t('deviceMgmtBoard.pending')} {calendar.pendingCount} · {t('deviceMgmtBoard.overdue')} {calendar.overdueCount} · ¥{NUM(calendar.totalCost)}
                  </span>
                ) : null
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)', maxHeight: 320, overflowY: 'auto' }}>
                {(calendar?.months ?? []).map((m) => (
                  <div key={m.month}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-700, var(--color-primary-700))', marginBottom: 6 }}>
                      {m.month} · {m.count}
                    </div>
                    {m.items.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          borderRadius: 6,
                          background: 'var(--bg-primary)',
                          marginBottom: 'var(--space-1, 4px)',
                          fontSize: 12,
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.deviceName}</span>
                        <span style={{ color: 'var(--text-secondary, #64748b)' }}>{String(item.maintenanceDate).slice(0, 10)}</span>
                        <span style={{ color: item.status === 'COMPLETED' ? 'var(--color-success-600)' : 'var(--color-warning-600)' }}>{item.type}</span>
                      </div>
                    ))}
                  </div>
                ))}
                {(calendar?.months ?? []).length === 0 && (
                  <div style={{ padding: 'var(--space-5, 20px)', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)' }}>
                    {t('deviceMgmtBoard.noData')}
                  </div>
                )}
              </div>
            </DashboardCard>

            <DashboardCard
              title={t('deviceMgmtBoard.lifecycleDetail')}
              icon={<Wrench size={15} />}
              bodyPadding={12}
              flat
              style={{ border: '1px solid var(--border-color, var(--border-color, #e2e8f0))' }}
            >
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border-color, var(--border-color, #e2e8f0))', fontSize: 12, marginBottom: 'var(--space-3, 12px)', background: 'var(--bg-card)' }}
              >
                <option value="">{t('deviceMgmtBoard.selectDevice')}</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}{d.code ? ` (${d.code})` : ''}
                  </option>
                ))}
              </select>

              {detailLoading && <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)' }}>{t('deviceMgmtBoard.loading')}</div>}

              {!detailLoading && detail && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2, 8px)', fontSize: 12 }}>
                  {[
                    [t('deviceMgmtBoard.fieldCode'), detail.code ?? '—'],
                    [t('deviceMgmtBoard.fieldModality'), detail.modality ?? '—'],
                    [t('deviceMgmtBoard.fieldManufacturer'), detail.manufacturer ?? '—'],
                    [t('deviceMgmtBoard.fieldLocation'), detail.location ?? '—'],
                    [t('deviceMgmtBoard.fieldState'), detail.state ? t(STATE_LABEL_KEYS[detail.state] ?? detail.state) : '—'],
                    [t('deviceMgmtBoard.todayExams'), String(NUM(detail.todayExams))],
                    [t('deviceMgmtBoard.fieldCreated'), fmtDate(detail.createdAt)],
                    [t('deviceMgmtBoard.fieldUpdated'), fmtDate(detail.updatedAt)],
                  ].map(([label, value]) => (
                    <div key={label} style={{ padding: '7px 10px', background: 'var(--bg-primary)', borderRadius: 6 }}>
                      <div style={{ color: 'var(--text-secondary, #64748b)', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}

              {!detailLoading && !detail && selectedDeviceId && (
                <div style={{ padding: 'var(--space-4, 16px)', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)' }}>{t('deviceMgmtBoard.noData')}</div>
              )}
            </DashboardCard>
          </div>
        </div>
      </DashboardCard>
    </div>
  )
}

export default DeviceMgmtDashboard
