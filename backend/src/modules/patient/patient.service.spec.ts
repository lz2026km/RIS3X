import { PatientService } from './patient.service'
import { BadRequestException, NotFoundException } from '@nestjs/common'

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const prisma: Record<string, unknown> = {
    patient: {
      findFirst: jest.fn().mockRejectedValue(new Error('no db')),
      findUnique: jest.fn().mockRejectedValue(new Error('no db')),
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      count: jest.fn().mockRejectedValue(new Error('no db')),
      create: jest.fn().mockRejectedValue(new Error('no db')),
      update: jest.fn().mockRejectedValue(new Error('no db')),
      delete: jest.fn().mockRejectedValue(new Error('no db')),
    },
    report: { findMany: jest.fn().mockRejectedValue(new Error('no db')) },
    exam: { findMany: jest.fn().mockRejectedValue(new Error('no db')) },
    ...overrides,
  }
  return prisma as never
}

describe('PatientService', () => {
  describe('delete (soft delete)', () => {
    it('succeeds for a patient with children data (soft delete, no P2003)', async () => {
      const update = jest.fn().mockResolvedValue({ id: 'P1', deletedAt: new Date() })
      const hardDelete = jest.fn()
      const prisma = makePrisma({
        patient: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'P1',
            name: '张明远',
            reports: [],
            exams: [{ id: 'EX-1' }],
          }),
          update,
          delete: hardDelete,
        },
      })
      const service = new PatientService(prisma)
      const res = await service.delete('P1')
      expect(res).toEqual({ ok: true })
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'P1' },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }))
      expect(hardDelete).not.toHaveBeenCalled()
    })

    it('throws 404 when patient is already soft-deleted or missing', async () => {
      const prisma = makePrisma({
        patient: { findFirst: jest.fn().mockResolvedValue(null) },
      })
      const service = new PatientService(prisma)
      await expect(service.delete('gone')).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('list / get exclude soft-deleted', () => {
    it('list filters deletedAt null', async () => {
      const findMany = jest.fn().mockResolvedValue([{ id: 'P1', name: '张明远' }])
      const count = jest.fn().mockResolvedValue(1)
      const prisma = makePrisma({
        patient: { findMany, count },
      })
      const service = new PatientService(prisma)
      const res = await service.list({})
      expect(res.total).toBe(1)
      expect(res.items).toHaveLength(1)
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }))
      expect(count).toHaveBeenCalledWith({ where: expect.objectContaining({ deletedAt: null }) })
    })

    it('get throws 404 after soft delete', async () => {
      const prisma = makePrisma({
        patient: { findFirst: jest.fn().mockResolvedValue(null) },
      })
      const service = new PatientService(prisma)
      await expect(service.get('P1')).rejects.toBeInstanceOf(NotFoundException)
    })

    it('get returns non-deleted patient', async () => {
      const findFirst = jest.fn().mockResolvedValue({ id: 'P1', name: '张明远' })
      const prisma = makePrisma({
        patient: { findFirst },
      })
      const service = new PatientService(prisma)
      const p = await service.get('P1')
      expect(p.id).toBe('P1')
      expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: 'P1', deletedAt: null }),
      }))
    })
  })

  describe('merge [W2-4]', () => {
    const tx = {
      exam: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      report: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
      appointment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      criticalValue: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      patient: { update: jest.fn().mockResolvedValue({ id: 'P1', deletedAt: new Date() }) },
    }

    const makeMergePrisma = (patientFind: jest.Mock) => {
      const patient = { findFirst: patientFind, update: jest.fn() }
      const prisma: Record<string, unknown> = {
        patient,
        $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)),
        ...{ exam: {}, report: {}, appointment: {}, criticalValue: {} },
      }
      return prisma as never
    }

    it('moves related records to target and soft-deletes source', async () => {
      const findFirst = jest.fn()
        .mockResolvedValueOnce({ id: 'P1', name: '源患者' })
        .mockResolvedValueOnce({ id: 'P2', name: '目标患者' })
      const service = new PatientService(makeMergePrisma(findFirst))
      const res = await service.merge('P1', 'P2')
      expect(res.ok).toBe(true)
      expect(res.merged).toEqual({
        sourceId: 'P1', targetId: 'P2',
        movedExams: 2, movedReports: 3, movedAppointments: 1, movedCriticalValues: 1,
      })
      expect(tx.exam.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ patientId: 'P1' }),
        data: { patientId: 'P2' },
      }))
      expect(tx.report.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ patientId: 'P1' }),
        data: { patientId: 'P2' },
      }))
      expect(tx.appointment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ patientId: 'P1' }),
        data: { patientId: 'P2' },
      }))
      expect(tx.criticalValue.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ patientId: 'P1' }),
        data: { patientId: 'P2' },
      }))
      expect(tx.patient.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'P1' },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }))
    })

    it('throws 404 when source or target missing', async () => {
      const findFirst = jest.fn().mockResolvedValue(null)
      const service = new PatientService(makeMergePrisma(findFirst))
      await expect(service.merge('P1', 'P2')).rejects.toBeInstanceOf(NotFoundException)
    })

    it('throws 400 when merging a patient with itself', async () => {
      const service = new PatientService(makeMergePrisma(jest.fn()))
      await expect(service.merge('P1', 'P1')).rejects.toBeInstanceOf(BadRequestException)
    })
  })
})
