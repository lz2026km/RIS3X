import { AccessionPolicy } from './accession.policy'
import { ConflictEngine, type ConflictContext } from './conflict.engine'
import { AppointmentsService } from './appointments.service'

const baseCtx = (over: Partial<ConflictContext> = {}): ConflictContext => ({
  candidate: {
    deviceId: 'dev-1',
    roomId: 'room-1',
    technicianId: 'tech-1',
    patientId: 'p-1',
    modality: 'CT',
    startAt: new Date('2026-08-05T09:00:00'),
    endAt: new Date('2026-08-05T09:30:00'),
  },
  existing: [],
  ...over,
})

const other = (over: Record<string, unknown> = {}) => ({
  id: 'a-1',
  deviceId: 'dev-1',
  roomId: 'room-1',
  technicianId: 'tech-1',
  patientId: 'p-9',
  state: 'SCHEDULED',
  scheduledAt: new Date('2026-08-05T09:15:00'),
  endAt: new Date('2026-08-05T09:45:00'),
  ...over,
})

describe('ConflictEngine (跨资源冲突检测)', () => {
  const engine = new ConflictEngine()

  it('无重叠时无冲突', () => {
    const conflicts = engine.detect(baseCtx({ existing: [other({ scheduledAt: new Date('2026-08-05T10:00:00'), endAt: new Date('2026-08-05T10:30:00') })] }))
    expect(conflicts).toHaveLength(0)
    expect(engine.hasBlockingConflict(conflicts)).toBe(false)
  })

  it('设备重叠 → DEVICE ERROR', () => {
    const conflicts = engine.detect(baseCtx({ existing: [other()] }))
    expect(conflicts.some((c) => c.type === 'DEVICE' && c.severity === 'ERROR')).toBe(true)
    expect(engine.hasBlockingConflict(conflicts)).toBe(true)
    expect(conflicts.find((c) => c.type === 'DEVICE')?.conflictingId).toBe('a-1')
  })

  it('机房重叠 → ROOM ERROR', () => {
    const conflicts = engine.detect(baseCtx({ existing: [other({ deviceId: 'dev-X' })] }))
    expect(conflicts.some((c) => c.type === 'ROOM' && c.severity === 'ERROR')).toBe(true)
  })

  it('技师重叠 → TECHNICIAN ERROR', () => {
    const conflicts = engine.detect(baseCtx({ existing: [other({ deviceId: 'dev-X', roomId: 'room-X' })] }))
    expect(conflicts.some((c) => c.type === 'TECHNICIAN' && c.severity === 'ERROR')).toBe(true)
  })

  it('患者重叠 → PATIENT ERROR', () => {
    const conflicts = engine.detect(baseCtx({ existing: [other({ deviceId: 'dev-X', roomId: 'room-X', technicianId: 'tech-X', patientId: 'p-1' })] }))
    expect(conflicts.some((c) => c.type === 'PATIENT' && c.severity === 'ERROR')).toBe(true)
  })

  it('时段容量: 设备同槽已有 2 例 + 上限 2 → SLOT_CAPACITY ERROR', () => {
    const existing = [
      other({ id: 'a-1', roomId: null, technicianId: null, scheduledAt: new Date('2026-08-05T09:05:00'), endAt: new Date('2026-08-05T09:35:00') }),
      other({ id: 'a-2', roomId: null, technicianId: null, scheduledAt: new Date('2026-08-05T09:10:00'), endAt: new Date('2026-08-05T09:40:00') }),
    ]
    const conflicts = engine.detect(baseCtx({ existing, deviceRule: { maxPerSlot: 2, openTime: '07:00', closeTime: '21:00' } }))
    expect(conflicts.some((c) => c.type === 'SLOT_CAPACITY' && c.severity === 'ERROR')).toBe(true)
  })

  it('工作时间外 → WORKING_HOURS WARN (不阻断)', () => {
    const ctx = baseCtx({
      candidate: { ...baseCtx().candidate, startAt: new Date('2026-08-05T05:00:00'), endAt: new Date('2026-08-05T05:30:00') },
      deviceRule: { maxPerSlot: 4, openTime: '08:00', closeTime: '18:00' },
    })
    const conflicts = engine.detect(ctx)
    const warn = conflicts.find((c) => c.type === 'WORKING_HOURS')
    expect(warn?.severity).toBe('WARN')
    expect(engine.hasBlockingConflict(conflicts)).toBe(false)
  })

  it('设备维护状态 → MAINTENANCE ERROR', () => {
    const conflicts = engine.detect(baseCtx({
      devices: [{ id: 'dev-1', name: 'CT-1', modality: 'CT', state: 'MAINTENANCE' }],
    }))
    expect(conflicts.some((c) => c.type === 'MAINTENANCE' && c.severity === 'ERROR')).toBe(true)
  })

  it('维护窗口重叠 → MAINTENANCE ERROR', () => {
    const conflicts = engine.detect(baseCtx({
      devices: [{
        id: 'dev-1', name: 'CT-1', modality: 'CT', state: 'IDLE',
        maintenanceFrom: '2026-08-05T08:00:00', maintenanceTo: '2026-08-05T10:00:00',
      }],
    }))
    expect(conflicts.some((c) => c.type === 'MAINTENANCE' && c.severity === 'ERROR')).toBe(true)
  })

  it('技师班次外 → SHIFT WARN', () => {
    const conflicts = engine.detect(baseCtx({
      technicians: [{ id: 'tech-1', name: '王技师', modality: 'CT', status: 'ACTIVE', shiftStart: '12:00', shiftEnd: '20:00' }],
    }))
    expect(conflicts.some((c) => c.type === 'SHIFT' && c.severity === 'WARN')).toBe(true)
  })

  it('excludeId 忽略自身 (改期场景)', () => {
    const conflicts = engine.detect(baseCtx({ existing: [other()], excludeId: 'a-1' }))
    expect(conflicts).toHaveLength(0)
  })

  it('非活跃状态预约不参与冲突', () => {
    const conflicts = engine.detect(baseCtx({ existing: [other({ state: 'CANCELLED' })] }))
    expect(conflicts).toHaveLength(0)
  })
})

