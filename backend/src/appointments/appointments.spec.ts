import { BadRequestException, ConflictException } from '@nestjs/common'
import { AppointmentsService, CreateAppointmentDto } from './appointments.service'
import { tenantStorage } from '../common/interceptors/tenant-context.interceptor'

/**
 * P0 预约→检查联动: 单元测试 (内存假 Prisma)
 * 覆盖: 完整字段落库 / 事务内联动创建 Exam / 患者自动解析 / 冲突检测 / 5 个子资源
 */
interface AnyRow {
  id: string
  [k: string]: any
}

const makePrisma = () => {
  const appointments = new Map<string, AnyRow>()
  const patients = new Map<string, AnyRow>()
  const devices = new Map<string, AnyRow>()
  const exams = new Map<string, AnyRow>()

  let seq = 0
  const nextId = () => `id-${++seq}`

  const tx = {
    appointment: {
      findUnique: async ({ where }: any) => appointments.get(where.id) ?? null,
      findFirst: async ({ where }: any) => {
        for (const a of appointments.values()) {
          if (where?.deviceId && a.deviceId !== where.deviceId) continue
          if (where?.state?.in && !where.state.in.includes(a.state)) continue
          if (where?.scheduledAt?.lt && !(a.scheduledAt < new Date(where.scheduledAt.lt))) continue
          if (where?.scheduledAt?.gt && !(a.scheduledAt > new Date(where.scheduledAt.gt))) continue
          return a
        }
        return null
      },
      create: async ({ data }: any) => {
        const a: AnyRow = { ...data, id: nextId(), version: 0, createdAt: new Date() }
        appointments.set(a.id, a)
        return a
      },
      update: async ({ where, data }: any) => {
        const a = appointments.get(where.id)
        if (!a) throw { code: 'P2025' }
        const updated = { ...a, ...data }
        appointments.set(a.id, updated)
        return updated
      },
    },
    patient: {
      findUnique: async ({ where }: any) => patients.get(where.id) ?? null,
      findFirst: async ({ where }: any) => {
        for (const p of patients.values()) {
          if (where?.name && p.name === where.name) return p
        }
        return null
      },
      create: async ({ data }: any) => {
        const p: AnyRow = { ...data, id: nextId(), createdAt: new Date() }
        patients.set(p.id, p)
        return p
      },
    },
    device: {
      findUnique: async ({ where }: any) => devices.get(where.id) ?? null,
      findFirst: async ({ where }: any) => {
        const ors: any[] = where?.OR ?? []
        for (const d of devices.values()) {
          for (const o of ors) {
            if (o.code && d.code === o.code) return d
            if (o.name && d.name === o.name) return d
          }
        }
        return null
      },
      create: async ({ data }: any) => {
        const d: AnyRow = { ...data, id: nextId(), version: 0 }
        devices.set(d.id, d)
        return d
      },
    },
    exam: {
      create: jest.fn(async ({ data }: any) => {
        const e: AnyRow = { ...data, id: nextId(), version: 0 }
        exams.set(e.id, e)
        return e
      }),
    },
  }

  const prisma = {
    $transaction: async (fn: any) => fn(tx),
    appointment: {
      findUnique: async ({ where }: any) => appointments.get(where.id) ?? null,
      findMany: async ({ where }: any = {}) => {
        if (where?.state) return [...appointments.values()].filter((a) => a.state === where.state)
        return [...appointments.values()]
      },
      count: async () => appointments.size,
      update: async ({ where, data }: any) => {
        const a = appointments.get(where.id)
        if (!a) throw { code: 'P2025' }
        const updated = { ...a, ...data }
        appointments.set(a.id, updated)
        return updated
      },
    },
    device: {
      findMany: async () => [...devices.values()],
    },
  }

  return { prisma: prisma as any, tx, appointments, patients, devices, exams }
}

const withTenant = async <T>(tenantId: string, fn: () => Promise<T>): Promise<T> =>
  tenantStorage.run({ tenantId, enforce: false }, () => fn())

const baseDto = (overrides: Partial<CreateAppointmentDto> = {}): CreateAppointmentDto => ({
  patientName: '测试患者',
  patientId: 'unknown-patient-id',
  modality: 'CT',
  bodyPart: '胸部',
  startAt: '2026-08-05T01:00:00.000Z',
  endAt: '2026-08-05T01:30:00.000Z',
  deviceId: 'DEV-CT-X1',
  deviceName: 'CT-1（GE Revolution CT）',
  priority: 'URGENT',
  note: '空腹检查',
  createdById: 'user-1',
  ...overrides,
})

