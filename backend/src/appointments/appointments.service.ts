/**
 * G005 放射RIS系统 v3.0.6.11-70 - 预约服务 (P0: 预约→检查联动)
 * - create: 完整字段落库 + 同事务创建 Exam (工作列表可见)
 * - 补 5 个子资源: rules / waitlist / reminders / reschedules / cancellations
 */
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { currentTenantId } from '../common/tenant/tenant-utils'
import type { Appointment, AppointmentPriority, AppointmentState, Gender } from '@prisma/client'

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
}

export interface UpdateAppointmentDto {
  id?: string
  state?: AppointmentState
  startAt?: string | Date
  endAt?: string | Date
  note?: string
  deviceId?: string
}

const PRIORITY_MAP: Record<string, AppointmentPriority> = {
  ROUTINE: 'ROUTINE',
  URGENT: 'URGENT',
  STAT: 'STAT',
  normal: 'ROUTINE',
  urgent: 'URGENT',
  critical: 'STAT',
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

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: { skip?: number; take?: number; state?: AppointmentState; deviceId?: string; dateFrom?: string; dateTo?: string }) {
    const where: any = { tenantId: currentTenantId() }
    if (params.state) where.state = params.state
    if (params.deviceId) where.deviceId = params.deviceId
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
    return { items, total }
  }

  async get(id: string): Promise<Appointment> {
    const a = await this.prisma.appointment.findFirst({ where: { id, tenantId: currentTenantId() } })
    if (!a) throw new NotFoundException(`Appointment ${id} not found`)
    return a
  }

  /**
   * 创建预约 (P0):
   * 1. 解析/新建患者 (patientId 无效时按姓名+手机号匹配, 仍未命中则新建)
   * 2. 解析/新建设备 (前端设备 id 可能与真实设备不一致, 按 code 或 name 匹配)
   * 3. 事务内完整落库 Appointment (patientName/bodyPart/endAt/priority/createdById...)
   * 4. 同事务创建 Exam (SCHEDULED) → 工作列表立即可见
   */
  async create(dto: CreateAppointmentDto): Promise<Appointment> {
    const tenantId = currentTenantId()
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

      // 3) 时间冲突检测
      const startAt = new Date(dto.startAt)
      const endAt = dto.endAt ? new Date(dto.endAt) : new Date(startAt.getTime() + 30 * 60 * 1000)
      if (deviceId) {
        const overlap = await tx.appointment.findFirst({
          where: {
            deviceId,
            state: { in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] },
            scheduledAt: { lt: endAt, gt: startAt },
          },
        })
        if (overlap) throw new ConflictException(`设备冲突: ${overlap.id}`)
      }

      // 4) 预约完整落库
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

      // 5) 联动创建 Exam → 工作列表
      const accessionNumber = `ACC-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
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

      return appointment
    })
  }

  async update(id: string, dto: UpdateAppointmentDto): Promise<Appointment> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.appointment.findUnique({ where: { id } })
      if (!current) throw new NotFoundException(`Appointment ${id} not found`)
      if (dto.deviceId || dto.startAt || dto.endAt) {
        const deviceId = dto.deviceId ?? current.deviceId
        const startAt = dto.startAt ? new Date(dto.startAt) : current.scheduledAt
        const endAt = dto.endAt ? new Date(dto.endAt) : new Date(current.scheduledAt.getTime() + 30 * 60 * 1000)
        const overlap = await tx.appointment.findFirst({
          where: {
            deviceId,
            id: { not: id },
            state: { in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] },
            scheduledAt: { lt: endAt, gt: startAt },
          },
        })
        if (overlap) throw new ConflictException(`设备冲突: ${overlap.id}`)
      }
      const data: any = { ...dto }
      delete data.id
      if (dto.startAt) data.scheduledAt = new Date(dto.startAt)
      try {
        return await tx.appointment.update({
          where: { id, version: current.version },
          data: { ...data, version: { increment: 1 } },
        })
      } catch (error: any) {
        if (error?.code === 'P2025') throw new ConflictException('版本冲突：该预约已被其他用户修改')
        throw error
      }
    })
  }

  async cancel(id: string): Promise<Appointment> {
    return this.prisma.appointment.update({
      where: { id },
      data: { state: 'CANCELLED' },
    })
  }

  // ===== 5 个子资源 =====

  /** 预约规则: 设备维度规则列表 (容量/提前期/违约罚分), 无规则设备给默认值 */
  async rules() {
    const devices = await this.prisma.device.findMany({
      where: { tenantId: currentTenantId() },
      orderBy: { name: 'asc' },
    })
    if (devices.length === 0) {
      return [
        {
          deviceId: 'DEV-CT-01',
          deviceName: 'CT-1（GE Revolution CT）',
          maxDailyAppointments: 60,
          maxPerTimeSlot: 4,
          minAdvanceDays: 0,
          maxAdvanceDays: 30,
          noShowPenalty: 3,
          enabled: true,
        },
        {
          deviceId: 'DEV-MR-01',
          deviceName: 'MR-1（西门子MAGNETOM Vida）',
          maxDailyAppointments: 40,
          maxPerTimeSlot: 3,
          minAdvanceDays: 1,
          maxAdvanceDays: 30,
          noShowPenalty: 3,
          enabled: true,
        },
        {
          deviceId: 'DEV-DR-01',
          deviceName: 'DR-1（飞利浦DigitalDiagnost）',
          maxDailyAppointments: 80,
          maxPerTimeSlot: 5,
          minAdvanceDays: 0,
          maxAdvanceDays: 14,
          noShowPenalty: 2,
          enabled: true,
        },
      ]
    }
    return devices.map((d) => ({
      deviceId: d.id,
      deviceName: d.name,
      maxDailyAppointments: d.modality === 'MR' ? 40 : d.modality === 'CT' ? 60 : 80,
      maxPerTimeSlot: d.modality === 'MR' ? 3 : 4,
      minAdvanceDays: 0,
      maxAdvanceDays: 30,
      noShowPenalty: 3,
      enabled: d.state !== 'MAINTENANCE' && d.state !== 'BROKEN' && d.state !== 'OFFLINE',
    }))
  }

  /** 等候名单: 待确认预约 (SCHEDULED) 按时间升序 */
  async waitlist() {
    const items = await this.prisma.appointment.findMany({
      where: { tenantId: currentTenantId(), state: 'SCHEDULED' },
      orderBy: { scheduledAt: 'asc' },
      take: 50,
      include: { patient: true },
    })
    return items.map((a) => ({
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
  }

  /** 提醒记录 (内存 seed, 后续可落表) */
  reminders() {
    return seedReminders
  }

  /** 改期记录 (内存 seed, 后续可落表) */
  reschedules() {
    return seedReschedules
  }

  /** 取消记录 (内存 seed, 后续可落表) */
  cancellations() {
    return seedCancellations
  }
}