describe('AccessionPolicy (检查号编号策略)', () => {
  it('按模态+年度自增, 含校验位', () => {
    const policy = new AccessionPolicy(2026)
    const a1 = policy.next('CT')
    const a2 = policy.next('CT')
    expect(a1).toMatch(/^CT2026\d{5}\d$/)
    expect(a2).toMatch(/^CT2026\d{5}\d$/)
    expect(a1).not.toBe(a2)
    expect(policy.peek('CT')).toBe(2)
  })

  it('不同模态序列相互独立', () => {
    const policy = new AccessionPolicy(2026)
    const ct = policy.next('CT')
    const mr = policy.next('MR')
    expect(ct.startsWith('CT2026')).toBe(true)
    expect(mr.startsWith('MR2026')).toBe(true)
    expect(policy.peek('CT')).toBe(1)
    expect(policy.peek('MR')).toBe(1)
  })

  it('parse 校验位有效 → valid=true 且字段还原', () => {
    const policy = new AccessionPolicy(2026)
    const acc = policy.next('DR')
    const parsed = policy.parse(acc)
    expect(parsed.valid).toBe(true)
    expect(parsed.modality).toBe('DR')
    expect(parsed.year).toBe(2026)
    expect(parsed.seq).toBe(1)
  })

  it('parse 篡改校验位 → valid=false', () => {
    const policy = new AccessionPolicy(2026)
    const acc = policy.next('US')
    const tampered = acc.slice(0, -1) + ((Number(acc.slice(-1)) + 1) % 10)
    expect(policy.parse(tampered).valid).toBe(false)
  })

  it('parse 非法格式 → valid=false', () => {
    const policy = new AccessionPolicy(2026)
    expect(policy.parse('ACC-123').valid).toBe(false)
  })
})

describe('AppointmentsService 等候队列 (Waitlist)', () => {
  const makePrisma = () => ({
    appointment: {
      findMany: async () => [],
      count: async () => 0,
      findFirst: async () => null,
      findUnique: async () => null,
      update: async ({ data }: any) => data,
    },
    device: { findMany: async () => [] },
  })

  it('addWaitlist 入队并 listWaitlist 可见', () => {
    const service = new AppointmentsService(makePrisma() as any)
    const before = service.listTechnicians().length
    expect(before).toBeGreaterThan(0)
    const entry = service.addWaitlist({ patientName: '测试甲', modality: 'CT', priority: 'normal' })
    expect(entry.status).toBe('WAITING')
    expect(entry.seq).toBeGreaterThan(0)
    const next = service.nextWaitlist()
    expect(next?.patientName).toBeTruthy()
  })

  it('nextWaitlist 按优先级 critical > urgent > normal', () => {
    const service = new AppointmentsService(makePrisma() as any)
    // 先排空 seed 队列 (确定性)
    let seeded = service.nextWaitlist()
    while (seeded) {
      service.assignWaitlist(seeded.id)
      seeded = service.nextWaitlist()
    }
    service.addWaitlist({ patientName: '普通', modality: 'CT', priority: 'normal' })
    service.addWaitlist({ patientName: '加急', modality: 'CT', priority: 'urgent' })
    service.addWaitlist({ patientName: '危重', modality: 'CT', priority: 'critical' })
    expect(service.nextWaitlist()?.patientName).toBe('危重')
  })

  it('assignWaitlist 标记 ASSIGNED 且不再出现在 next', async () => {
    const service = new AppointmentsService(makePrisma() as any)
    const entry = service.addWaitlist({ patientName: '待分配', modality: 'MR', priority: 'critical' })
    const assigned = service.assignWaitlist(entry.id, { deviceId: 'dev-9' })
    expect(assigned.status).toBe('ASSIGNED')
    expect(assigned.deviceId).toBe('dev-9')
    const stillWaiting = (await service.waitlist()).filter((w) => w.status === 'WAITING')
    expect(stillWaiting.some((w) => w.id === entry.id)).toBe(false)
  })
})
