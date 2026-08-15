import { BadRequestException, NotFoundException } from '@nestjs/common'
import { WorklistService } from '../src/modules/worklist/worklist.service'

// [v3.0.6.11-100 Wave 1A] 多技师协作: 主备技师分配 + 交接班
describe('WorklistService multi-technician collaboration (Wave 1A)', () => {
  let svc: WorklistService
  let mockPrisma: any

  const baseExam = {
    id: 'e1', state: 'IN_PROGRESS', patientId: 'p1', tenantId: 't1',
    createdAt: new Date(), scheduledAt: new Date(), startedAt: new Date(),
    patient: { id: 'p1', name: '张三' },
  }

  beforeEach(() => {
    mockPrisma = {
      exam: {
        findUnique: jest.fn().mockResolvedValue({ ...baseExam }),
        findFirst: jest.fn().mockResolvedValue({ ...baseExam, patient: baseExam.patient, device: null, reports: [] }),
        update: jest.fn().mockImplementation(async ({ data }: any) => ({ ...baseExam, ...data, patient: baseExam.patient, device: null })),
        groupBy: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      worklistOp: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'op1' }),
      },
      user: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) =>
          ['t1', 't2', 't3'].includes(where.id) ? { id: where.id, fullName: where.id === 't1' ? '王技师' : '李技师' } : null,
        ),
        findFirst: jest.fn().mockResolvedValue({ id: 'admin1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
    }
    svc = new WorklistService(mockPrisma)
  })

  describe('assignTechnicians', () => {
    it('stores primary/backup via memory fallback when DB lacks new columns', async () => {
      mockPrisma.exam.update
        .mockRejectedValueOnce(new Error('column primary_technician_id does not exist'))
        .mockResolvedValueOnce({ ...baseExam })
      const r = await svc.assignTechnicians('e1', { primaryId: 't1', backupId: 't2' })
      expect((r as any).primaryTechnicianId).toBe('t1')
      expect((r as any).backupTechnicianId).toBe('t2')
      expect(mockPrisma.exam.update).toHaveBeenCalledTimes(2)
    })

    it('records ASSIGN worklistOp with payload', async () => {
      const r = await svc.assignTechnicians('e1', { primaryId: 't1' })
      expect(r.primaryTechnicianId).toBe('t1')
      expect(mockPrisma.worklistOp.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            op: 'ASSIGN',
            examId: 'e1',
            payload: expect.objectContaining({ action: 'ASSIGN_TECHNICIANS', primaryId: 't1' }),
          }),
        }),
      )
    })

    it('rejects when both primaryId and backupId are missing', async () => {
      await expect(svc.assignTechnicians('e1', {})).rejects.toThrow(BadRequestException)
    })

    it('rejects unknown user ids', async () => {
      await expect(svc.assignTechnicians('e1', { primaryId: 'ghost' })).rejects.toThrow(BadRequestException)
    })

    it('throws NotFound for missing exam', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue(null)
      await expect(svc.assignTechnicians('e1', { primaryId: 't1' })).rejects.toThrow(NotFoundException)
    })
  })

  describe('handover', () => {
    it('sets new primary technician and records REASSIGN op with note', async () => {
      const r = await svc.handover('e1', { fromId: 't1', toId: 't2', note: '午休交接' })
      expect(r.ok).toBe(true)
      expect(r.primaryTechnicianId).toBe('t2')
      expect(r.fromId).toBe('t1')
      expect(r.note).toBe('午休交接')
      expect(mockPrisma.exam.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ primaryTechnicianId: 't2' }) }),
      )
      expect(mockPrisma.worklistOp.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            op: 'REASSIGN',
            payload: expect.objectContaining({ action: 'HANDOVER', fromId: 't1', toId: 't2', note: '午休交接' }),
          }),
        }),
      )
    })

    it('falls back to memory when DB lacks new columns', async () => {
      mockPrisma.exam.update
        .mockRejectedValueOnce(new Error('column primary_technician_id does not exist'))
        .mockResolvedValueOnce({ ...baseExam })
      const r = await svc.handover('e1', { fromId: 't1', toId: 't2' })
      expect(r.ok).toBe(true)
      expect(mockPrisma.exam.update).toHaveBeenCalledTimes(2)
    })

    it('rejects unknown from/to user', async () => {
      await expect(svc.handover('e1', { fromId: 'ghost', toId: 't2' })).rejects.toThrow(BadRequestException)
      await expect(svc.handover('e1', { fromId: 't1', toId: 'ghost' })).rejects.toThrow(BadRequestException)
    })

    it('keeps working when worklistOp table is unavailable', async () => {
      mockPrisma.worklistOp.create.mockRejectedValue(new Error('no table'))
      const r = await svc.handover('e1', { fromId: 't1', toId: 't2', note: 'x' })
      expect(r.ok).toBe(true)
      expect(r.primaryTechnicianId).toBe('t2')
    })
  })

  describe('getById technician fields', () => {
    it('returns primaryTechnician/backupTechnician resolved from extras + users', async () => {
      mockPrisma.exam.findFirst.mockResolvedValue({
        ...baseExam, patient: baseExam.patient, device: null, reports: [],
        primaryTechnicianId: 't1', backupTechnicianId: 't2',
      })
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 't1', fullName: '王技师' },
        { id: 't2', fullName: '李技师' },
      ])
      const r = await svc.getById('e1')
      expect(r.primaryTechnician).toEqual({ id: 't1', fullName: '王技师' })
      expect(r.backupTechnician).toEqual({ id: 't2', fullName: '李技师' })
    })

    it('returns nulls when no technicians assigned', async () => {
      const r = await svc.getById('e1')
      expect(r.primaryTechnician).toBeNull()
      expect(r.backupTechnician).toBeNull()
    })

    it('resolves names from memory extras (DB 未迁移) even when findFirst lacks the columns', async () => {
      mockPrisma.exam.update
        .mockRejectedValueOnce(new Error('column primary_technician_id does not exist'))
        .mockResolvedValueOnce({ ...baseExam })
      await svc.assignTechnicians('e1', { primaryId: 't1', backupId: 't2' })
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 't1', fullName: '王技师' },
        { id: 't2', fullName: '李技师' },
      ])
      const r = await svc.getById('e1')
      expect(r.primaryTechnician).toEqual({ id: 't1', fullName: '王技师' })
      expect(r.backupTechnician).toEqual({ id: 't2', fullName: '李技师' })
    })
  })
})
