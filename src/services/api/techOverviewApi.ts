import { api } from './client'

// Tech-Overview (技师工作站 V2 收尾: 患者预约分布 + 技师值班大屏) API
// Backend: GET /tech-overview/meta | /appointments/distribution|peaks|attendance | /dashboard/overview|rooms
// 孤儿模块: DB 不可用自动回退确定性种子 (seeded=true)

export type RoomState = 'IN_USE' | 'IDLE' | 'MAINTENANCE' | 'OFFLINE'

export interface DistributionBucket {
  key: string
  label: string
  count: number
  pct: number
}

export interface DeviceBucket extends DistributionBucket {
  modality: string
}

export interface HeatmapCell {
  period: string
  weekday: string
  count: number
}

export interface AppointmentDistribution {
  startDate: string
  days: number
  total: number
  seeded: boolean
  byModality: DistributionBucket[]
  byPeriod: DistributionBucket[]
  byWeekday: DistributionBucket[]
  byDevice: DeviceBucket[]
  heatmap: HeatmapCell[]
}

export interface PeakDay {
  date: string
  weekday: string
  count: number
}

export interface AppointmentPeak {
  period: string
  hourRange: string
  avgCount: number
  maxCount: number
  maxDay: string
  level: 'HIGH' | 'MEDIUM' | 'LOW'
  peakDays: PeakDay[]
}

export interface PeakAnalysis {
  startDate: string
  days: number
  seeded: boolean
  overallAverage: number
  peaks: AppointmentPeak[]
  busiestPeriod: string
  busiestWeekday: string
  recommendation: string
}

export interface AttendanceItem {
  key: string
  label: string
  total: number
  attended: number
  noShow: number
  cancelled: number
  upcoming: number
  noShowRate: number
}

export interface AppointmentAttendance {
  startDate: string
  days: number
  seeded: boolean
  total: number
  attended: number
  noShow: number
  cancelled: number
  upcoming: number
  noShowRate: number
  attendanceRate: number
  byModality: AttendanceItem[]
  byWeekday: AttendanceItem[]
}

export interface DutyItem {
  technicianId: string
  name: string
  group: string
  shift: string
  shiftLabel: string
}

export interface RoomExam {
  patientName: string
  examItem: string
  startedAt: string
  progressPct: number
}

export interface RoomStatus {
  roomId: string
  roomName: string
  modality: string
  technician: string
  state: RoomState
  currentExam: RoomExam | null
  queueCount: number
  todayExams: number
}

export interface DashboardOverview {
  date: string
  generatedAt: string
  seeded: boolean
  onDutyCount: number
  offDutyCount: number
  technicianTotal: number
  roomCount: number
  inUseRooms: number
  idleRooms: number
  inProgressCount: number
  waitingCount: number
  pendingEmergencyCount: number
  duty: DutyItem[]
  rooms: RoomStatus[]
}

export type RoomEventType =
  | 'EXAM_START'
  | 'EXAM_END'
  | 'PATIENT_IN'
  | 'PATIENT_OUT'
  | 'EMERGENCY'
  | 'STATE_CHANGE'
  | 'MAINTENANCE'

export interface RoomStatusEvent {
  id: string
  roomId: string
  roomName: string
  modality: string
  type: RoomEventType
  patientName: string | null
  examItem: string | null
  technician: string
  timestamp: string
  note: string
}

export interface RoomStatusStream {
  generatedAt: string
  seeded: boolean
  rooms: RoomStatus[]
  events: RoomStatusEvent[]
}

export interface TechOverviewMeta {
  rooms: Array<{ id: string; name: string; modality: string; technician: string }>
  technicians: Array<{ id: string; name: string; group: string }>
  modalities: string[]
  date: string
  periods: Array<{ period: string; hourRange: string }>
}

const qs = (params: Record<string, string | undefined>) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
  return parts.length > 0 ? `?${parts.join('&')}` : ''
}

export const techOverviewApi = {
  meta: () => api.get<TechOverviewMeta>('/tech-overview/meta'),

  // ===== 患者预约分布 =====
  distribution: (days?: number, startDate?: string) =>
    api.get<AppointmentDistribution>(`/tech-overview/appointments/distribution${qs({ days: days !== undefined ? String(days) : undefined, startDate })}`),

  peaks: (days?: number, startDate?: string) =>
    api.get<PeakAnalysis>(`/tech-overview/appointments/peaks${qs({ days: days !== undefined ? String(days) : undefined, startDate })}`),

  attendance: (days?: number, startDate?: string) =>
    api.get<AppointmentAttendance>(`/tech-overview/appointments/attendance${qs({ days: days !== undefined ? String(days) : undefined, startDate })}`),

  // ===== 技师值班大屏 =====
  overview: () => api.get<DashboardOverview>('/tech-overview/dashboard/overview'),

  rooms: () => api.get<RoomStatusStream>('/tech-overview/dashboard/rooms'),
}
