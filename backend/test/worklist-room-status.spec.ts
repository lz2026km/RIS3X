import { WorklistService } from '../src/modules/worklist/worklist.service'

// [v3.0.6.11-100 Wave 1B] 检查间实时状态看板 (房间级): GET /worklist/room-status
describe('WorklistService Wave1B (getRoomStatus 房间实时看板)', () => {
  let svc: WorklistService
  let mockPrisma: any

  const now = new Date()
  const mkExam = (overrides: Record<string, unknown>) => ({
    id: 'E1',
    tenantId: 'default',
    patientId: 'P1',
    state: 'IN_PROGRESS',
    modality: 'CT',
    startedAt: null,
    completedAt: null,
    createdAt: new Date(now.getTime() - 86400000),
    device: { id: 'D1', name: 'CT-01', modality: 'CT', location: 'CT室1' },
    patient: { name: '张三' },
    ...overrides,
  })
  const mkDevice = (overrides: Record<string, unknown>) => ({
    id: 'D1',
    tenantId: 'default',
    name: 'CT-01',
    modality: 'CT',
    location: 'CT室1',
    ...overrides,
  })

  beforeEach(() => {
    mockPrisma = {
      exam: { findMany: jest.fn() },
      device: { findMany: jest.fn() },
    }
    svc = new WorklistService(mockPrisma)
  })

  describe('getRoomStatus', () => {
    it('derives rooms from device.location and marks in_use with current exam', async () => {
      mockPrisma.device.findMany.mockResolvedValue([mkDevice({})])
      mockPrisma.exam.findMany.mockResolvedValue([
        mkExam({ id: 'E1', state: 'IN_PROGRESS', startedAt: new Date(now.getTime() - 5 * 60000), patient: { name: '张三' } }),
      ])
      const r = await svc.getRoomStatus()
      expect(r.rooms).toHaveLength(1)
      const room = r.rooms[0]!
      expect(room.name).toBe('CT室1')
      expect(room.modality).toBe('CT')
      expect(room.status).toBe('in_use')
      expect(room.currentExam).toMatchObject({ id: 'E1', patientName: '张三', state: 'IN_PROGRESS' })
      expect(room.queueLength).toBe(1)
    })

    it('marks paused when room has PAUSED exam (no IN_PROGRESS)', async () => {
      mockPrisma.device.findMany.mockResolvedValue([mkDevice({})])
      mockPrisma.exam.findMany.mockResolvedValue([
        mkExam({ id: 'E1', state: 'PAUSED', startedAt: new Date(now.getTime() - 20 * 60000) }),
      ])
      const r = await svc.getRoomStatus()
      expect(r.rooms[0]!.status).toBe('paused')
      expect(r.rooms[0]!.currentExam).toMatchObject({ state: 'PAUSED' })
    })

    it('marks overdue when ARRIVED exam waited longer than 30min', async () => {
      mockPrisma.device.findMany.mockResolvedValue([mkDevice({ id: 'D1', location: 'MR室2', modality: 'MR' })])
      mockPrisma.exam.findMany.mockResolvedValue([
        mkExam({ id: 'E1', state: 'ARRIVED', modality: 'MR', startedAt: new Date(now.getTime() - 45 * 60000) }),
      ])
      const r = await svc.getRoomStatus()
      expect(r.rooms[0]!.status).toBe('overdue')
      expect(r.rooms[0]!.queueLength).toBe(1)
    })

    it('marks waiting for fresh ARRIVED queue and idle for empty room', async () => {
      mockPrisma.device.findMany.mockResolvedValue([
        mkDevice({ id: 'D1', location: 'CT室1' }),
        mkDevice({ id: 'D2', name: 'MR-01', modality: 'MR', location: 'MR室2' }),
      ])
      mockPrisma.exam.findMany.mockResolvedValue([
        mkExam({ id: 'E1', state: 'ARRIVED', startedAt: new Date(now.getTime() - 5 * 60000) }),
      ])
      const r = await svc.getRoomStatus()
      const byName = new Map(r.rooms.map((room) => [room.name, room]))
      expect(byName.get('CT室1')!.status).toBe('waiting')
      expect(byName.get('MR室2')!.status).toBe('idle')
      expect(byName.get('MR室2')!.currentExam).toBeNull()
    })

    it('falls back to 未分配 room for exams without device and derives room from exam modality', async () => {
      mockPrisma.device.findMany.mockResolvedValue([])
      mockPrisma.exam.findMany.mockResolvedValue([
        mkExam({ id: 'E1', state: 'IN_PROGRESS', device: null }),
      ])
      const r = await svc.getRoomStatus()
      const room = r.rooms.find((x) => x.name === '未分配')
      expect(room).toBeDefined()
      expect(room!.status).toBe('in_use')
      expect(room!.modality).toBe('CT')
    })

    it('sorts rooms: in_use/overdue before waiting/idle', async () => {
      mockPrisma.device.findMany.mockResolvedValue([
        mkDevice({ id: 'D1', location: 'A室' }),
        mkDevice({ id: 'D2', name: 'M2', modality: 'MR', location: 'B室' }),
        mkDevice({ id: 'D3', name: 'D3', modality: 'DR', location: 'C室' }),
      ])
      mockPrisma.exam.findMany.mockResolvedValue([
        mkExam({ id: 'E1', state: 'IN_PROGRESS', startedAt: new Date(now.getTime() - 5 * 60000) }),
        mkExam({ id: 'E2', state: 'ARRIVED', device: { id: 'D2', name: 'MR-01', modality: 'MR', location: 'B室' }, startedAt: new Date(now.getTime() - 60 * 60000) }),
      ])
      const r = await svc.getRoomStatus()
      const statuses = r.rooms.map((room) => room.status)
      expect(statuses[0]).toBe('in_use')
      expect(statuses[1]).toBe('overdue')
      expect(statuses[2]).toBe('idle')
    })

    it('falls back to deterministic seed when DB is empty', async () => {
      mockPrisma.device.findMany.mockResolvedValue([])
      mockPrisma.exam.findMany.mockResolvedValue([])
      const r = await svc.getRoomStatus()
      expect(r.rooms.length).toBeGreaterThan(0)
      expect(r.rooms[0]!.name).toBe('CT室1')
      expect(r.rooms[0]!.status).toBe('in_use')
      expect(r.rooms.some((room) => room.status === 'idle')).toBe(true)
      expect(typeof r.updatedAt).toBe('string')
    })
  })
})
