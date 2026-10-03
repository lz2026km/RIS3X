import { api } from './client'

// [G005 Wave1B P1] 预约 API — CRUD 真实; rules/waitlist/reminders/reschedules/cancellations 已补
// (appointments.controller, Device/Appointment 派生 + seed), MSW 标注已更新。
export interface AppointmentDto {
  id: string
  patientName: string
  patientId: string
  modality: string
  bodyPart?: string
  startAt: string
  endAt: string
  deviceId: string
  deviceName: string
  room?: string
  priority: 'ROUTINE' | 'URGENT' | 'STAT'
  note?: string
  referringDoctor?: string
  state: 'SCHEDULED' | 'CONFIRMED' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
  createdById: string
  createdAt?: string
  updatedAt?: string
  // ===== [W5] 资源与安全字段 (可选) =====
  roomId?: string
  roomName?: string
  technicianId?: string
  technicianName?: string
  durationMin?: number
  bufferMin?: number
  prepInstruction?: string
  consentRequired?: boolean
  insuranceType?: string
  insurancePreAuthNo?: string
  greenChannel?: boolean
  waitlistSeq?: number
  rescheduleOf?: string
  weightKg?: number
  heightCm?: number
  allergyHistory?: string
  pregnant?: boolean
  renalFunction?: string
  contrastAgent?: boolean
  clinicalIndication?: string
}

// ===== [W5] 资源/冲突/提醒/失约/绿色通道 DTO =====
export interface RoomDto {
  id?: string
  name: string
  modality: string
  location?: string
  maxPerSlot?: number
  openTime?: string
  closeTime?: string
  status?: 'ACTIVE' | 'MAINTENANCE' | 'CLOSED'
}

export interface TechnicianDto {
  id: string
  name: string
  modality: string
  status: string
  shiftStart: string
  shiftEnd: string
}

export type ConflictType =
  | 'DEVICE' | 'ROOM' | 'TECHNICIAN' | 'PATIENT'
  | 'SLOT_CAPACITY' | 'WORKING_HOURS' | 'MAINTENANCE' | 'SHIFT'

export interface AppointmentConflictDto {
  type: ConflictType
  severity: 'ERROR' | 'WARN'
  resource: string
  message: string
  conflictingId?: string
}

export interface ConflictCheckResultDto {
  conflicts: AppointmentConflictDto[]
  blocked: boolean
}

export interface SlotCapacityDto {
  slot: string
  count: number
  max: number
  full: boolean
}

export interface WaitlistEntryDto {
  id: string
  patientName: string
  patientId?: string
  phone: string
  examItemName: string
  modality: string
  preferredDate: string
  preferredTime: string
  priority: string
  seq?: number
  status?: string
  notified: boolean
  addedAt: string
}

export type ReminderChannelDto = 'SMS' | 'WECHAT' | 'PHONE'

export interface ReminderPlanDto {
  id: string
  appointmentId?: string | null
  patientName: string
  phone: string
  channel: ReminderChannelDto
  scheduledAt: string
  status: string
  template: string
  message: string
  sentAt?: string | null
}

export interface NoShowRecordDto {
  id: string
  appointmentId: string
  patientName?: string
  modality?: string
  scheduledAt?: string
  thresholdMin: number
  markedAt: string
  status: string
}

export interface GreenChannelReservationDto {
  id: string
  patientName: string
  patientId: string
  modality: string
  bodyPart: string
  deviceId: string
  deviceName: string
  roomId: string | null
  technicianId: string | null
  reservedStartAt: string
  reservedEndAt: string
  priority: 'STAT'
  greenChannel: true
}

export interface AppointmentListParams {
  skip?: number
  take?: number
  state?: string
  deviceId?: string
  dateFrom?: string
  dateTo?: string
  // [W2-4] 按患者过滤 (患者详情 360 时间线)
  patientId?: string
}

