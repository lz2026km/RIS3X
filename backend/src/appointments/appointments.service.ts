/**
 * G005 放射RIS系统 v3.0.6.11-70 - 预约服务 (P0: 预约→检查联动)
 * - create: 完整字段落库 + 同事务创建 Exam (工作列表可见)
 * - 5 个子资源: rules / waitlist / reminders / reschedules / cancellations
 *
 * [W5 深度增强] 资源模型 + 冲突引擎 + 提醒引擎 + 失约引擎 + 急诊绿色通道 + 编号策略
 *   - 扩展预约字段 (roomId/technicianId/durationMin/bufferMin/prepInstruction/
 *     consentRequired/insuranceType/insurancePreAuthNo/greenChannel/waitlistSeq/
 *     noShowAt/cancelReason/rescheduleOf/weightKg/heightCm) 存于内存增强表, DB-less 安全
 *   - 跨 设备/机房/技师/患者/时段容量/工作时间/维护 冲突检测 (conflict.engine)
 *   - 检查号策略 (accession.policy): {模态}{年}{序列5}{校验位}
 */
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { currentTenantId } from '../common/tenant/tenant-utils'
import type { Appointment, AppointmentPriority, AppointmentState, Gender } from '@prisma/client'
import { conflictEngine, type AppointmentConflict, type ConflictCandidate, type DeviceResource, type ExistingAppointment, type RoomResource, type TechnicianResource } from './conflict.engine'
import { accessionPolicy } from './accession.policy'

export interface CreateAppointmentDto {
  patientName: string
  patientId: string
  modality: string
  bodyPart?: string
  startAt: string | Date
  endAt: string | Date
  deviceId: string
  deviceName: string
  room?: string
  priority?: string
  note?: string
  referringDoctor?: string
  createdById: string
  /** 仅在 patientId 无法匹配现有患者时用于新建患者 (可选) */
  gender?: 'MALE' | 'FEMALE' | 'OTHER'
  phone?: string
  // ===== [W5] 资源与安全字段 (内存增强, DB-less 安全) =====
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
  rescheduleOf?: string
  weightKg?: number
  heightCm?: number
  // ===== [W5] 安全与准备 (向导步骤3) =====
  allergyHistory?: string
  pregnant?: boolean
  renalFunction?: string
  contrastAgent?: boolean
  clinicalIndication?: string
}

export interface UpdateAppointmentDto {
  id?: string
  state?: AppointmentState
  startAt?: string | Date
  endAt?: string | Date
  note?: string
  deviceId?: string
  roomId?: string
  technicianId?: string
  durationMin?: number
  bufferMin?: number
  consentRequired?: boolean
  cancelReason?: string
  rescheduleOf?: string
  greenChannel?: boolean
  insuranceType?: string
  insurancePreAuthNo?: string
}

export interface RoomDto {
  id?: string
  name: string
  modality: string
  location?: string
  maxPerSlot?: number
  openTime?: string
  closeTime?: string
  status?: string
}

export interface WaitlistEntryDto {
  patientName: string
  patientId?: string
  phone?: string
  modality: string
  bodyPart?: string
  examItemName?: string
  priority?: string
  preferredDate?: string
  preferredTime?: string
}

export type ReminderChannel = 'SMS' | 'WECHAT' | 'PHONE'

export interface ReminderPlanDto {
  appointmentId?: string
  patientName: string
  phone?: string
  channel: ReminderChannel
  scheduledAt: string | Date
  template?: string
}

const PRIORITY_MAP: Record<string, AppointmentPriority> = {
  ROUTINE: 'ROUTINE',
  URGENT: 'URGENT',
  STAT: 'STAT',
  normal: 'ROUTINE',
  urgent: 'URGENT',
  critical: 'STAT',
}

