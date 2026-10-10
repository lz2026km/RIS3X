// G005 放射RIS系统 v3.0.6.11-101 Wave 5 (tech-overview) - 技师工作站 V2 收尾
// 功能: ① 患者预约分布 (时段×星期热力图 + 检查类型饼图 + 时段柱状图波峰标注 + 爽约率对比)
//       ② 技师值班大屏 (概览卡片 + 房间状态网格 + 实时状态流, 10s 自动刷新)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Empty, Spin, Tabs, Tag, Tooltip } from 'antd'
import {
  Activity, AlertTriangle, CalendarDays, Clock, Flame, LayoutGrid, Monitor,
  RefreshCw, Siren, TrendingUp, User, Users, Zap,
} from 'lucide-react'
import { techOverviewApi } from '../../services/api/techOverviewApi'
import type {
  AppointmentAttendance, AppointmentDistribution, AppointmentPeak, DashboardOverview,
  DistributionBucket, PeakAnalysis, RoomStatus, RoomStatusEvent, RoomStatusStream,
} from '../../services/api/techOverviewApi'
import { t } from '../../i18n/appI18n'

// ============================================================
// 样式常量 (ops 深色主题, 与 TechOpsPage 对齐)
// ============================================================
const C = {
  bg: '#0d1117',
  panel: '#161b22',
  border: '#30363d',
  text: '#f0f6fc',
  textMid: '#8b949e',
  textLight: '#6e7681',
  blue: '#3b82f6',
  green: '#4ade80',
  orange: '#fbbf24',
  red: '#f87171',
  purple: '#a78bfa',
  teal: '#2dd4bf',
  pink: '#f472b6',
}

const MODALITY_COLORS: Record<string, string> = {
  CT: '#3b82f6',
  MR: '#a78bfa',
  DR: '#4ade80',
  DSA: '#fbbf24',
  MG: '#f472b6',
}

const ROOM_STATE_COLORS: Record<string, string> = {
  IN_USE: C.green,
  IDLE: C.blue,
  MAINTENANCE: C.orange,
  OFFLINE: C.red,
}

const roomStateLabel = (s: string) => t(`techOverview.roomState.${s}`)

const eventLabel = (type: string) => t(`techOverview.event.${type}`)