export interface WaitlistPatientDto {
  id: string
  patientName: string
  phone: string
  examItemName: string
  modality: string
  preferredDate: string
  preferredTime: string
  priority: string
  addedAt: string
  notified: boolean
}

export interface ReminderRecordDto {
  id: string
  patientName: string
  phone: string
  examType: string
  examDate: string
  examTime: string
  reminderTime: string
  channel: string
  status: string
  responseTime: string
}

export interface RescheduleRecordDto {
  id: string
  patientName: string
  phone: string
  examType: string
  originalDate: string
  originalTime: string
  newDate: string
  newTime: string
  reason: string
  operateTime: string
}

export interface CancellationRecordDto {
  id: string
  patientName: string
  phone: string
  examType: string
  cancelTime: string
  reason: string
  rebooked: string
}

// [G005 W4B] 检查号解析结果 (GET /appointments/accession/parse)
export interface AccessionParseResultDto {
  valid: boolean
  modality?: string
  year?: number
  seq?: number
  check?: string
}

export interface AppointmentRulesDto {
  deviceId: string
  deviceName: string
  maxDailyAppointments: number
  maxPerTimeSlot: number
  minAdvanceDays: number
  maxAdvanceDays: number
  noShowPenalty: number
  enabled: boolean
}

export const appointmentApi = {
  list: (params?: AppointmentListParams) => {
    const query = new URLSearchParams()
    if (params?.skip != null) query.set('skip', String(params.skip))
    if (params?.take != null) query.set('take', String(params.take))
    if (params?.state) query.set('state', params.state)
    if (params?.deviceId) query.set('deviceId', params.deviceId)
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    if (params?.patientId) query.set('patientId', params.patientId)
    const qs = query.toString()
    return api.get<AppointmentDto[]>(`/appointments${qs ? '?' + qs : ''}`)
  },

  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  getById: (id: string) =>
    api.get<AppointmentDto>(`/appointments/${id}`),

  create: (data: Omit<AppointmentDto, 'id' | 'state' | 'createdAt' | 'updatedAt'>) =>
    api.post<AppointmentDto>('/appointments', data),

  update: (id: string, data: Partial<Pick<AppointmentDto, 'state' | 'startAt' | 'endAt' | 'note'>>) =>
    api.patch<AppointmentDto>(`/appointments/${id}`, data),

  cancel: (id: string) =>
    api.delete<void>(`/appointments/${id}`),

  getRules: () =>
    api.get<AppointmentRulesDto[]>('/appointments/rules'),

  getWaitlist: () =>
    api.get<WaitlistPatientDto[]>('/appointments/waitlist'),

  getReminderRecords: () =>
    api.get<ReminderRecordDto[]>('/appointments/reminders'),

  getRescheduleRecords: () =>
    api.get<RescheduleRecordDto[]>('/appointments/reschedules'),

  // [G005 W4B] 改期历史 (结构化, GET /appointments/reschedule-history)
  getRescheduleHistory: () =>
    api.get<RescheduleRecordDto[]>('/appointments/reschedule-history'),

  getCancellationRecords: () =>
    api.get<CancellationRecordDto[]>('/appointments/cancellations'),

  // ===== [W5] 资源模型 =====
  getRooms: () =>
    api.get<RoomDto[]>('/appointments/rooms'),

  createRoom: (data: RoomDto) =>
    api.post<RoomDto>('/appointments/rooms', data),

  updateRoom: (id: string, data: Partial<RoomDto>) =>
    api.patch<RoomDto>(`/appointments/rooms/${id}`, data),

  deleteRoom: (id: string) =>
    api.delete<void>(`/appointments/rooms/${id}`),

  getTechnicians: (modality?: string) =>
    api.get<TechnicianDto[]>(`/appointments/technicians${modality ? `?modality=${encodeURIComponent(modality)}` : ''}`),

  getSlotCapacity: (params: { date?: string; deviceId?: string; roomId?: string }) => {
    const q = new URLSearchParams()
    if (params.date) q.set('date', params.date)
    if (params.deviceId) q.set('deviceId', params.deviceId)
    if (params.roomId) q.set('roomId', params.roomId)
    const qs = q.toString()
    return api.get<SlotCapacityDto[]>(`/appointments/slots/capacity${qs ? '?' + qs : ''}`)
  },

  // ===== [W5] 冲突预检 =====
  checkConflicts: (data: Partial<AppointmentDto> & { id?: string; startAt: string; endAt: string }) =>
    api.post<ConflictCheckResultDto>('/appointments/check-conflicts', data),

  // ===== [W5] 等候队列 =====
  addWaitlist: (data: { patientName: string; modality: string; patientId?: string; phone?: string; bodyPart?: string; priority?: string; preferredDate?: string; preferredTime?: string }) =>
    api.post<WaitlistEntryDto>('/appointments/waitlist', data),

  getNextWaitlist: () =>
    api.get<WaitlistEntryDto | null>('/appointments/waitlist/next'),

  assignWaitlist: (id: string, data?: { appointmentId?: string; deviceId?: string; startAt?: string }) =>
    api.post<WaitlistEntryDto>(`/appointments/waitlist/${id}/assign`, data),

  // ===== [W5] 提醒计划 =====
  getReminderPlans: () =>
    api.get<ReminderPlanDto[]>('/appointments/reminder-plans'),

  createReminderPlan: (data: { appointmentId?: string; patientName: string; phone?: string; channel: ReminderChannelDto; scheduledAt: string; template?: string }) =>
    api.post<ReminderPlanDto>('/appointments/reminder-plans', data),

  fireReminderPlan: (id: string) =>
    api.post<ReminderPlanDto>(`/appointments/reminder-plans/${id}/fire`),

  fireDueReminders: () =>
    api.post<ReminderPlanDto[]>('/appointments/reminder-plans/fire-due'),

  getReminderTemplates: () =>
    api.get<Array<{ channel: ReminderChannelDto; template: string }>>('/appointments/reminder-templates'),

  // ===== [W5] 失约管理 =====
  getNoShowList: () =>
    api.get<NoShowRecordDto[]>('/appointments/no-show'),

  scanNoShow: (thresholdMin?: number) =>
    api.post<{ scanned: number; marked: string[] }>(`/appointments/no-show/scan${thresholdMin != null ? `?thresholdMin=${thresholdMin}` : ''}`),

  markNoShow: (id: string) =>
    api.post<NoShowRecordDto>(`/appointments/no-show/${id}`),

  restoreNoShow: (id: string) =>
    api.post<NoShowRecordDto>(`/appointments/no-show/${id}/restore`),

  // ===== [W5] 急诊绿色通道 =====
  getGreenChannel: () =>
    api.get<GreenChannelReservationDto[]>('/appointments/green-channel'),

  createGreenChannel: (data: { patientName: string; patientId?: string; modality: string; bodyPart?: string; deviceId: string; deviceName?: string; roomId?: string; technicianId?: string; createdById?: string; startAt?: string }) =>
    api.post<GreenChannelReservationDto>('/appointments/green-channel', data),

  // ===== [W5] 编号策略 / 审计 =====
  nextAccession: (modality: string, year?: number) =>
    api.get<{ accessionNumber: string }>(`/appointments/accession/next?modality=${encodeURIComponent(modality)}${year != null ? `&year=${year}` : ''}`),

  // [G005 W4B] 解析检查号 → 结构化字段 (GET /appointments/accession/parse)
  parseAccession: (accession: string) =>
    api.get<AccessionParseResultDto>(`/appointments/accession/parse?accession=${encodeURIComponent(accession)}`),

  getAudit: (appointmentId?: string) =>
    api.get<Array<{ id: string; appointmentId: string; action: string; actorId: string | null; at: string }>>(`/appointments/audit${appointmentId ? `?appointmentId=${encodeURIComponent(appointmentId)}` : ''}`),
}
