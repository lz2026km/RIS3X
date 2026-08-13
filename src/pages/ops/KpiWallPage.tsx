/**
 * G005 RIS v3.0.6.11-88 Wave6A - 科室 KPI 墙屏 (大屏看板模式)
 * 全屏深色大字体卡片: 检查量 KPI / 工作量 Top10 / 设备占用率 / 危急值 / 及时率准确率
 * 数据源: statsApi / biApi / occupancyApi (复用现有 API, 不重新发明)
 * 自动轮播: 多页签 15s 切换; 数据失败回退空态 + 重试, 不崩溃
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Empty, Spin, Tag } from 'antd'
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Gauge, HeartPulse,
  Monitor, RefreshCw, Stethoscope, TrendingUp, User as UserIcon,
} from 'lucide-react'
import { statsApi, type DailyStatsDto, type WorkloadDto } from '../../services/api/statsApi'
import { biApi, type KpiDto } from '../../services/api/biApi'
import { occupancyApi, type OccupancyRoom } from '../../services/api/occupancyApi'

const AUTO_ROTATE_MS = 15_000
const BG = '#0b1220'
const CARD_BG = 'rgba(255,255,255,0.05)'
const BORDER = 'rgba(148,163,184,0.18)'

function pct(v: number | undefined, digits = 1): string {
  return v == null ? '--' : `${Number(v).toFixed(digits)}%`
}

interface KpiWallData {
  daily: DailyStatsDto | null
  weeklyTotal: number | null
  workload: WorkloadDto[]
  kpi: KpiDto | null
  rooms: OccupancyRoom[]
  hasError: boolean
}

const EMPTY: KpiWallData = { daily: null, weeklyTotal: null, workload: [], kpi: null, rooms: [], hasError: false }

const KpiWallPage: React.FC = () => {
  const [data, setData] = useState<KpiWallData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [retryTick, setRetryTick] = useState(0)
  const [tab, setTab] = useState(0)
  const timerRef = useRef<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [dailyRes, weeklyRes, workloadRes, kpiRes, roomsRes] = await Promise.allSettled([
      statsApi.getDaily(),
      statsApi.getWeekly(),
      statsApi.getWorkload(),
      biApi.getKpi(),
      occupancyApi.getRooms(),
    ])
    const daily = dailyRes.status === 'fulfilled' && dailyRes.value.success ? dailyRes.value.data : null
    const weekly = weeklyRes.status === 'fulfilled' && weeklyRes.value.success
      ? (weeklyRes.value.data as { totalExams?: number } | null)?.totalExams ?? null
      : null
    const workload = workloadRes.status === 'fulfilled' && workloadRes.value.success ? (workloadRes.value.data ?? []) : []
    // biApi 返回 { source, generatedAt, data } 信封 → 解包
    const kpiRaw = kpiRes.status === 'fulfilled' && kpiRes.value.success ? kpiRes.value.data : null
    const kpi: KpiDto | null = kpiRaw && 'data' in kpiRaw ? (kpiRaw.data as KpiDto) : (kpiRaw as KpiDto | null)
    const rooms = roomsRes.status === 'fulfilled' && roomsRes.value.success ? (roomsRes.value.data ?? []) : []
    setData({
      daily,
      weeklyTotal: weekly,
      workload: (Array.isArray(workload) ? workload : []).slice(0, 10),
      kpi,
      rooms: Array.isArray(rooms) ? rooms : [],
      hasError: !daily && !kpi && rooms.length === 0,
    })
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load, retryTick])

  // 自动轮播: 3 页签 15s 切换
  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setTab((t) => (t + 1) % 3)
    }, AUTO_ROTATE_MS)
    return () => { if (timerRef.current) window.clearInterval(timerRef.current) }
  }, [])

  const occupiedRooms = useMemo(() => data.rooms.filter((r) => r.status === 'occupied').length, [data.rooms])
  const occupiedRate = data.rooms.length > 0 ? Math.round((occupiedRooms / data.rooms.length) * 100) : 0

  const topDoctors = useMemo(() =>
    [...data.workload].sort((a, b) => (b.reportCount ?? 0) - (a.reportCount ?? 0)).slice(0, 10),
  [data.workload])

  const kpiCards = useMemo(() => {
    return [
      { label: '今日检查量', value: String(data.daily?.examCount ?? '--'), icon: Activity, color: '#38bdf8' },
      { label: '本周检查量', value: String(data.weeklyTotal ?? '--'), icon: TrendingUp, color: '#818cf8' },
      { label: '本月检查量 (估算)', value: data.daily?.examCount != null ? String(data.daily.examCount * 22) : '--', icon: Stethoscope, color: '#a78bfa' },
      { label: '危急值 (今日)', value: String(data.daily?.criticalCount ?? '--'), icon: AlertTriangle, color: '#f87171' },
      { label: '危急值 SLA 达标率', value: pct(data.kpi?.criticalSlaRate), icon: CheckCircle2, color: '#4ade80' },
      { label: '及时率 (按时完成)', value: pct(data.kpi?.completionRate), icon: Clock, color: '#fbbf24' },
      { label: '报告平均用时', value: data.kpi?.avgReportMinutes != null ? `${data.kpi.avgReportMinutes} min` : '--', icon: Gauge, color: '#2dd4bf' },
      { label: '设备占用率', value: data.rooms.length > 0 ? `${occupiedRate}%` : '--', icon: Monitor, color: '#fb923c' },
    ]
  }, [data, occupiedRate])

  const renderTab0 = () => (
    <div style={{ padding: '48px 40px' }}>
      <div style={{ fontSize: 34, fontWeight: 800, color: '#e2e8f0', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Activity size={30} color="#38bdf8" /> 科室运营核心 KPI
        <Tag color="cyan" style={{ fontSize: 13, padding: '2px 10px' }}>当日快照</Tag>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
        {kpiCards.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.label} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '28px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8', fontSize: 17, marginBottom: 14 }}>
                <Icon size={22} color={c.color} />
                <span>{c.label}</span>
              </div>
              <div style={{ fontSize: 44, fontWeight: 800, color: c.color, lineHeight: 1.1 }}>{c.value}</div>
              <div style={{ marginTop: 10, color: '#64748b', fontSize: 13 }}>
                {c.label === '设备占用率' ? `${occupiedRooms}/${data.rooms.length} 台在用` : c.label === '危急值 SLA 达标率' ? '危急值响应达标比例' : '全科室汇总'}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginTop: 18 }}>
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 22 }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#e2e8f0', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserIcon size={18} color="#818cf8" /> 医生工作量排行 Top 10
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topDoctors.map((d, i) => {
              const max = Math.max(1, ...topDoctors.map((x) => x.reportCount ?? 0))
              return (
                <div key={d.doctorId ?? d.doctorName + i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 28, fontSize: 17, fontWeight: 800, color: i < 3 ? '#fbbf24' : '#64748b' }}>{i + 1}</span>
                  <span style={{ width: 140, fontSize: 17, color: '#cbd5e1' }}>{d.doctorName}</span>
                  <div style={{ flex: 1, height: 14, background: 'rgba(148,163,184,0.15)', borderRadius: 7 }}>
                    <div style={{ width: `${Math.round(((d.reportCount ?? 0) / max) * 100)}%`, height: '100%', background: i < 3 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : '#3b82f6', borderRadius: 7 }} />
                  </div>
                  <span style={{ width: 90, textAlign: 'right', fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>{d.reportCount ?? 0} 份</span>
                </div>
              )
            })}
            {topDoctors.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无工作量数据" style={{ margin: 24 }} />}
          </div>
        </div>
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 22 }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#e2e8f0', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <HeartPulse size={18} color="#f87171" /> 危急值速览
          </div>
          <div style={{ fontSize: 56, fontWeight: 800, color: '#f87171' }}>{data.daily?.criticalCount ?? 0}</div>
          <div style={{ color: '#94a3b8', fontSize: 15, marginBottom: 16 }}>今日危急值报告数</div>
          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14, color: '#cbd5e1', fontSize: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span>平均用时</span><span style={{ fontWeight: 700, color: '#4ade80' }}>{data.daily?.avgTAT != null ? `${data.daily.avgTAT} min` : '--'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span>质控均分</span><span style={{ fontWeight: 700, color: '#fbbf24' }}>{data.daily?.qcAvgScore ?? '--'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>缺陷数</span><span style={{ fontWeight: 700, color: '#f87171' }}>{data.daily?.defectCount ?? '--'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderTab1 = () => {
    const max = Math.max(1, ...topDoctors.map((d) => d.reportCount ?? 0))
    return (
      <div style={{ padding: '48px 40px' }}>
        <div style={{ fontSize: 34, fontWeight: 800, color: '#e2e8f0', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
          <TrendingUp size={30} color="#818cf8" /> 工作量排行
          <Tag color="geekblue" style={{ fontSize: 13, padding: '2px 10px' }}>医生 / 技师 Top 10</Tag>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
          {topDoctors.map((d, i) => (
            <div key={d.doctorId ?? d.doctorName + i} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: 12, background: i < 3 ? 'rgba(251,191,36,0.15)' : 'rgba(59,130,246,0.15)', color: i < 3 ? '#fbbf24' : '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700 }}>
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>{d.doctorName} <span style={{ color: '#64748b', fontSize: 14, fontWeight: 400 }}>{d.department ?? ''}</span></div>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 10, background: 'rgba(148,163,184,0.15)', borderRadius: 5 }}>
                    <div style={{ width: `${Math.round(((d.reportCount ?? 0) / max) * 100)}%`, height: '100%', background: i < 3 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'linear-gradient(90deg,#2563eb,#60a5fa)', borderRadius: 5 }} />
                  </div>
                  <span style={{ fontSize: 28, fontWeight: 700, color: '#e2e8f0' }}>{d.reportCount ?? 0}</span>
                </div>
                <div style={{ marginTop: 6, color: '#94a3b8', fontSize: 14 }}>检查 {d.examCount ?? 0} 项 · 平均 {d.avgTime ?? 0} min/份</div>
              </div>
            </div>
          ))}
          {topDoctors.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无工作量数据" style={{ margin: 40 }} />}
        </div>
      </div>
    )
  }

  const renderTab2 = () => {
    const statusLabel: Record<string, { text: string; color: string }> = {
      idle: { text: '空闲', color: '#4ade80' },
      occupied: { text: '占用中', color: '#f87171' },
      disinfecting: { text: '消毒中', color: '#fbbf24' },
      fault: { text: '故障', color: '#94a3b8' },
    }
    return (
      <div style={{ padding: '48px 40px' }}>
        <div style={{ fontSize: 34, fontWeight: 800, color: '#e2e8f0', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Monitor size={30} color="#fb923c" /> 设备占用率
          <Tag color="orange" style={{ fontSize: 13, padding: '2px 10px' }}>实时 {occupiedRate}% ({occupiedRooms}/{data.rooms.length})</Tag>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
          {data.rooms.map((room) => {
            const s = statusLabel[room.status] ?? { text: room.status, color: '#94a3b8' }
            const inUse = room.status === 'occupied'
            return (
              <div key={room.id} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, borderLeft: `5px solid ${s.color}` }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>{room.roomNo}</div>
                <div style={{ margin: '10px 0', fontSize: 16, color: s.color, fontWeight: 700 }}>{s.text}</div>
                {inUse ? (
                  <>
                    <div style={{ fontSize: 15, color: '#cbd5e1' }}>{room.currentPatient ?? '--'}</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{room.examItem ?? ''}</div>
                    <div style={{ fontSize: 13, color: room.overdue ? '#f87171' : '#94a3b8', marginTop: 6 }}>
                      开始 {room.startTime?.slice(11) ?? '--'} · {room.expectedEnd ? `预计 ${room.expectedEnd.slice(11)}` : ''} {room.overdue ? '· 超时' : ''}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 14, color: '#64748b' }}>{room.status === 'fault' ? '等待维修' : '可接收患者'}</div>
                )}
              </div>
            )
          })}
          {data.rooms.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无设备占用数据" style={{ margin: 40 }} />}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#e2e8f0', position: 'relative' }}>
      {/* 顶部 */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '18px 36px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>
          <span style={{ color: '#38bdf8' }}>放射科</span> KPI 墙屏
          <span style={{ fontSize: 14, color: '#64748b', fontWeight: 400, marginLeft: 14 }}>G005 · 15 秒自动轮播</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' })}
          </div>
          <Button type="primary" ghost icon={<RefreshCw size={14} />} onClick={() => setRetryTick((t) => t + 1)} loading={loading}>刷新</Button>
        </div>
      </div>

      {/* 轮播页签指示 */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', padding: '14px 0 0' }}>
        {['核心 KPI', '工作量排行', '设备占用'].map((label, i) => (
          <button
            key={label}
            onClick={() => setTab(i)}
            style={{
              padding: '6px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              background: tab === i ? '#38bdf8' : 'rgba(148,163,184,0.15)', color: tab === i ? '#0b1220' : '#94a3b8',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <Spin spinning={loading} tip="KPI 数据加载中...">
        {data.hasError ? (
          <div style={{ padding: '80px 40px', textAlign: 'center' }}>
            <Empty
              description={<span style={{ color: '#94a3b8' }}>数据加载失败或为空 (已回退空态)</span>}
              style={{ marginBottom: 16 }}
              image={<AlertTriangle size={48} style={{ opacity: 0.4 }} />}
            />
            <Button type="primary" icon={<RefreshCw size={14} />} onClick={() => setRetryTick((t) => t + 1)}>重试</Button>
          </div>
        ) : (
          <>
            {tab === 0 && renderTab0()}
            {tab === 1 && renderTab1()}
            {tab === 2 && renderTab2()}
          </>
        )}
      </Spin>

      <div style={{ position: 'fixed', bottom: 14, right: 24, fontSize: 12, color: '#475569' }}>
        {new Date().toLocaleTimeString('zh-CN', { hour12: false })}
      </div>
    </div>
  )
}

export default KpiWallPage