const EVENT_COLORS: Record<string, string> = {
  EXAM_START: C.blue,
  EXAM_END: C.purple,
  PATIENT_IN: C.teal,
  PATIENT_OUT: C.textMid,
  EMERGENCY: C.red,
  STATE_CHANGE: C.orange,
  MAINTENANCE: C.orange,
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const PERIODS = ['00-03', '03-06', '06-09', '09-12', '12-15', '15-18', '18-21', '21-24']

const fmtTime = (iso: string) => {
  if (!iso) return '--'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const fmtMin = (iso: string) => {
  if (!iso) return '--'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ============================================================
// 确定性哈希 (demo 回退与后端 seed 对齐)
// ============================================================
const fnv1a = (input: string) => {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const DAY_FACTOR = [0.72, 0.95, 1.05, 1.12, 1.15, 1.18, 0.8]
const HOUR_WEIGHTS = [0, 0, 0, 0, 0, 0, 1, 2, 6, 14, 20, 22, 18, 15, 13, 12, 10, 8, 6, 4, 3, 2, 1, 0]
const PATIENT_POOL = ['张伟', '王芳', '李明', '刘洋', '赵敏', '陈杰', '孙丽', '周强', '吴敏', '郑华', '钱进', '冯雪', '朱明', '许峰', '何静', '吕娜', '马建军', '杜文娟', '蒋鹏飞', '沈艳']
const EXAM_POOL: Record<string, string[]> = {
  CT: ['胸部CT平扫', '头颅CT平扫', '腹部CT增强', '腰椎CT平扫', '冠脉CTA'],
  MR: ['腰椎MR平扫', '头颅MR平扫', '膝关节MR平扫', '腹部MR增强', '颈椎MR平扫'],
  DR: ['胸部DR正位', '腰椎正侧位', '膝关节DR正位', '踝关节DR', '腹部立位平片'],
  DSA: ['冠脉造影', '脑血管造影', '下肢动脉造影', '肝动脉介入'],
  MG: ['乳腺钼靶', '乳腺钼靶增强', '乳腺断层合成'],
}

const DEMO_ROOMS = [
  { roomId: 'R-CT1', roomName: 'CT-1 检查室', modality: 'CT', technician: '刘洋' },
  { roomId: 'R-CT2', roomName: 'CT-2 检查室', modality: 'CT', technician: '赵志刚' },
  { roomId: 'R-MR1', roomName: 'MR-1 检查室', modality: 'MR', technician: '孙伟' },
  { roomId: 'R-DR1', roomName: 'DR-1 检查室', modality: 'DR', technician: '王磊' },
  { roomId: 'R-DSA1', roomName: 'DSA-1 检查室', modality: 'DSA', technician: '陈静' },
  { roomId: 'R-MG1', roomName: 'MG-1 检查室', modality: 'MG', technician: '周婷' },
]

const DEMO_TECHS = [
  { id: 'T-001', name: '刘洋', group: 'CT 组' },
  { id: 'T-002', name: '赵志刚', group: 'CT 组' },
  { id: 'T-003', name: '孙伟', group: 'MR 组' },
  { id: 'T-004', name: '王磊', group: 'DR 组' },
  { id: 'T-005', name: '陈静', group: 'DSA 组' },
  { id: 'T-006', name: '周婷', group: 'MG 组' },
  { id: 'T-007', name: '吴强', group: 'CT 组' },
  { id: 'T-008', name: '郑爽', group: 'MR 组' },
]

const addDays = (date: string, offset: number) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

// ============================================================
// Demo 回退构建器 (确定性, 与后端算法对齐)
// ============================================================
interface DemoAppt {
  date: string
  hour: number
  modality: string
  deviceId: string
  state: string
}

function buildDemoAppts(startDate: string, days: number): DemoAppt[] {
  const out: DemoAppt[] = []
  const today = todayStr()
  for (let d = 0; d < days; d++) {
    const date = addDays(startDate, d)
    const isToday = date === today
    const wd = new Date(`${date}T00:00:00Z`).getUTCDay()
    const weekend = wd === 0 || wd === 6
    const factor = DAY_FACTOR[wd] ?? 1
    for (const room of DEMO_ROOMS) {
      const count = Math.max(5, Math.round((8 + (fnv1a(`appt-count:${date}:${room.roomId}`) % 7)) * factor))
      for (let i = 0; i < count; i++) {
        const seed = `appt:${date}:${room.roomId}:${i}`
        let r = fnv1a(seed) % HOUR_WEIGHTS.reduce((a, b) => a + b, 0)
        let hour = 8
        for (let h = 0; h < 24; h++) {
          const w = HOUR_WEIGHTS[h] ?? 0
          if (r < w) {
            hour = h
            break
          }
          r -= w
        }
        if (weekend && hour >= 12) hour = 7 + (fnv1a(`${seed}:wk`) % 5)
        const h100 = fnv1a(`${seed}:state`) % 100
        let state: string
        if (isToday) {
          state = h100 < 12 ? 'SCHEDULED' : h100 < 30 ? 'CONFIRMED' : h100 < 52 ? 'CHECKED_IN' : h100 < 78 ? 'IN_PROGRESS' : 'COMPLETED'
        } else {
          state = h100 < 11 ? 'NO_SHOW' : h100 < 17 ? 'CANCELLED' : 'COMPLETED'
        }
        out.push({ date, hour, modality: room.modality, deviceId: room.roomId, state })
      }
    }
  }
  return out
}

function buildDemoDistribution(days: number): AppointmentDistribution {
  const startDate = addDays(todayStr(), -(days - 1))
  const appts = buildDemoAppts(startDate, days)
  const byModality = new Map<string, number>()
  const byPeriod = new Map<string, number>()
  const byWeekday = new Map<number, number>()
  const byDevice = new Map<string, number>()
  const heatmap = new Map<string, number>()
  const periodOf = (h: number) => (h < 3 ? '00-03' : h < 6 ? '03-06' : h < 9 ? '06-09' : h < 12 ? '09-12' : h < 15 ? '12-15' : h < 18 ? '15-18' : h < 21 ? '18-21' : '21-24')
  for (const a of appts) {
    byModality.set(a.modality, (byModality.get(a.modality) ?? 0) + 1)
    const p = periodOf(a.hour)
    byPeriod.set(p, (byPeriod.get(p) ?? 0) + 1)
    const wd = new Date(`${a.date}T00:00:00Z`).getUTCDay()
    byWeekday.set(wd, (byWeekday.get(wd) ?? 0) + 1)
    byDevice.set(a.deviceId, (byDevice.get(a.deviceId) ?? 0) + 1)
    heatmap.set(`${p}|${wd}`, (heatmap.get(`${p}|${wd}`) ?? 0) + 1)
  }
  const total = appts.length
  const pct = (count: number) => (total > 0 ? Math.round((count / total) * 1000) / 10 : 0)
  return {
    startDate,
    days,
    total,
    seeded: true,
    byModality: [...byModality.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, label: key, count, pct: pct(count) })),
    byPeriod: PERIODS.map((key) => ({ key, label: key, count: byPeriod.get(key) ?? 0, pct: pct(byPeriod.get(key) ?? 0) })),
    byWeekday: WEEKDAYS.map((label, wd) => ({ key: String(wd), label, count: byWeekday.get(wd) ?? 0, pct: pct(byWeekday.get(wd) ?? 0) })),
    byDevice: DEMO_ROOMS.map((r) => ({ key: r.roomId, label: r.roomName, modality: r.modality, count: byDevice.get(r.roomId) ?? 0, pct: pct(byDevice.get(r.roomId) ?? 0) })),
    heatmap: PERIODS.flatMap((p) => WEEKDAYS.map((label, wd) => ({ period: p, weekday: label, count: heatmap.get(`${p}|${wd}`) ?? 0 }))),
  }
}

function buildDemoPeaks(days: number): PeakAnalysis {
  const dist = buildDemoDistribution(days)
  const peaks: AppointmentPeak[] = dist.byPeriod.map((p) => {
    const avg = p.count / days
    let level: AppointmentPeak['level']
    if (p.count > dist.total / PERIODS.length) level = 'HIGH'
    else if (p.count > dist.total / PERIODS.length / 2) level = 'MEDIUM'
    else level = 'LOW'
    return {
      period: p.key,
      hourRange: p.key,
      avgCount: Math.round(avg * 10) / 10,
      maxCount: p.count,
      maxDay: dist.startDate,
      level,
      peakDays: [],
    }
  }).sort((a, b) => b.avgCount - a.avgCount)
  const busiest = peaks[0]
  const busiestWeekday = [...dist.byWeekday].sort((a, b) => b.count - a.count)[0]?.label ?? '周一'
  return {
    startDate: dist.startDate,
    days,
    seeded: true,
    overallAverage: Math.round((dist.total / days / PERIODS.length) * 10) / 10,
    peaks,
    busiestPeriod: busiest?.period ?? '09-12',
    busiestWeekday,
    recommendation: `高峰时段集中在 ${peaks.filter((p) => p.level === 'HIGH').map((p) => p.period).join('、')}, 建议增派技师; ${busiestWeekday} 为周内峰值日`,
  }
}

interface AttCounter {
  attended: number
  noShow: number
  cancelled: number
  upcoming: number
}

function buildDemoAttendance(days: number): AppointmentAttendance {
  const dist = buildDemoDistribution(days)
  const appts = buildDemoAppts(addDays(todayStr(), -(days - 1)), days)
  const byModality = new Map<string, AttCounter>()
  const byWeekday = new Map<number, AttCounter>()
  for (const a of appts) {
    const m = byModality.get(a.modality) ?? { attended: 0, noShow: 0, cancelled: 0, upcoming: 0 }
    const wd = new Date(`${a.date}T00:00:00Z`).getUTCDay()
    const w = byWeekday.get(wd) ?? { attended: 0, noShow: 0, cancelled: 0, upcoming: 0 }
    if (a.state === 'NO_SHOW') { m.noShow++; w.noShow++ }
    else if (a.state === 'CANCELLED') { m.cancelled++; w.cancelled++ }
    else if (a.state === 'COMPLETED' || a.state === 'CHECKED_IN' || a.state === 'IN_PROGRESS') { m.attended++; w.attended++ }
    else { m.upcoming++; w.upcoming++ }
    byModality.set(a.modality, m)
    byWeekday.set(wd, w)
  }
  const toItem = (label: string, key: string, v: AttCounter) => {
    const total = v.attended + v.noShow + v.cancelled + v.upcoming
    return { key, label, total, attended: v.attended, noShow: v.noShow, cancelled: v.cancelled, upcoming: v.upcoming, noShowRate: v.attended + v.noShow > 0 ? Math.round((v.noShow / (v.attended + v.noShow)) * 1000) / 10 : 0 }
  }
  const modalityItems = [...byModality.entries()].map(([k, v]) => toItem(k, k, v))
  const weekdayItems = WEEKDAYS.map((label, wd) => toItem(label, String(wd), byWeekday.get(wd) ?? { attended: 0, noShow: 0, cancelled: 0, upcoming: 0 }))
  const attended = modalityItems.reduce((a, m) => a + m.attended, 0)
  const noShow = modalityItems.reduce((a, m) => a + m.noShow, 0)
  const cancelled = modalityItems.reduce((a, m) => a + m.cancelled, 0)
  const upcoming = modalityItems.reduce((a, m) => a + m.upcoming, 0)
  return {
    startDate: dist.startDate,
    days,
    seeded: true,
    total: attended + noShow + cancelled + upcoming,
    attended,
    noShow,
    cancelled,
    upcoming,
    noShowRate: attended + noShow > 0 ? Math.round((noShow / (attended + noShow)) * 1000) / 10 : 0,
    attendanceRate: dist.total > 0 ? Math.round((attended / dist.total) * 1000) / 10 : 0,
    byModality: modalityItems,
    byWeekday: weekdayItems,
  }
}

function buildDemoOverview(): DashboardOverview {
  const date = todayStr()
  const start = fnv1a(`duty:${date}`) % DEMO_TECHS.length
  const shifts = ['DAY', 'DAY', 'DAY', 'DAY', 'NIGHT', 'NIGHT', 'BACKUP', 'OFF']
  const shiftLabels: Record<string, string> = { DAY: '白班', NIGHT: '夜班', WEEKEND: '周末班', BACKUP: '备班', OFF: '休班' }
  const duty = DEMO_TECHS.map((t, i) => {
    const shift = shifts[(i + start) % shifts.length] as string
    return { technicianId: t.id, name: t.name, group: t.group, shift, shiftLabel: shiftLabels[shift] ?? shift }
  })
  const now = new Date()
  const rooms: RoomStatus[] = DEMO_ROOMS.map((r) => {
    const h = fnv1a(`${date}:${r.roomId}:state`) % 100
    let state: 'IN_USE' | 'IDLE' | 'MAINTENANCE' | 'OFFLINE' = h < 8 ? 'MAINTENANCE' : h < 12 ? 'OFFLINE' : h < 58 ? 'IN_USE' : 'IDLE'
    if (r.roomId === 'R-CT1' && state === 'IDLE' && new Date(`${date}T00:00:00Z`).getUTCDay() !== 0 && new Date(`${date}T00:00:00Z`).getUTCDay() !== 6) state = 'IN_USE'
    const currentExam = state === 'IN_USE'
      ? {
          patientName: PATIENT_POOL[fnv1a(`${date}:${r.roomId}:pt`) % PATIENT_POOL.length] as string,
          examItem: (EXAM_POOL[r.modality] ?? ['影像检查'])[fnv1a(`${date}:${r.roomId}:item`) % (EXAM_POOL[r.modality] ?? ['影像检查']).length] as string,
          startedAt: new Date(now.getTime() - (4 + (fnv1a(`${date}:${r.roomId}:since`) % 22)) * 60000).toISOString(),
          progressPct: Math.min(95, 28 + (fnv1a(`${date}:${r.roomId}:prog`) % 60)),
        }
      : null
    return {
      roomId: r.roomId,
      roomName: r.roomName,
      modality: r.modality,
      technician: r.technician,
      state,
      currentExam,
      queueCount: (fnv1a(`${date}:${r.roomId}:q`) % 4) + (state === 'IDLE' ? 0 : 1),
      todayExams: 6 + (fnv1a(`${date}:${r.roomId}:exams`) % 12),
    }
  })
  const inUse = rooms.filter((r) => r.state === 'IN_USE').length
  return {
    date,
    generatedAt: now.toISOString(),
    seeded: true,
    onDutyCount: duty.filter((d) => d.shift !== 'OFF').length,
    offDutyCount: DEMO_TECHS.length - duty.filter((d) => d.shift !== 'OFF').length,
    technicianTotal: DEMO_TECHS.length,
    roomCount: DEMO_ROOMS.length,
    inUseRooms: inUse,
    idleRooms: rooms.filter((r) => r.state === 'IDLE').length,
    inProgressCount: inUse,
    waitingCount: rooms.reduce((a, r) => a + r.queueCount, 0),
    pendingEmergencyCount: 1 + (fnv1a(`emg:${date}`) % 3),
    duty,
    rooms,
  }
}

function buildDemoStream(): RoomStatusStream {
  const ov = buildDemoOverview()
  const base = new Date(ov.generatedAt)
  const events: RoomStatusEvent[] = []
  const typePool: RoomStatusEvent['type'][] = ['PATIENT_IN', 'PATIENT_OUT', 'EXAM_START', 'EXAM_END', 'STATE_CHANGE']
  let seq = 0
  for (const room of ov.rooms) {
    const n = 2 + (fnv1a(`${room.roomId}:evt`) % 2)
    for (let i = 0; i < n; i++) {
      const h = fnv1a(`${room.roomId}:evt:${i}`)
      const ts = new Date(base.getTime() - (5 + (h % 115)) * 60000).toISOString()
      let type = typePool[h % typePool.length] as RoomStatusEvent['type']
      let patientName: string | null = null
      let examItem: string | null = null
      let note = ''
      if (room.state === 'IN_USE' && i === 0) {
        type = 'EXAM_START'
        patientName = room.currentExam?.patientName ?? null
        examItem = room.currentExam?.examItem ?? null
        note = '检查开始, 采集进行中'
      } else if (['EXAM_START', 'EXAM_END', 'PATIENT_IN', 'PATIENT_OUT'].includes(type)) {
        const idx = (h >> 8) % PATIENT_POOL.length
        patientName = PATIENT_POOL[idx] as string
        examItem = (EXAM_POOL[room.modality] ?? ['影像检查'])[idx % (EXAM_POOL[room.modality] ?? ['影像检查']).length] as string
        note = type === 'EXAM_START' ? '检查开始' : type === 'EXAM_END' ? '检查结束, 等待出片' : type === 'PATIENT_IN' ? '患者进入检查室' : '患者离开检查室'
      } else {
        note = room.state === 'IDLE' ? '设备转空闲, 可接下一单' : room.state === 'MAINTENANCE' ? '设备维护中, 暂停接单' : '设备运行中'
      }
      events.push({ id: `EVT-${String(seq++).padStart(3, '0')}`, roomId: room.roomId, roomName: room.roomName, modality: room.modality, type, patientName, examItem, technician: room.technician, timestamp: ts, note })
    }
  }
  if (ov.pendingEmergencyCount > 0) {
    const room = ov.rooms[fnv1a(`emg-ev:${ov.date}`) % ov.rooms.length]!
    events.push({
      id: `EVT-${String(seq++).padStart(3, '0')}`,
      roomId: room.roomId,
      roomName: room.roomName,
      modality: room.modality,
      type: 'EMERGENCY',
      patientName: PATIENT_POOL[fnv1a(`emg-pt:${ov.date}`) % PATIENT_POOL.length] as string,
      examItem: '急诊加急检查',
      technician: room.technician,
      timestamp: new Date(base.getTime() - 2 * 60000).toISOString(),
      note: '急诊插入, 已加急排程',
    })
  }
  events.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  return { generatedAt: ov.generatedAt, seeded: true, rooms: ov.rooms, events: events.slice(0, 40) }
}

// ============================================================
// 时段×星期热力图
// ============================================================
function PeriodWeekdayHeatmap({ heatmap, total }: { heatmap: Array<{ period: string; weekday: string; count: number }>; total: number }) {
  const max = Math.max(...heatmap.map((c) => c.count), 1)
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640, fontSize: 11 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '6px 10px', color: C.textMid, fontWeight: 500, minWidth: 60 }}>{t('techOverview.thPeriod')}</th>
            {WEEKDAYS.map((w) => (
              <th key={w} style={{ padding: '4px 2px', color: C.text, fontWeight: 500, width: 72 }}>{w}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((p) => (
            <tr key={p}>
              <td style={{ padding: '5px 10px', whiteSpace: 'nowrap', color: C.textMid, fontWeight: 500 }}>{p}</td>
              {WEEKDAYS.map((w) => {
                const cell = heatmap.find((c) => c.period === p && c.weekday === w)
                const count = cell?.count ?? 0
                const intensity = count / max
                return (
                  <td key={w} style={{ padding: 0 }}>
                    <Tooltip title={`${t('techOverview.periodCell', { weekday: w, period: p, count: count })}${total > 0 ? ` (${Math.round((count / total) * 1000) / 10}%)` : ''}`}>
                      <div style={{
                        height: 34, margin: 1.5, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: intensity > 0 ? `rgba(59,130,246,${Math.max(0.08, intensity)})` : 'rgba(255,255,255,0.02)',
                        color: intensity > 0.45 ? '#fff' : C.textMid,
                        fontWeight: intensity > 0.45 ? 700 : 400,
                        border: intensity > 0.75 ? `1px solid ${C.orange}` : intensity > 0 ? '1px solid rgba(59,130,246,0.4)' : `1px solid ${C.border}`,
                      }}>
                        {count > 0 ? count : ''}
                      </div>
                    </Tooltip>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 11, color: C.textMid }}>
        {t('techOverview.heatmapLegend')} {[0.1, 0.3, 0.55, 0.8, 1].map((r) => (
          <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: `rgba(59,130,246,${r})`, display: 'inline-block' }} />
            {r === 1 ? t('techOverview.peakLabel') : `~${Math.round(max * r)}`}
          </span>
        ))}
        <span style={{ marginLeft: 8 }}>{t('techOverview.heatmapTotal', { count: total })}</span>
      </div>
    </div>
  )
}

// ============================================================
// 检查类型环形饼图 (纯 SVG)
// ============================================================
function DonutChart({ buckets }: { buckets: DistributionBucket[] }) {
  const total = buckets.reduce((a, b) => a + b.count, 0)
  const R = 70
  const CX = 90
  const CY = 90
  const SW = 26
  if (total <= 0) return <Empty description={t('techOverview.noData')} style={{ color: C.textMid }} />
  let angle = -90
  const segs = buckets.filter((b) => b.count > 0).map((b) => {
    const start = angle
    const sweep = (b.count / total) * 360
    angle += sweep
    return { ...b, start, sweep }
  })
  const polar = (deg: number, r: number) => {
    const rad = (deg * Math.PI) / 180
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
  }
  return (
    <svg width="100%" viewBox="0 0 180 140" style={{ display: 'block' }}>
      {segs.map((s) => {
        const p1 = polar(s.start, R)
        const p2 = polar(s.start + Math.min(359.99, s.sweep), R)
        const p3 = polar(s.start + s.sweep, R - SW)
        const p4 = polar(s.start, R - SW)
        const large = s.sweep > 180 ? 1 : 0
        const d = `M ${p1.x} ${p1.y} A ${R} ${R} 0 ${large} 1 ${p2.x} ${p2.y} L ${p4.x} ${p4.y} A ${R - SW} ${R - SW} 0 ${large} 0 ${p3.x} ${p3.y} Z`
        return (
          <path key={s.key} d={d} fill={MODALITY_COLORS[s.key] ?? C.blue} stroke={C.panel} strokeWidth={1}>
            <title>{`${s.label}: ${s.count} 例 (${s.pct}%)`}</title>
          </path>
        )
      })}
      <text x={CX} y={CY - 4} textAnchor="middle" fill={C.text} fontSize={20} fontWeight={700}>{total}</text>
      <text x={CX} y={CY + 14} textAnchor="middle" fill={C.textMid} fontSize={10}>{t('techOverview.totalLabel')}</text>
    </svg>
  )
}

// ============================================================
// 时段柱状图 + 波峰标注
// ============================================================
function PeriodBars({ buckets, peaks }: { buckets: DistributionBucket[]; peaks: PeakAnalysis | null }) {
  const W = 640
  const H = 210
  const PAD_L = 36
  const PAD_R = 14
  const PAD_T = 22
  const PAD_B = 26
  const peakList = peaks?.peaks ?? []
  const max = Math.max(...buckets.map((b) => b.count), 1)
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B
  const step = innerW / buckets.length
  const barW = Math.max(22, step * 0.6)
  const levelColor = (period: string) => {
    const p = peakList.find((x) => x.period === period)
    if (p?.level === 'HIGH') return C.red
    if (p?.level === 'MEDIUM') return C.orange
    return C.blue
  }
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {[0, 0.25, 0.5, 0.75, 1].map((g) => (
        <g key={g}>
          <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + innerH - g * innerH} y2={PAD_T + innerH - g * innerH} stroke="#21262d" strokeDasharray="3 3" />
          <text x={PAD_L - 4} y={PAD_T + innerH - g * innerH + 3} fill={C.textLight} fontSize={9} textAnchor="end">{Math.round(max * g)}</text>
        </g>
      ))}
      {buckets.map((b, i) => {
        const x = PAD_L + i * step + (step - barW) / 2
        const h = (b.count / max) * innerH
        const y = PAD_T + innerH - h
        const peak = peakList.find((p) => p.period === b.key)
        return (
          <g key={b.key}>
            {peak?.level === 'HIGH' && (
              <g>
                <line x1={x + barW / 2} x2={x + barW / 2} y1={y - 12} y2={y + 2} stroke={C.red} strokeWidth={1} strokeDasharray="2 2" />
                <text x={x + barW / 2} y={y - 16} fill={C.red} fontSize={9} textAnchor="middle" fontWeight={700}>{t('techOverview.peakLabel')}</text>
              </g>
            )}
            <rect x={x} y={y} width={barW} height={Math.max(1, h)} rx={3} fill={levelColor(b.key)} opacity={0.9}>
              <title>{`${b.key} 时段: ${b.count} 例 (${b.pct}%)`}</title>
            </rect>
            <text x={x + barW / 2} y={y - 3} fill={C.text} fontSize={9} textAnchor="middle">{b.count}</text>
            <text x={x + barW / 2} y={H - 8} fill={C.textLight} fontSize={9} textAnchor="middle">{b.key}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ============================================================
// 值班大屏: 房间状态网格
// ============================================================
function RoomGrid({ rooms }: { rooms: RoomStatus[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
      {rooms.map((r) => (
        <div key={r.roomId} style={{
          background: C.panel, border: `1px solid ${r.state === 'IN_USE' ? C.green : r.state === 'MAINTENANCE' ? C.orange : r.state === 'OFFLINE' ? C.red : C.border}`,
          borderRadius: 10, padding: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{r.roomName}</span>
              <Tag color={MODALITY_COLORS[r.modality]} style={{ marginRight: 0 }}>{r.modality}</Tag>
            </div>
            <span style={{
              fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 10,
              background: `${ROOM_STATE_COLORS[r.state]}22`, color: ROOM_STATE_COLORS[r.state],
              border: `1px solid ${ROOM_STATE_COLORS[r.state]}`,
            }}>
              {roomStateLabel(r.state)}
            </span>
          </div>
          <div style={{ fontSize: 12, color: C.textMid, marginBottom: 10 }}>
            {t('techOverview.roomTech')} <b style={{ color: C.text }}>{r.technician}</b>
            <span style={{ margin: '0 8px' }}>·</span>
            {t('techOverview.roomToday')} <b style={{ color: C.text }}>{r.todayExams}</b> {t('techOverview.caseUnit2')}
            <span style={{ margin: '0 8px' }}>·</span>
            {t('techOverview.roomQueue')} <b style={{ color: C.orange }}>{r.queueCount}</b> {t('techOverview.people')}
          </div>
          {r.currentExam ? (
            <div style={{ background: '#0d1117', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 11, color: C.textLight, marginBottom: 4 }}>{t('techOverview.inProgressExam', { time: fmtMin(r.currentExam.startedAt) })}</div>
              <div style={{ fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: C.text, fontWeight: 600 }}>{r.currentExam.patientName}</span>
                <span style={{ color: C.textMid, marginLeft: 6 }}>{r.currentExam.examItem}</span>
              </div>
              <div style={{ background: C.bg, borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div style={{ width: `${r.currentExam.progressPct}%`, height: 6, background: C.green, borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 10, color: C.textLight, marginTop: 3 }}>{t('techOverview.progressPct', { pct: r.currentExam.progressPct })}</div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: C.textLight, padding: '6px 0' }}>
              {r.state === 'MAINTENANCE' ? t('techOverview.maintenanceIdle') : r.state === 'OFFLINE' ? t('techOverview.offlineNotified') : t('techOverview.idleWait')}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ============================================================
// 值班大屏: 实时状态流
// ============================================================
function EventStream({ events }: { events: RoomStatusEvent[] }) {
  return (
    <div style={{ maxHeight: 460, overflowY: 'auto', paddingRight: 4 }}>
      {events.length === 0 ? (
        <Empty description={t('techOverview.noEvents')} style={{ color: C.textMid }} />
      ) : (
        events.map((e) => (
          <div key={e.id} style={{ display: 'flex', gap: 10, padding: '7px 2px', borderBottom: `1px solid ${C.border}`, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 11, color: C.textLight, width: 52, flexShrink: 0, paddingTop: 2 }}>{fmtTime(e.timestamp)}</div>
            <Tag color={EVENT_COLORS[e.type] ?? C.blue} style={{ marginRight: 0, flexShrink: 0, marginTop: 0 }}>{eventLabel(e.type)}</Tag>
            <div style={{ fontSize: 12, color: C.text, minWidth: 0 }}>
              <b>{e.roomName}</b>
              <span style={{ color: C.textMid, margin: '0 6px' }}>·</span>
              <span style={{ color: C.textLight }}>{e.technician}</span>
              {e.patientName && (
                <span style={{ color: C.textMid, margin: '0 6px' }}>·</span>
              )}
              {e.patientName && <span style={{ color: e.type === 'EMERGENCY' ? C.red : C.text }}>{e.patientName}</span>}
              {e.examItem && <span style={{ color: C.textMid }}> ({e.examItem})</span>}
              <div style={{ color: C.textLight, fontSize: 11, marginTop: 2 }}>{e.note}</div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ============================================================
// 主页面
// ============================================================
export default function TechOverviewPage() {
  const [days, setDays] = useState(30)
  const [dist, setDist] = useState<AppointmentDistribution | null>(null)
  const [peaks, setPeaks] = useState<PeakAnalysis | null>(null)
  const [att, setAtt] = useState<AppointmentAttendance | null>(null)
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [stream, setStream] = useState<RoomStatusStream | null>(null)
  const [loading, setLoading] = useState(true)
  const [dataSource, setDataSource] = useState<'api' | 'demo'>('demo')
  const [lastSync, setLastSync] = useState<string>('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadDistribution = useCallback(async (d: number) => {
    try {
      const [distRes, peaksRes, attRes] = await Promise.all([
        techOverviewApi.distribution(d),
        techOverviewApi.peaks(d),
        techOverviewApi.attendance(d),
      ])
      if (!distRes.success || !peaksRes.success || !attRes.success) throw new Error('api failed')
      setDist(distRes.data)
      setPeaks(peaksRes.data)
      setAtt(attRes.data)
      setDataSource('api')
    } catch {
      setDist(buildDemoDistribution(d))
      setPeaks(buildDemoPeaks(d))
      setAtt(buildDemoAttendance(d))
      setDataSource('demo')
    }
  }, [])

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [ovRes, stRes] = await Promise.all([techOverviewApi.overview(), techOverviewApi.rooms()])
      if (!ovRes.success || !stRes.success) throw new Error('api failed')
      setOverview(ovRes.data)
      setStream(stRes.data)
      setDataSource('api')
    } catch {
      setOverview(buildDemoOverview())
      setStream(buildDemoStream())
      setDataSource('demo')
    } finally {
      if (!silent) setLoading(false)
      setLastSync(new Date().toLocaleTimeString('zh-CN', { hour12: false }))
    }
  }, [])

  useEffect(() => {
    void loadDistribution(days)
    void loadDashboard()
  }, [days, loadDistribution, loadDashboard])

  // 值班大屏 10s 实时刷新
  useEffect(() => {
    timerRef.current = setInterval(() => {
      void loadDashboard(true)
    }, 10000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [loadDashboard])

  const heatmapData = useMemo(() => dist?.heatmap ?? [], [dist])
  const peakBuckets = useMemo(() => dist?.byPeriod ?? [], [dist])
  const busyPeriod = peaks?.busiestPeriod ?? '--'
  const busyWeekday = peaks?.busiestWeekday ?? '--'

  const renderKpiCards = () => (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
      {[
        { title: t('techOverview.kpiTotalAppt'), value: dist?.total ?? 0, sub: t('techOverview.daysWindow', { days }), icon: <CalendarDays size={20} />, color: C.blue },
        { title: t('techOverview.kpiPeak'), value: busyPeriod, sub: t('techOverview.peakSub', { count: peaks?.peaks[0]?.avgCount ?? 0, day: busyWeekday }), icon: <Flame size={20} />, color: C.red },
        { title: t('techOverview.kpiNoShowRate'), value: `${att?.noShowRate ?? 0}%`, sub: t('techOverview.attSub', { count: att?.attended ?? 0, noShow: att?.noShow ?? 0 }), icon: <TrendingUp size={20} />, color: C.orange },
        { title: t('techOverview.kpiAttRate'), value: `${att?.attendanceRate ?? 0}%`, sub: t('techOverview.cancelSub', { count: att?.cancelled ?? 0, upcoming: att?.upcoming ?? 0 }), icon: <Activity size={20} />, color: C.green },
      ].map((kpi) => (
        <div key={kpi.title} style={{ flex: 1, minWidth: 160, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: C.textMid }}>{kpi.title}</span>
            <span style={{ color: kpi.color }}>{kpi.icon}</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{kpi.value}</div>
          <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>{kpi.sub}</div>
        </div>
      ))}
    </div>
  )

  // ================= Tab 1: 患者预约分布 =================
  const renderDistribution = () => (
    <div>
      {renderKpiCards()}

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LayoutGrid size={16} color={C.blue} />
            <span style={{ fontWeight: 600 }}>{t('techOverview.heatmapTitle')}</span>
            {dist?.seeded && <Tag color="orange" style={{ marginLeft: 4 }}>{t('techOverview.seed')}</Tag>}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {[14, 30, 60].map((d) => (
              <Button key={d} size="small" type={days === d ? 'primary' : 'default'} onClick={() => setDays(d)}>{t('techOverview.daysUnit', { days: d })}</Button>
            ))}
          </div>
        </div>
        <Spin spinning={loading}>
          <PeriodWeekdayHeatmap heatmap={heatmapData} total={dist?.total ?? 0} />
        </Spin>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(480px,1fr))', gap: 16, marginBottom: 16 }}>
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Monitor size={15} color={C.purple} />
            <span style={{ fontWeight: 600 }}>{t('techOverview.modalityDist')}</span>
            <span style={{ fontSize: 12, color: C.textLight }}>{t('techOverview.modalityCount', { count: dist?.byModality.length ?? 0 })}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ width: 220, flexShrink: 0 }}>
              <DonutChart buckets={dist?.byModality ?? []} />
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              {(dist?.byModality ?? []).map((b) => (
                <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                  <span style={{ width: 34, fontWeight: 600, color: MODALITY_COLORS[b.key] ?? C.blue }}>{b.key}</span>
                  <div style={{ flex: 1, background: C.bg, borderRadius: 4, height: 10, overflow: 'hidden' }}>
                    <div style={{ width: `${b.pct}%`, height: 10, background: MODALITY_COLORS[b.key] ?? C.blue, borderRadius: 4 }} />
                  </div>
                  <span style={{ width: 70, textAlign: 'right', fontSize: 12, color: C.textMid }}>{t('techOverview.caseUnit', { count: b.count, pct: b.pct })}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Clock size={15} color={C.teal} />
            <span style={{ fontWeight: 600 }}>{t('techOverview.periodTitle')}</span>
            <span style={{ fontSize: 12, color: C.textLight }}>{t('techOverview.periodHint')}</span>
          </div>
          <PeriodBars buckets={peakBuckets} peaks={peaks} />
          <div style={{ fontSize: 12, color: C.textLight, lineHeight: 1.6, marginTop: 4 }}>
            <span style={{ color: C.orange, fontWeight: 600 }}>{t('techOverview.peakAnalysis')}</span>
            {peaks?.recommendation ?? ''}
          </div>
        </div>
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Users size={15} color={C.green} />
          <span style={{ fontWeight: 600 }}>{t('techOverview.attVsShow')}</span>
          <span style={{ fontSize: 12, color: C.textLight }}>{t('techOverview.attHint')}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720, fontSize: 12 }}>
            <thead>
              <tr style={{ color: C.textMid, borderBottom: `1px solid ${C.border}` }}>
                <th style={{ textAlign: 'left', padding: '6px 10px' }}>{t('techOverview.thExamType')}</th>
                <th style={{ textAlign: 'left', padding: '6px 10px' }}>{t('techOverview.thApptCount')}</th>
                <th style={{ textAlign: 'left', padding: '6px 10px' }}>{t('techOverview.thAttended')}</th>
                <th style={{ textAlign: 'left', padding: '6px 10px' }}>{t('techOverview.thNoShow')}</th>
                <th style={{ textAlign: 'left', padding: '6px 10px' }}>{t('techOverview.thCancelled')}</th>
                <th style={{ textAlign: 'left', padding: '6px 10px', minWidth: 180 }}>{t('techOverview.thNoShowRate')}</th>
              </tr>
            </thead>
            <tbody>
              {(att?.byModality ?? []).map((m) => (
                <tr key={m.key} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: MODALITY_COLORS[m.key] ?? C.text }}>{m.key}</td>
                  <td style={{ padding: '8px 10px', color: C.text }}>{m.total}</td>
                  <td style={{ padding: '8px 10px', color: C.green }}>{m.attended}</td>
                  <td style={{ padding: '8px 10px', color: m.noShow > 0 ? C.orange : C.textMid }}>{m.noShow}</td>
                  <td style={{ padding: '8px 10px', color: C.textMid }}>{m.cancelled}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, background: C.bg, borderRadius: 4, height: 8, overflow: 'hidden', minWidth: 90 }}>
                        <div style={{ width: `${m.noShowRate}%`, height: 8, background: m.noShowRate >= 15 ? C.red : m.noShowRate >= 10 ? C.orange : C.green, borderRadius: 4 }} />
                      </div>
                      <span style={{ fontWeight: 700, color: m.noShowRate >= 15 ? C.red : m.noShowRate >= 10 ? C.orange : C.green, width: 42, textAlign: 'right' }}>{m.noShowRate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  // ================= Tab 2: 技师值班大屏 =================
  const renderDashboard = () => (
    <div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          { title: t('techOverview.kpiOnDuty'), value: overview?.onDutyCount ?? 0, sub: t('techOverview.onDutySub', { count: overview?.offDutyCount ?? 0, total: overview?.technicianTotal ?? 0 }), icon: <User size={20} />, color: C.blue },
          { title: t('techOverview.kpiInProgress'), value: overview?.inProgressCount ?? 0, sub: t('techOverview.roomSub', { inUse: overview?.inUseRooms ?? 0, idle: overview?.idleRooms ?? 0 }), icon: <Monitor size={20} />, color: C.green },
          { title: t('techOverview.kpiWaiting'), value: overview?.waitingCount ?? 0, sub: t('techOverview.waitingSub'), icon: <Users size={20} />, color: C.orange },
          { title: t('techOverview.kpiEmergency'), value: overview?.pendingEmergencyCount ?? 0, sub: t('techOverview.emgSub'), icon: <Siren size={20} />, color: C.red },
        ].map((kpi) => (
          <div key={kpi.title} style={{ flex: 1, minWidth: 160, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: C.textMid }}>{kpi.title}</span>
              <span style={{ color: kpi.color }}>{kpi.icon}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{kpi.value}</div>
            <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LayoutGrid size={16} color={C.blue} />
            <span style={{ fontWeight: 600 }}>{t('techOverview.todayDuty')}</span>
            <span style={{ fontSize: 12, color: C.textLight }}>{t('techOverview.dutyDate', { date: overview?.date ?? '' })}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(overview?.duty ?? []).map((d) => (
              <Tag key={d.technicianId} color={d.shift === 'OFF' ? 'default' : d.shift === 'NIGHT' ? 'purple' : d.shift === 'BACKUP' ? 'cyan' : 'blue'} style={{ marginRight: 0 }}>
                {d.name} · {d.shiftLabel}
              </Tag>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Monitor size={16} color={C.teal} />
            <span style={{ fontWeight: 600 }}>{t('techOverview.roomStatus')}</span>
            {overview?.seeded && <Tag color="orange" style={{ marginLeft: 4 }}>{t('techOverview.seed')}</Tag>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {overview?.pendingEmergencyCount ? (
              <Tag color="red" icon={<AlertTriangle size={11} />}>{t('techOverview.emgPending', { count: overview.pendingEmergencyCount })}</Tag>
            ) : null}
            <span style={{ fontSize: 11, color: C.textLight }}>{t('techOverview.autoRefresh', { time: lastSync })}</span>
            <Button size="small" icon={<RefreshCw size={13} />} onClick={() => void loadDashboard(true)}>{t('techOverview.refresh')}</Button>
          </div>
        </div>
        <Spin spinning={loading}>
          <RoomGrid rooms={stream?.rooms ?? []} />
        </Spin>
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Zap size={15} color={C.orange} />
          <span style={{ fontWeight: 600 }}>{t('techOverview.streamTitle')}</span>
          <span style={{ fontSize: 12, color: C.textLight }}>{t('techOverview.streamHint', { count: stream?.events.length ?? 0 })}</span>
        </div>
        <EventStream events={stream?.events ?? []} />
      </div>
    </div>
  )

  return (
    <div data-testid="tech-overview-page" style={{ background: C.bg, color: C.text, fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      {/* ================= 头部 ================= */}
      <div style={{ background: 'linear-gradient(135deg,#0f766e,#0f172a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LayoutGrid size={24} />
          <span style={{ fontSize: 20, fontWeight: 600 }}>{t('techOverview.title')}</span>
          <span style={{
            fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 10,
            background: dataSource === 'api' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.25)',
            color: dataSource === 'api' ? C.green : C.orange,
            border: `1px solid ${dataSource === 'api' ? '#22c55e' : '#f59e0b'}`,
          }}>
            {dataSource === 'api' ? t('techOverview.apiLive') : t('techOverview.demoData')}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{t('techOverview.headerDesc')}</span>
          <span title={t('techOverview.refreshData')} style={{ cursor: 'pointer', display: 'inline-flex' }} onClick={() => { void loadDistribution(days); void loadDashboard() }}>
            <RefreshCw size={16} />
          </span>
        </div>
      </div>

      <Tabs
        style={{ padding: '0 24px' }}
        items={[
          {
            key: 'distribution',
            label: <span><CalendarDays size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{t('techOverview.tabDistribution')}</span>,
            children: renderDistribution(),
          },
          {
            key: 'dashboard',
            label: <span><Monitor size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{t('techOverview.tabDashboard')}</span>,
            children: renderDashboard(),
          },
        ]}
      />
    </div>
  )
}