describe('AppointmentsService (P0 预约→检查联动)', () => {
  it('create 完整落库: patientName/bodyPart/endAt/priority/createdById 全部写入', async () => {
    const { prisma, appointments } = makePrisma()
    const service = new AppointmentsService(prisma)
    const created = await withTenant('default', () => service.create(baseDto()))

    expect(created.patientName).toBe('测试患者')
    expect(created.bodyPart).toBe('胸部')
    expect(created.endAt).toBeInstanceOf(Date)
    expect(created.priority).toBe('URGENT')
    expect(created.createdById).toBe('user-1')
    expect(created.scheduledAt.toISOString()).toBe('2026-08-05T01:00:00.000Z')
    expect(created.state).toBe('SCHEDULED')
    const stored = appointments.get(created.id)
    expect(stored!.patientName).toBe('测试患者')
    expect(stored!.priority).toBe('URGENT')
    expect(stored!.tenantId).toBe('default')
  })

  it('create 同事务创建 Exam (SCHEDULED), patientId 与预约一致', async () => {
    const { prisma, tx, exams } = makePrisma()
    const service = new AppointmentsService(prisma)
    const created = await withTenant('default', () => service.create(baseDto()))

    expect(tx.exam.create).toHaveBeenCalledTimes(1)
    const examArgs = tx.exam.create.mock.calls[0][0]
    expect(examArgs.data.state).toBe('SCHEDULED')
    expect(examArgs.data.patientId).toBe(created.patientId)
    expect(examArgs.data.bodyPart).toBe('胸部')
    expect(examArgs.data.accessionNumber).toMatch(/^ACC-/)
    expect(exams.size).toBe(1)
  })

  it('create 患者自动解析: patientId 无效时按姓名匹配已有患者', async () => {
    const { prisma, patients } = makePrisma()
    const service = new AppointmentsService(prisma)
    // 先种一个患者
    patients.set('p-seed', { id: 'p-seed', name: '张三', gender: 'MALE', tenantId: 'default' })
    const created = await withTenant('default', () =>
      service.create(baseDto({ patientName: '张三' })),
    )
    expect(created.patientId).toBe('p-seed')
  })

  it('create 患者自动新建: 姓名也匹配不到时创建新患者', async () => {
    const { prisma, patients } = makePrisma()
    const service = new AppointmentsService(prisma)
    const created = await withTenant('default', () =>
      service.create(baseDto({ gender: 'FEMALE', phone: '13800138000' })),
    )
    const p = patients.get(created.patientId)
    expect(p).toBeTruthy()
    expect(p!.name).toBe('测试患者')
    expect(p!.gender).toBe('FEMALE')
    expect(p!.phone).toBe('13800138000')
  })

  it('create 设备自动解析: 按 code 匹配现有设备', async () => {
    const { prisma, devices } = makePrisma()
    const service = new AppointmentsService(prisma)
    devices.set('dev-1', { id: 'dev-1', code: 'DEV-CT-X1', name: 'CT-1（GE Revolution CT）', modality: 'CT', tenantId: 'default' })
    const created = await withTenant('default', () => service.create(baseDto()))
    expect(created.deviceId).toBe('dev-1')
  })

  it('create 时间冲突: 同设备重叠时段抛 ConflictException 且不创建 Exam', async () => {
    const { prisma, devices, appointments, tx } = makePrisma()
    const service = new AppointmentsService(prisma)
    devices.set('dev-1', { id: 'dev-1', code: 'DEV-CT-X1', name: 'CT-1（GE Revolution CT）', modality: 'CT', tenantId: 'default' })
    appointments.set('a-1', {
      id: 'a-1',
      deviceId: 'dev-1',
      state: 'SCHEDULED',
      scheduledAt: new Date('2026-08-05T01:15:00.000Z'),
      tenantId: 'default',
    })
    await expect(withTenant('default', () => service.create(baseDto()))).rejects.toBeInstanceOf(
      ConflictException,
    )
    expect(tx.exam.create).not.toHaveBeenCalled()
  })

  it('waitlist 返回 SCHEDULED 预约并按 DTO 形状映射', async () => {
    const { prisma, appointments } = makePrisma()
    const service = new AppointmentsService(prisma)
    appointments.set('a-1', {
      id: 'a-1',
      patientName: '张三',
      modality: 'CT',
      bodyPart: '胸部',
      priority: 'URGENT',
      state: 'SCHEDULED',
      scheduledAt: new Date('2026-08-05T01:00:00.000Z'),
      createdAt: new Date('2026-08-04T10:00:00.000Z'),
      tenantId: 'default',
    })
    const list = await withTenant('default', () => service.waitlist())
    expect(list).toHaveLength(1)
    expect(list[0].patientName).toBe('张三')
    expect(list[0].priority).toBe('urgent')
    expect(list[0].preferredDate).toBe('2026-08-05')
    expect(list[0].preferredTime).toBe('09:00')
  })

  it('rules 返回设备规则列表 (含默认规则兜底)', async () => {
    const { prisma } = makePrisma()
    const service = new AppointmentsService(prisma)
    const rules = await withTenant('default', () => service.rules())
    expect(Array.isArray(rules)).toBe(true)
    expect(rules.length).toBeGreaterThan(0)
    expect(rules[0]).toHaveProperty('maxDailyAppointments')
    expect(rules[0]).toHaveProperty('enabled')
  })

  it('reminders / reschedules / cancellations 返回 seed 记录', () => {
    const { prisma } = makePrisma()
    const service = new AppointmentsService(prisma)
    expect(service.reminders().length).toBeGreaterThan(0)
    expect(service.reminders()[0]).toHaveProperty('channel')
    expect(service.reschedules().length).toBeGreaterThan(0)
    expect(service.reschedules()[0]).toHaveProperty('reason')
    expect(service.cancellations().length).toBeGreaterThan(0)
    expect(service.cancellations()[0]).toHaveProperty('rebooked')
  })

  it('cancel 将状态置为 CANCELLED', async () => {
    const { prisma, appointments } = makePrisma()
    const service = new AppointmentsService(prisma)
    appointments.set('a-1', {
      id: 'a-1',
      patientName: '张三',
      modality: 'CT',
      state: 'SCHEDULED',
      tenantId: 'default',
      scheduledAt: new Date(),
      version: 0,
    })
    const cancelled = await service.cancel('a-1')
    expect(cancelled.state).toBe('CANCELLED')
  })

  // [v3.0.6.11-104 Wave 1B] 预约状态机门禁: 非法流转 400 / 合法流转 200
  describe('状态机门禁 (APPOINTMENT_TRANSITIONS)', () => {
    const seedAppointment = (appointments: Map<string, AnyRow>, state: string) =>
      appointments.set('a-1', {
        id: 'a-1',
        patientName: '张三',
        modality: 'CT',
        state,
        tenantId: 'default',
        scheduledAt: new Date(),
        version: 0,
      })

    it('合法流转: SCHEDULED → CONFIRMED 通过并落库', async () => {
      const { prisma, appointments } = makePrisma()
      const service = new AppointmentsService(prisma)
      seedAppointment(appointments, 'SCHEDULED')
      const updated = await service.update('a-1', { state: 'CONFIRMED' })
      expect(updated.state).toBe('CONFIRMED')
    })

    it('合法流转: REGISTERED → CHECKED_IN 通过 (补齐枚举后可用)', async () => {
      const { prisma, appointments } = makePrisma()
      const service = new AppointmentsService(prisma)
      seedAppointment(appointments, 'REGISTERED')
      const updated = await service.update('a-1', { state: 'CHECKED_IN' })
      expect(updated.state).toBe('CHECKED_IN')
    })

    it('非法跳转: SCHEDULED → COMPLETED 抛 400 且含当前态合法去向', async () => {
      const { prisma, appointments } = makePrisma()
      const service = new AppointmentsService(prisma)
      seedAppointment(appointments, 'SCHEDULED')
      await expect(service.update('a-1', { state: 'COMPLETED' })).rejects.toBeInstanceOf(BadRequestException)
      await expect(service.update('a-1', { state: 'COMPLETED' })).rejects.toThrow('INVALID_TRANSITION')
      await expect(service.update('a-1', { state: 'COMPLETED' })).rejects.toThrow('CONFIRMED')
    })

    it('终态不可变: COMPLETED → IN_PROGRESS 抛 400', async () => {
      const { prisma, appointments } = makePrisma()
      const service = new AppointmentsService(prisma)
      seedAppointment(appointments, 'COMPLETED')
      await expect(service.update('a-1', { state: 'IN_PROGRESS' })).rejects.toThrow('INVALID_TRANSITION')
    })

    it('同态幂等放行: SCHEDULED → SCHEDULED 不报错', async () => {
      const { prisma, appointments } = makePrisma()
      const service = new AppointmentsService(prisma)
      seedAppointment(appointments, 'SCHEDULED')
      const updated = await service.update('a-1', { state: 'SCHEDULED' })
      expect(updated.state).toBe('SCHEDULED')
    })
  })
})