// [v3.0.6.11-104 Wave 1B] 预约状态机合法流转表 (流程质量门禁, 对齐 Prisma AppointmentState 8 态):
//   主链: SCHEDULED→CONFIRMED→REGISTERED→CHECKED_IN→IN_PROGRESS→COMPLETED
//   侧链: 取消/失约 (SCHEDULED/CONFIRMED/REGISTERED/CHECKED_IN/IN_PROGRESS→CANCELLED, ...→NO_SHOW)
//   终态: COMPLETED / CANCELLED / NO_SHOW 不可再流转。
//   对照前端 src/machines/orderMachine.ts 的线性推进 + 取消/退回侧链。
export const APPOINTMENT_TRANSITIONS: Record<AppointmentState, AppointmentState[]> = {
  SCHEDULED: ['CONFIRMED', 'REGISTERED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['REGISTERED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  REGISTERED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN: ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
}

// ===== 内存 seed: 提醒 / 改期 / 取消记录 (轻量实现, 后续可落表) =====
const seedReminders = [
  {
    id: 'RM-001',
    patientName: '张三',
    phone: '13800138001',
    examType: '胸部CT平扫',
    examDate: '2026-08-05',
    examTime: '09:00',
    reminderTime: '2026-08-04 20:00',
    channel: '短信',
    status: '已确认',
    responseTime: '0.5h',
  },
  {
    id: 'RM-002',
    patientName: '李四',
    phone: '13800138002',
    examType: '头颅MR平扫',
    examDate: '2026-08-05',
    examTime: '10:30',
    reminderTime: '2026-08-05 07:00',
    channel: '微信',
    status: '已发送',
    responseTime: '未响应',
  },
  {
    id: 'RM-003',
    patientName: '王五',
    phone: '13800138003',
    examType: '腹部CT平扫+增强',
    examDate: '2026-08-06',
    examTime: '14:00',
    reminderTime: '2026-08-05 20:00',
    channel: 'APP推送',
    status: '已改期',
    responseTime: '2h',
  },
  {
    id: 'RM-004',
    patientName: '张三',
    phone: '13800138001',
    examType: '腰椎MR平扫',
    examDate: '2026-08-07',
    examTime: '08:30',
    reminderTime: '2026-08-06 20:00',
    channel: '短信',
    status: '已取消',
    responseTime: '未响应',
  },
  {
    id: 'RM-005',
    patientName: '李四',
    phone: '13800138002',
    examType: '胸部DR正侧位',
    examDate: '2026-08-08',
    examTime: '11:00',
    reminderTime: '2026-08-07 20:00',
    channel: '微信',
    status: '已发送',
    responseTime: '未响应',
  },
]

const seedReschedules = [
  {
    id: 'RS-001',
    patientName: '张三',
    phone: '13800138001',
    examType: '腹部CT平扫+增强',
    originalDate: '2026-08-03',
    originalTime: '09:00',
    newDate: '2026-08-05',
    newTime: '14:00',
    reason: 'patient',
    operateTime: '2026-08-02 16:20',
  },
  {
    id: 'RS-002',
    patientName: '李四',
    phone: '13800138002',
    examType: '头颅MR平扫',
    originalDate: '2026-08-04',
    originalTime: '10:30',
    newDate: '2026-08-06',
    newTime: '10:00',
    reason: 'doctor',
    operateTime: '2026-08-03 09:15',
  },
  {
    id: 'RS-003',
    patientName: '王五',
    phone: '13800138003',
    examType: '胸部CT平扫',
    originalDate: '2026-08-05',
    originalTime: '08:00',
    newDate: '2026-08-07',
    newTime: '09:30',
    reason: 'device',
    operateTime: '2026-08-04 11:40',
  },
]

const seedCancellations = [
  {
    id: 'CX-001',
    patientName: '张三',
    phone: '13800138001',
    examType: '腰椎MR平扫',
    cancelTime: '2026-08-02 10:00',
    reason: '患者主动取消',
    rebooked: '是',
  },
  {
    id: 'CX-002',
    patientName: '李四',
    phone: '13800138002',
    examType: '胸部DR正侧位',
    cancelTime: '2026-08-01 15:30',
    reason: '设备故障',
    rebooked: '待确认',
  },
  {
    id: 'CX-003',
    patientName: '王五',
    phone: '13800138003',
    examType: '冠脉CTA',
    cancelTime: '2026-07-31 09:20',
    reason: '医生调整时间',
    rebooked: '否',
  },
]

// ===== [W5] 资源 seed: 机房 / 技师 =====
const seedRooms: Required<RoomDto>[] = [
  { id: 'ROOM-CT-01', name: 'CT-1 机房', modality: 'CT', location: '门诊楼1F-放射科', maxPerSlot: 4, openTime: '07:30', closeTime: '20:00', status: 'ACTIVE' },
  { id: 'ROOM-CT-02', name: 'CT-2 机房', modality: 'CT', location: '门诊楼1F-放射科', maxPerSlot: 4, openTime: '07:30', closeTime: '20:00', status: 'ACTIVE' },
  { id: 'ROOM-MR-01', name: 'MR-1 机房', modality: 'MR', location: '门诊楼B1-放射科', maxPerSlot: 2, openTime: '08:00', closeTime: '18:00', status: 'ACTIVE' },
  { id: 'ROOM-MR-02', name: 'MR-2 机房', modality: 'MR', location: '门诊楼B1-放射科', maxPerSlot: 2, openTime: '08:00', closeTime: '18:00', status: 'MAINTENANCE' },
  { id: 'ROOM-DR-01', name: 'DR-1 机房', modality: 'DR', location: '门诊楼1F-放射科', maxPerSlot: 5, openTime: '07:00', closeTime: '21:00', status: 'ACTIVE' },
  { id: 'ROOM-US-01', name: '超声-1 诊室', modality: 'US', location: '门诊楼2F-超声科', maxPerSlot: 3, openTime: '08:00', closeTime: '17:30', status: 'ACTIVE' },
]

const seedTechnicians: TechnicianResource[] = [
  { id: 'TECH-CT-01', name: '王技师', modality: 'CT', status: 'ACTIVE', shiftStart: '08:00', shiftEnd: '16:00' },
  { id: 'TECH-CT-02', name: '赵技师', modality: 'CT', status: 'ACTIVE', shiftStart: '12:00', shiftEnd: '20:00' },
  { id: 'TECH-MR-01', name: '孙技师', modality: 'MR', status: 'ACTIVE', shiftStart: '08:00', shiftEnd: '16:00' },
  { id: 'TECH-MR-02', name: '周技师', modality: 'MR', status: 'LEAVE', shiftStart: '08:00', shiftEnd: '16:00' },
  { id: 'TECH-DR-01', name: '吴技师', modality: 'DR', status: 'ACTIVE', shiftStart: '07:00', shiftEnd: '15:00' },
  { id: 'TECH-US-01', name: '郑技师', modality: 'US', status: 'ACTIVE', shiftStart: '08:00', shiftEnd: '17:00' },
]

const seedWaitlistQueue = [
  { id: 'WL-001', patientName: '陈六', patientId: 'P-10086', phone: '13800138006', modality: 'MR', bodyPart: '膝关节', examItemName: 'MR 膝关节平扫', priority: 'urgent', preferredDate: '2026-08-05', preferredTime: '09:00', seq: 1, notified: false, status: 'WAITING', addedAt: '2026-08-04 09:00' },
  { id: 'WL-002', patientName: '冯七', patientId: 'P-10087', phone: '13800138007', modality: 'CT', bodyPart: '胸部', examItemName: 'CT 胸部增强', priority: 'critical', preferredDate: '2026-08-05', preferredTime: '08:00', seq: 2, notified: false, status: 'WAITING', addedAt: '2026-08-04 09:20' },
  { id: 'WL-003', patientName: '褚八', patientId: 'P-10088', phone: '13800138008', modality: 'CT', bodyPart: '头颅', examItemName: 'CT 头颅平扫', priority: 'normal', preferredDate: '2026-08-06', preferredTime: '10:00', seq: 3, notified: false, status: 'WAITING', addedAt: '2026-08-04 10:05' },
]

const REMINDER_TEMPLATES: Record<ReminderChannel, string> = {
  SMS: '【G005医院】{{patient}}您好，您预约的{{exam}}将于{{time}}在{{room}}进行，请携带身份证提前30分钟到达并完成准备：{{prep}}。回复TD退订。',
  WECHAT: '{{patient}}您好，预约提醒：{{exam}} · {{time}} · {{room}}。准备须知：{{prep}}。请点击确认。',
  PHONE: '电话提醒脚本：您好，请问是{{patient}}吗？提醒您{{time}}在{{room}}进行{{exam}}，请提前准备：{{prep}}。',
}

const DEFAULT_DEVICE_RULES: Record<string, { maxPerSlot: number; openTime: string; closeTime: string }> = {
  CT: { maxPerSlot: 4, openTime: '07:30', closeTime: '20:00' },
  MR: { maxPerSlot: 2, openTime: '08:00', closeTime: '18:00' },
  DR: { maxPerSlot: 5, openTime: '07:00', closeTime: '21:00' },
  US: { maxPerSlot: 3, openTime: '08:00', closeTime: '17:30' },
}
const DEFAULT_RULE = { maxPerSlot: 4, openTime: '08:00', closeTime: '18:00' }

export interface ExtendedAppointmentFields {
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
  noShowAt?: string | null
  cancelReason?: string
  rescheduleOf?: string
  weightKg?: number
  heightCm?: number
  allergyHistory?: string
  pregnant?: boolean
  renalFunction?: string
  contrastAgent?: boolean
  clinicalIndication?: string
}

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name)

  // ===== [W5] 内存资源/流程存储 (DB-less 安全; 单实例生命周期内有效) =====
  private rooms: Required<RoomDto>[] = seedRooms.map((r) => ({ ...r }))
  private technicians: TechnicianResource[] = seedTechnicians.map((t) => ({ ...t }))
  private waitlistQueue: Array<Record<string, any>> = seedWaitlistQueue.map((w) => ({ ...w }))
  private reminderPlans: Array<Record<string, any>> = []
  private rescheduleList: Array<Record<string, any>> = seedReschedules.map((r) => ({ ...r }))
  private noShowRecords: Array<Record<string, any>> = []
  private auditLog: Array<Record<string, any>> = []
  private greenChannelReservations: Array<Record<string, any>> = []
  private extended = new Map<string, ExtendedAppointmentFields>()
  private waitlistSeqCounter = seedWaitlistQueue.length
  private roomSeq = 0
  private reminderSeq = 0
  private auditSeq = 0
  private noShowSeq = 0

  constructor(private readonly prisma: PrismaService) {}

  private now(): Date {
    return new Date()
  }

  // ══════════════════════════════════════════════════════════════════
  // CRUD
  // ══════════════════════════════════════════════════════════════════
  async list(params: { skip?: number; take?: number; state?: AppointmentState; deviceId?: string; dateFrom?: string; dateTo?: string; patientId?: string }) {
    const where: any = { tenantId: currentTenantId() }
    if (params.state) where.state = params.state
    if (params.deviceId) where.deviceId = params.deviceId
    if (params.patientId) where.patientId = params.patientId
    if (params.dateFrom || params.dateTo) {
      where.scheduledAt = {}
      if (params.dateFrom) where.scheduledAt.gte = new Date(params.dateFrom)
      if (params.dateTo) where.scheduledAt.lte = new Date(params.dateTo)
    }
    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        skip: params.skip ?? 0,
        take: params.take ?? 50,
        orderBy: { scheduledAt: 'asc' },
        include: { patient: true },
      }),
      this.prisma.appointment.count({ where }),
    ])
    return { items: items.map((a: any) => this.decorate(a)), total }
  }

  async get(id: string): Promise<Appointment> {
    const a = await this.prisma.appointment.findFirst({ where: { id, tenantId: currentTenantId() } })
    if (!a) throw new NotFoundException(`Appointment ${id} not found`)
    return this.decorate(a)
  }

  /**
   * 创建预约 (P0):
   * 1. 解析/新建患者 (patientId 无效时按姓名+手机号匹配, 仍未命中则新建)
   * 2. 解析/新建设备 (前端设备 id 可能与真实设备不一致, 按 code 或 name 匹配)
   * 3. 事务内完整落库 Appointment
   * 4. 同事务创建 Exam (SCHEDULED) → 工作列表立即可见
   * [W5] 冲突引擎: 设备/机房/技师/患者/容量/工作时间 全维度预检
   */
  async create(dto: CreateAppointmentDto): Promise<Appointment> {
    const tenantId = currentTenantId()
    const startAt = new Date(dto.startAt)
    const endAt = dto.endAt ? new Date(dto.endAt) : new Date(startAt.getTime() + (dto.durationMin ?? 30) * 60 * 1000)

    // [W5] 冲突预检 (事务外, 避免 DB-less 假 Prisma 缺少 findMany on tx)
    const resolvedDeviceId = await this.resolveDeviceId(dto.deviceId, dto.deviceName)
    const conflicts = await this.detectConflicts({
      id: undefined,
      deviceId: resolvedDeviceId,
      roomId: dto.roomId,
      technicianId: dto.technicianId,
      patientId: dto.patientId,
      modality: dto.modality,
      startAt,
      endAt,
    })
    if (conflictEngine.hasBlockingConflict(conflicts)) {
      throw new ConflictException(`预约冲突: ${conflicts.filter((c) => c.severity === 'ERROR').map((c) => c.message).join('; ')}`)
    }

    const room = dto.roomId ? this.rooms.find((r) => r.id === dto.roomId) : undefined
    const tech = dto.technicianId ? this.technicians.find((t) => t.id === dto.technicianId) : undefined

    return this.prisma.$transaction(async (tx) => {
      // 1) 患者解析
      let patient = dto.patientId
        ? await tx.patient.findUnique({ where: { id: dto.patientId } })
        : null
      if (!patient) {
        patient = await tx.patient.findFirst({
          where: { name: dto.patientName, tenantId },
        })
      }
      if (!patient) {
        patient = await tx.patient.create({
          data: {
            tenantId,
            name: dto.patientName,
            gender: (dto.gender ?? 'OTHER') as Gender,
            phone: dto.phone ?? null,
          },
        })
      }

      // 2) 设备解析
      let device = dto.deviceId
        ? await tx.device.findUnique({ where: { id: dto.deviceId } })
        : null
      if (!device && (dto.deviceId || dto.deviceName)) {
        device = await tx.device.findFirst({
          where: {
            tenantId,
            OR: [{ code: dto.deviceId }, { name: dto.deviceName }],
          },
        })
      }
      if (!device && (dto.deviceId || dto.deviceName)) {
        device = await tx.device.create({
          data: {
            tenantId,
            code: dto.deviceId ?? `DEV-${Date.now()}`,
            name: dto.deviceName ?? dto.deviceId,
            modality: dto.modality,
            state: 'IDLE',
          },
        })
      }
      const deviceId = device?.id ?? null

      // 3) 预约完整落库
      const appointment = await tx.appointment.create({
        data: {
          tenantId,
          patientId: patient.id,
          patientName: dto.patientName,
          modality: dto.modality,
          bodyPart: dto.bodyPart ?? null,
          deviceId,
          scheduledAt: startAt,
          endAt,
          priority: (PRIORITY_MAP[dto.priority ?? 'ROUTINE'] ?? 'ROUTINE') as AppointmentPriority,
          createdById: dto.createdById ?? null,
          state: 'SCHEDULED',
        },
      })

      // 4) 联动创建 Exam → 工作列表 (检查号走 accessionPolicy)
      const accessionNumber = this.nextAccession(dto.modality)
      await tx.exam.create({
        data: {
          tenantId,
          patientId: patient.id,
          accessionNumber,
          modality: dto.modality,
          bodyPart: dto.bodyPart || '未指定',
          scheduledAt: startAt,
          deviceId,
          state: 'SCHEDULED',
        },
      })

      // 5) [W5] 增强字段落内存 + 审计
      const waitlistSeq = dto.greenChannel ? undefined : ++this.waitlistSeqCounter
      this.extended.set(appointment.id, {
        roomId: dto.roomId ?? room?.id,
        roomName: dto.roomName ?? room?.name,
        technicianId: dto.technicianId ?? tech?.id,
        technicianName: dto.technicianName ?? tech?.name,
        durationMin: dto.durationMin ?? Math.round((endAt.getTime() - startAt.getTime()) / 60000),
        bufferMin: dto.bufferMin ?? 0,
        prepInstruction: dto.prepInstruction,
        consentRequired: dto.consentRequired ?? false,
        insuranceType: dto.insuranceType,
        insurancePreAuthNo: dto.insurancePreAuthNo,
        greenChannel: dto.greenChannel ?? false,
        waitlistSeq,
        noShowAt: null,
        cancelReason: undefined,
        rescheduleOf: dto.rescheduleOf,
        weightKg: dto.weightKg,
        heightCm: dto.heightCm,
        allergyHistory: dto.allergyHistory,
        pregnant: dto.pregnant,
        renalFunction: dto.renalFunction,
        contrastAgent: dto.contrastAgent,
        clinicalIndication: dto.clinicalIndication,
      })
      this.pushAudit(appointment.id, 'CREATE', dto.createdById, {
        greenChannel: dto.greenChannel ?? false,
        accessionNumber,
      })

      return this.decorate(appointment)
    })
  }

  /**
   * [v3.0.6.11-104 Wave 1B] 预约状态机门禁: 校验 from → to 是否在 APPOINTMENT_TRANSITIONS 合法流转表内。
   * 同态幂等放行 (PATCH 重复提交不报错); 非法跳转抛 400 并给出当前态可去向列表。
   */
  private assertAppointmentTransition(from: AppointmentState, to: AppointmentState, id: string): void {
    if (from === to) return
    const allowed = APPOINTMENT_TRANSITIONS[from] ?? []
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `INVALID_TRANSITION: Appointment ${id} ${from} → ${to} 不允许 (非法跳转; 合法流转: ${from} → ${allowed.length > 0 ? allowed.join('/') : '无 (终态)'})`,
      )
    }
  }

  async update(id: string, dto: UpdateAppointmentDto): Promise<Appointment> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.appointment.findUnique({ where: { id } })
      if (!current) throw new NotFoundException(`Appointment ${id} not found`)
      // [v3.0.6.11-104 Wave 1B] 流程质量门禁: state 变更走合法流转表
      if (dto.state !== undefined) {
        this.assertAppointmentTransition(current.state, dto.state, id)
      }
      if (dto.deviceId || dto.roomId || dto.technicianId || dto.startAt || dto.endAt) {
        const startAt = dto.startAt ? new Date(dto.startAt) : current.scheduledAt
        const endAt = dto.endAt
          ? new Date(dto.endAt)
          : new Date(startAt.getTime() + (dto.durationMin ?? 30) * 60 * 1000)
        const conflicts = await this.detectConflicts({
          id,
          deviceId: dto.deviceId ?? current.deviceId ?? undefined,
          roomId: dto.roomId ?? this.extended.get(id)?.roomId,
          technicianId: dto.technicianId ?? this.extended.get(id)?.technicianId,
          patientId: current.patientId,
          modality: current.modality,
          startAt,
          endAt,
        })
        if (conflictEngine.hasBlockingConflict(conflicts)) {
          throw new ConflictException(`预约冲突: ${conflicts.filter((c) => c.severity === 'ERROR').map((c) => c.message).join('; ')}`)
        }
      }
      const data: any = { ...dto }
      delete data.id
      delete data.cancelReason
      if (dto.startAt) data.scheduledAt = new Date(dto.startAt)
      if (dto.durationMin !== undefined && !dto.endAt) {
        data.endAt = new Date((dto.startAt ? new Date(dto.startAt) : current.scheduledAt).getTime() + dto.durationMin * 60000)
      }
      try {
        const updated = await tx.appointment.update({
          where: { id, version: current.version },
          data: { ...data, version: { increment: 1 } },
        })
        // [W5] 合并增强字段
        const patch: ExtendedAppointmentFields = {}
        for (const k of [
          'roomId', 'technicianId', 'durationMin', 'bufferMin', 'consentRequired',
          'rescheduleOf', 'greenChannel', 'insuranceType', 'insurancePreAuthNo', 'cancelReason',
        ] as const) {
          const v = (dto as Record<string, unknown>)[k]
          if (v !== undefined) (patch as Record<string, unknown>)[k] = v
        }
        if (Object.keys(patch).length > 0) {
          this.extended.set(id, { ...(this.extended.get(id) ?? {}), ...patch })
        }
        if (dto.cancelReason) this.pushAudit(id, 'CANCEL_REASON', null, { cancelReason: dto.cancelReason })
        if (dto.state) this.pushAudit(id, 'STATE_CHANGE', null, { from: current.state, to: dto.state })
        if (dto.rescheduleOf) {
          this.rescheduleList.push({
            id: `RS-${Date.now()}`,
            appointmentId: id,
            patientName: current.patientName,
            examType: current.modality,
            reason: 'reschedule',
            operateTime: new Date().toISOString(),
          })
        }
        return this.decorate(updated)
      } catch (error: any) {
        if (error?.code === 'P2025') throw new ConflictException('版本冲突：该预约已被其他用户修改')
        throw error
      }
    })
  }

  async cancel(id: string, reason?: string): Promise<Appointment> {
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { state: 'CANCELLED' },
    })
    if (reason) this.extended.set(id, { ...(this.extended.get(id) ?? {}), cancelReason: reason })
    this.pushAudit(id, 'CANCEL', null, { reason })
    return this.decorate(updated)
  }

  // ══════════════════════════════════════════════════════════════════
  // [W5] 冲突引擎
  // ══════════════════════════════════════════════════════════════════
  /** 将前端设备 id/名称解析为真实设备主键 (DB-less 回退原值) */
  private async resolveDeviceId(deviceId: string, deviceName?: string): Promise<string | undefined> {
    try {
      const devices = (await this.prisma.device.findMany({ where: { tenantId: currentTenantId() } })) as any[]
      const match = devices.find(
        (d) => d.id === deviceId || d.code === deviceId || (deviceName != null && d.name === deviceName),
      )
      return match?.id ?? deviceId
    } catch {
      return deviceId
    }
  }

  private async detectConflicts(candidate: ConflictCandidate & { id?: string }): Promise<AppointmentConflict[]> {
    let existing: ExistingAppointment[] = []
    let devices: DeviceResource[] = []
    try {
      const rows = await this.prisma.appointment.findMany({ where: { tenantId: currentTenantId() } })
      existing = (rows as any[]).map((a) => ({
        id: a.id,
        deviceId: a.deviceId ?? null,
        roomId: this.extended.get(a.id)?.roomId ?? null,
        technicianId: this.extended.get(a.id)?.technicianId ?? null,
        patientId: a.patientId,
        state: a.state,
        scheduledAt: a.scheduledAt instanceof Date ? a.scheduledAt : new Date(a.scheduledAt),
        endAt: a.endAt instanceof Date ? a.endAt : a.endAt ? new Date(a.endAt) : null,
      }))
      devices = ((await this.prisma.device.findMany({ where: { tenantId: currentTenantId() } })) as any[]).map((d) => ({
        id: d.id,
        name: d.name,
        modality: d.modality,
        state: d.state,
        maintenanceFrom: d.maintenanceFrom,
        maintenanceTo: d.maintenanceTo,
      }))
    } catch (err) {
      this.logger.warn(`[Appointments] conflict DB query failed, in-memory only: ${(err as Error).message}`)
    }
    const deviceRule = { ...(DEFAULT_DEVICE_RULES[candidate.modality ?? ''] ?? DEFAULT_RULE) }
    const room = candidate.roomId ? this.rooms.find((r) => r.id === candidate.roomId) : undefined
    const roomRule = room ? { maxPerSlot: room.maxPerSlot, openTime: room.openTime, closeTime: room.closeTime } : null
    return conflictEngine.detect({
      candidate,
      existing,
      rooms: this.rooms as RoomResource[],
      technicians: this.technicians,
      devices,
      deviceRule,
      roomRule,
      excludeId: candidate.id,
    })
  }

  /** 冲突预检端点: 返回结构化冲突 (不落库) */
  async checkConflicts(dto: CreateAppointmentDto & { id?: string }): Promise<{ conflicts: AppointmentConflict[]; blocked: boolean }> {
    const startAt = new Date(dto.startAt)
    const endAt = dto.endAt ? new Date(dto.endAt) : new Date(startAt.getTime() + (dto.durationMin ?? 30) * 60000)
    const conflicts = await this.detectConflicts({
      id: dto.id,
      deviceId: dto.deviceId,
      roomId: dto.roomId,
      technicianId: dto.technicianId,
      patientId: dto.patientId,
      modality: dto.modality,
      startAt,
      endAt,
    })
    return { conflicts, blocked: conflictEngine.hasBlockingConflict(conflicts) }
  }

  // ══════════════════════════════════════════════════════════════════
  // [W5] 资源: 机房 CRUD / 技师列表 / 时段容量
  // ══════════════════════════════════════════════════════════════════
  listRooms(): Required<RoomDto>[] {
    return this.rooms.map((r) => ({ ...r }))
  }

  createRoom(dto: RoomDto): Required<RoomDto> {
    const id = dto.id ?? `ROOM-${String(++this.roomSeq).padStart(3, '0')}`
    if (this.rooms.some((r) => r.id === id)) throw new ConflictException(`机房 ${id} 已存在`)
    const room: Required<RoomDto> = {
      id,
      name: dto.name,
      modality: dto.modality,
      location: dto.location ?? '',
      maxPerSlot: dto.maxPerSlot ?? DEFAULT_DEVICE_RULES[dto.modality]?.maxPerSlot ?? 4,
      openTime: dto.openTime ?? DEFAULT_DEVICE_RULES[dto.modality]?.openTime ?? '08:00',
      closeTime: dto.closeTime ?? DEFAULT_DEVICE_RULES[dto.modality]?.closeTime ?? '18:00',
      status: dto.status ?? 'ACTIVE',
    }
    this.rooms.push(room)
    return room
  }

  updateRoom(id: string, dto: Partial<RoomDto>): Required<RoomDto> {
    const idx = this.rooms.findIndex((r) => r.id === id)
    if (idx < 0) throw new NotFoundException(`Room ${id} not found`)
    const updated = { ...this.rooms[idx]!, ...dto, id }
    this.rooms[idx] = updated
    return updated
  }

  deleteRoom(id: string): { ok: boolean; id: string } {
    const idx = this.rooms.findIndex((r) => r.id === id)
    if (idx < 0) throw new NotFoundException(`Room ${id} not found`)
    this.rooms.splice(idx, 1)
    return { ok: true, id }
  }

  listTechnicians(params?: { modality?: string }): TechnicianResource[] {
    const list = params?.modality ? this.technicians.filter((t) => t.modality === params.modality) : this.technicians
    return list.map((t) => ({ ...t }))
  }

  /** 时段容量: 按 30 分钟切片返回各时段已用/上限 */
  async slotCapacity(params: { date?: string; deviceId?: string; roomId?: string }): Promise<Array<{ slot: string; count: number; max: number; full: boolean }>> {
    const dateStr = params.date ?? this.now().toISOString().slice(0, 10)
    let rows: any[] = []
    try {
      rows = (await this.prisma.appointment.findMany({ where: { tenantId: currentTenantId() } })) as any[]
    } catch (err) {
      this.logger.warn(`[Appointments] slotCapacity DB query failed: ${(err as Error).message}`)
    }
    const max = params.roomId
      ? this.rooms.find((r) => r.id === params.roomId)?.maxPerSlot ?? DEFAULT_RULE.maxPerSlot
      : this.technicians && params.deviceId
        ? DEFAULT_RULE.maxPerSlot
        : DEFAULT_RULE.maxPerSlot
    const slots: Array<{ slot: string; count: number; max: number; full: boolean }> = []
    for (let m = 7 * 60; m < 21 * 60; m += 30) {
      const slot = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
      const count = rows.filter((a) => {
        if (!['SCHEDULED', 'CONFIRMED', 'REGISTERED', 'CHECKED_IN', 'IN_PROGRESS'].includes(a.state)) return false
        const at = a.scheduledAt instanceof Date ? a.scheduledAt : new Date(a.scheduledAt)
        if (at.toISOString().slice(0, 10) !== dateStr) return false
        if (params.deviceId && a.deviceId !== params.deviceId) return false
        if (params.roomId && (this.extended.get(a.id)?.roomId ?? null) !== params.roomId) return false
        const mins = at.getHours() * 60 + at.getMinutes()
        return mins >= m && mins < m + 30
      }).length
      slots.push({ slot, count, max, full: count >= max })
    }
    return slots
  }

  // ══════════════════════════════════════════════════════════════════
  // 旧 5 子资源
  // ══════════════════════════════════════════════════════════════════
  async rules() {
    try {
      const devices = await this.prisma.device.findMany({
        where: { tenantId: currentTenantId() },
        orderBy: { name: 'asc' },
      })
      if (devices.length === 0) {
        return [
          { deviceId: 'DEV-CT-01', deviceName: 'CT-1（GE Revolution CT）', maxDailyAppointments: 60, maxPerTimeSlot: 4, minAdvanceDays: 0, maxAdvanceDays: 30, noShowPenalty: 3, enabled: true },
          { deviceId: 'DEV-MR-01', deviceName: 'MR-1（西门子MAGNETOM Vida）', maxDailyAppointments: 40, maxPerTimeSlot: 3, minAdvanceDays: 1, maxAdvanceDays: 30, noShowPenalty: 3, enabled: true },
          { deviceId: 'DEV-DR-01', deviceName: 'DR-1（飞利浦DigitalDiagnost）', maxDailyAppointments: 80, maxPerTimeSlot: 5, minAdvanceDays: 0, maxAdvanceDays: 14, noShowPenalty: 2, enabled: true },
        ]
      }
      return devices.map((d) => ({
        deviceId: d.id,
        deviceName: d.name,
        maxDailyAppointments: d.modality === 'MR' ? 40 : d.modality === 'CT' ? 60 : 80,
        maxPerTimeSlot: DEFAULT_DEVICE_RULES[d.modality]?.maxPerSlot ?? 4,
        minAdvanceDays: 0,
        maxAdvanceDays: 30,
        noShowPenalty: 3,
        enabled: d.state !== 'MAINTENANCE' && d.state !== 'BROKEN' && d.state !== 'OFFLINE',
      }))
    } catch (err) {
      this.logger.warn(`[Appointments] rules DB query failed, fallback to default rules: ${(err as Error).message}`)
      return [
        { deviceId: 'DEV-CT-01', deviceName: 'CT-1（GE Revolution CT）', maxDailyAppointments: 60, maxPerTimeSlot: 4, minAdvanceDays: 0, maxAdvanceDays: 30, noShowPenalty: 3, enabled: true },
        { deviceId: 'DEV-MR-01', deviceName: 'MR-1（西门子MAGNETOM Vida）', maxDailyAppointments: 40, maxPerTimeSlot: 3, minAdvanceDays: 1, maxAdvanceDays: 30, noShowPenalty: 3, enabled: true },
        { deviceId: 'DEV-DR-01', deviceName: 'DR-1（飞利浦DigitalDiagnost）', maxDailyAppointments: 80, maxPerTimeSlot: 5, minAdvanceDays: 0, maxAdvanceDays: 14, noShowPenalty: 2, enabled: true },
      ]
    }
  }

  /** 等候名单: 待确认预约 (SCHEDULED) + [W5] 托管队列 (WAITING), 按优先级+序号排序 */
  async waitlist(): Promise<Array<Record<string, any>>> {
    let dbItems: Array<Record<string, any>> = []
    try {
      const items = await this.prisma.appointment.findMany({
        where: { tenantId: currentTenantId(), state: 'SCHEDULED' },
        orderBy: { scheduledAt: 'asc' },
        take: 50,
        include: { patient: true },
      })
      dbItems = items.map((a) => ({
        id: a.id,
        patientName: a.patientName,
        phone: a.patient?.phone ?? '',
        examItemName: a.bodyPart ? `${a.modality} ${a.bodyPart}` : a.modality,
        modality: a.modality,
        preferredDate: a.scheduledAt.toISOString().slice(0, 10),
        preferredTime: `${String(a.scheduledAt.getHours()).padStart(2, '0')}:${String(a.scheduledAt.getMinutes()).padStart(2, '0')}`,
        priority: a.priority === 'STAT' ? 'critical' : a.priority === 'URGENT' ? 'urgent' : 'normal',
        addedAt: a.createdAt.toISOString().slice(0, 16).replace('T', ' '),
        notified: false,
      }))
    } catch (err) {
      this.logger.warn(`[Appointments] waitlist DB query failed, return managed only: ${(err as Error).message}`)
    }
    const managed: Array<Record<string, any>> = this.waitlistQueue
      .filter((w) => w.status === 'WAITING')
      .map((w) => ({ ...w }) as Record<string, any>)
    return [...dbItems, ...managed]
  }

  /** [W5] 加入等候队列 */
  addWaitlist(dto: WaitlistEntryDto): Record<string, any> {
    const seq = ++this.waitlistSeqCounter
    const entry = {
      id: `WL-${String(seq).padStart(3, '0')}`,
      patientName: dto.patientName,
      patientId: dto.patientId ?? '',
      phone: dto.phone ?? '',
      modality: dto.modality,
      bodyPart: dto.bodyPart ?? '',
      examItemName: dto.examItemName ?? `${dto.modality} ${dto.bodyPart ?? ''}`.trim(),
      priority: dto.priority ?? 'normal',
      preferredDate: dto.preferredDate ?? '',
      preferredTime: dto.preferredTime ?? '',
      seq,
      notified: false,
      status: 'WAITING',
      addedAt: this.now().toISOString().slice(0, 16).replace('T', ' '),
    }
    this.waitlistQueue.push(entry)
    return { ...entry }
  }

  /** [W5] 下一个可分配 (优先级 critical > urgent > normal, 同优先级按 seq) */
  nextWaitlist(): Record<string, any> | null {
    const weight: Record<string, number> = { critical: 0, urgent: 1, normal: 2 }
    const waiting = this.waitlistQueue.filter((w) => w.status === 'WAITING')
    if (waiting.length === 0) return null
    waiting.sort((a, b) => (weight[a.priority] ?? 9) - (weight[b.priority] ?? 9) || a.seq - b.seq)
    return { ...waiting[0] }
  }

  /** [W5] 分配等候患者到预约/时段 */
  assignWaitlist(id: string, payload?: { appointmentId?: string; deviceId?: string; startAt?: string | Date }): Record<string, any> {
    const entry = this.waitlistQueue.find((w) => w.id === id)
    if (!entry) throw new NotFoundException(`Waitlist ${id} not found`)
    entry.status = 'ASSIGNED'
    entry.assignedAt = this.now().toISOString()
    entry.appointmentId = payload?.appointmentId ?? null
    entry.deviceId = payload?.deviceId ?? null
    return { ...entry }
  }

  /** 提醒记录 (内存 seed, 兼容旧端点) */
  reminders() {
    return seedReminders
  }

  /** [W5] 提醒计划列表 */
  listReminderPlans(): Array<Record<string, any>> {
    return this.reminderPlans.map((p) => ({ ...p }))
  }

  /** [W5] 创建提醒计划 (按渠道套用模板) */
  createReminderPlan(dto: ReminderPlanDto): Record<string, any> {
    const channel = dto.channel
    const template = dto.template ?? REMINDER_TEMPLATES[channel] ?? REMINDER_TEMPLATES.SMS
    const plan = {
      id: `RP-${String(++this.reminderSeq).padStart(3, '0')}`,
      appointmentId: dto.appointmentId ?? null,
      patientName: dto.patientName,
      phone: dto.phone ?? '',
      channel,
      scheduledAt: new Date(dto.scheduledAt).toISOString(),
      status: 'PENDING',
      template,
      message: template,
      sentAt: null as string | null,
      createdAt: this.now().toISOString(),
    }
    this.reminderPlans.push(plan)
    return { ...plan }
  }

  /** [W5] 手动触发单个提醒 (模拟发送: 渲染模板 + 标记 SENT + 归档) */
  fireReminderPlan(id: string): Record<string, any> {
    const plan = this.reminderPlans.find((p) => p.id === id)
    if (!plan) throw new NotFoundException(`ReminderPlan ${id} not found`)
    const rendered = String(plan.template)
      .replace(/{{patient}}/g, String(plan.patientName))
      .replace(/{{exam}}/g, String(plan.exam ?? '影像检查'))
      .replace(/{{time}}/g, String(plan.scheduledAt))
      .replace(/{{room}}/g, String(plan.room ?? '放射科'))
      .replace(/{{prep}}/g, String(plan.prepInstruction ?? '按预约须知准备'))
    plan.message = rendered
    plan.status = 'SENT'
    plan.sentAt = this.now().toISOString()
    this.logger.log(`[Reminder][${plan.channel}] → ${plan.patientName} (${plan.phone}): ${rendered}`)
    return { ...plan }
  }

  /** [W5] 扫描到期提醒并发送 (cron 与手动端点共用) */
  fireDueReminders(at: Date = this.now()): Array<Record<string, any>> {
    const due = this.reminderPlans.filter((p) => p.status === 'PENDING' && new Date(p.scheduledAt).getTime() <= at.getTime())
    return due.map((p) => this.fireReminderPlan(String(p.id)))
  }

  /** [W5] Cron: 每 5 分钟扫描待发提醒 */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async reminderTick(): Promise<void> {
    try {
      const fired = this.fireDueReminders()
      if (fired.length > 0) this.logger.log(`[Reminder] fired ${fired.length} due reminders`)
    } catch (err) {
      this.logger.error(`[Reminder] tick failed: ${(err as Error).message}`)
    }
  }

  /** [W5] 提醒模板清单 */
  reminderTemplates(): Array<{ channel: ReminderChannel; template: string }> {
    return (Object.keys(REMINDER_TEMPLATES) as ReminderChannel[]).map((channel) => ({ channel, template: REMINDER_TEMPLATES[channel] }))
  }

  /** 改期记录 (内存 seed, 兼容旧端点) */
  reschedules() {
    return this.rescheduleList
  }

  /** [W5] 改期历史 (别名, 结构化) */
  rescheduleHistory() {
    return this.rescheduleList
  }

  /** 取消记录 (内存 seed, 兼容旧端点) */
  cancellations() {
    return seedCancellations
  }

  // ══════════════════════════════════════════════════════════════════
  // [W5] 失约引擎 (No-show)
  // ══════════════════════════════════════════════════════════════════
  /** 扫描超时未到检的预约, 标记 NO_SHOW */
  async runNoShowScan(thresholdMin = 30): Promise<{ scanned: number; marked: string[] }> {
    const cutoff = new Date(this.now().getTime() - thresholdMin * 60 * 1000)
    let rows: any[] = []
    try {
      rows = (await this.prisma.appointment.findMany({ where: { tenantId: currentTenantId() } })) as any[]
    } catch (err) {
      this.logger.warn(`[Appointments] no-show scan DB query failed: ${(err as Error).message}`)
    }
    const marked: string[] = []
    for (const a of rows) {
      if (!['CHECKED_IN', 'SCHEDULED', 'CONFIRMED', 'REGISTERED'].includes(a.state)) continue
      const at = a.scheduledAt instanceof Date ? a.scheduledAt : new Date(a.scheduledAt)
      if (at.getTime() > cutoff.getTime()) continue
      // DB 可用时更新状态; DB-less 时仅登记
      try {
        await this.prisma.appointment.update({ where: { id: a.id }, data: { state: 'NO_SHOW' } })
      } catch { /* noop */ }
      this.extended.set(a.id, { ...(this.extended.get(a.id) ?? {}), noShowAt: this.now().toISOString() })
      this.noShowRecords.push({
        id: `NS-${String(++this.noShowSeq).padStart(3, '0')}`,
        appointmentId: a.id,
        patientName: a.patientName,
        modality: a.modality,
        scheduledAt: at.toISOString(),
        thresholdMin,
        markedAt: this.now().toISOString(),
        status: 'NO_SHOW',
      })
      this.pushAudit(a.id, 'NO_SHOW', null, { thresholdMin })
      marked.push(a.id)
    }
    return { scanned: rows.length, marked }
  }

  /** [W5] 失约 Cron (每 10 分钟) */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async noShowTick(): Promise<void> {
    try {
      const res = await this.runNoShowScan()
      if (res.marked.length > 0) this.logger.log(`[NoShow] marked ${res.marked.length} appointments`)
    } catch (err) {
      this.logger.error(`[NoShow] tick failed: ${(err as Error).message}`)
    }
  }

  listNoShow(): Array<Record<string, any>> {
    return this.noShowRecords.map((r) => ({ ...r }))
  }

  markNoShow(id: string, thresholdMin = 0): Record<string, any> {
    const ext = this.extended.get(id) ?? {}
    ext.noShowAt = this.now().toISOString()
    this.extended.set(id, ext)
    const record = {
      id: `NS-${String(++this.noShowSeq).padStart(3, '0')}`,
      appointmentId: id,
      thresholdMin,
      markedAt: ext.noShowAt,
      status: 'NO_SHOW',
    }
    this.noShowRecords.push(record)
    this.pushAudit(id, 'NO_SHOW_MANUAL', null, { thresholdMin })
    return record
  }

  restoreNoShow(id: string): Record<string, any> {
    const idx = this.noShowRecords.findIndex((r) => r.appointmentId === id)
    if (idx < 0) throw new NotFoundException(`No-show record for ${id} not found`)
    const [rec] = this.noShowRecords.splice(idx, 1)
    const ext = this.extended.get(id)
    if (ext) ext.noShowAt = null
    this.pushAudit(id, 'NO_SHOW_RESTORE', null, {})
    return { ...rec, status: 'RESTORED' }
  }

  // ══════════════════════════════════════════════════════════════════
  // [W5] 急诊绿色通道
  // ══════════════════════════════════════════════════════════════════
  /**
   * 绿色通道: 为急诊 STAT 预约保留下一个可用时段 (同设备无冲突的最近 30min 槽)
   * 返回保留记录 (不落库, 供前端向导立即创建)。
   */
  async greenChannel(dto: { patientName: string; patientId?: string; modality: string; bodyPart?: string; deviceId: string; deviceName?: string; roomId?: string; technicianId?: string; createdById?: string; startAt?: string | Date }): Promise<Record<string, any>> {
    const base = dto.startAt ? new Date(dto.startAt) : this.now()
    let reservedAt: Date | null = null
    for (let i = 0; i < 8 && !reservedAt; i += 1) {
      const candidate = new Date(base.getTime() + i * 30 * 60 * 1000)
      const conflicts = await this.detectConflicts({
        deviceId: dto.deviceId,
        roomId: dto.roomId,
        technicianId: dto.technicianId,
        patientId: dto.patientId,
        modality: dto.modality,
        startAt: candidate,
        endAt: new Date(candidate.getTime() + 30 * 60 * 1000),
      })
      if (!conflictEngine.hasBlockingConflict(conflicts)) reservedAt = candidate
    }
    if (!reservedAt) throw new ConflictException('绿色通道: 未来 4 小时内无可用时段')
    const reservation = {
      id: `GC-${Date.now()}`,
      patientName: dto.patientName,
      patientId: dto.patientId ?? '',
      modality: dto.modality,
      bodyPart: dto.bodyPart ?? '',
      deviceId: dto.deviceId,
      deviceName: dto.deviceName ?? '',
      roomId: dto.roomId ?? null,
      technicianId: dto.technicianId ?? null,
      reservedStartAt: reservedAt.toISOString(),
      reservedEndAt: new Date(reservedAt.getTime() + 30 * 60 * 1000).toISOString(),
      priority: 'STAT',
      greenChannel: true,
      createdById: dto.createdById ?? null,
      createdAt: this.now().toISOString(),
    }
    this.greenChannelReservations.push(reservation)
    return { ...reservation }
  }

  listGreenChannel(): Array<Record<string, any>> {
    return this.greenChannelReservations.map((r) => ({ ...r }))
  }

  // ══════════════════════════════════════════════════════════════════
  // [W5] 编号策略 / 审计
  // ══════════════════════════════════════════════════════════════════
  /** 生成下一个检查号 (accession policy) */
  nextAccession(modality: string, opts?: { year?: number }): string {
    return accessionPolicy.next(modality, opts)
  }

  /** 解析检查号 */
  parseAccession(accession: string) {
    return accessionPolicy.parse(accession)
  }

  appointmentAudit(appointmentId?: string): Array<Record<string, any>> {
    const list = appointmentId ? this.auditLog.filter((e) => e.appointmentId === appointmentId) : this.auditLog
    return list.map((e) => ({ ...e }))
  }

  private pushAudit(appointmentId: string, action: string, actorId: string | null, detail: Record<string, unknown>): void {
    this.auditLog.push({
      id: `AA-${String(++this.auditSeq).padStart(4, '0')}`,
      appointmentId,
      action,
      actorId,
      detail,
      at: this.now().toISOString(),
    })
  }

  /** 合并增强字段到预约对象 */
  private decorate<T extends Record<string, any>>(a: T): T {
    const ext = this.extended.get(a.id)
    if (!ext) return a
    return { ...a, ...ext }
  }
}
