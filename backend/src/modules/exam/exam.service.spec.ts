import { ExamService } from './exam.service'
import { NotFoundException } from '@nestjs/common'

const makeSystemConfig = () => ({ getNumber: jest.fn().mockResolvedValue(20) }) as never

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const prisma: Record<string, unknown> = {
    exam: {
      findFirst: jest.fn().mockRejectedValue(new Error('no db')),
      findUnique: jest.fn().mockRejectedValue(new Error('no db')),
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      count: jest.fn().mockRejectedValue(new Error('no db')),
      create: jest.fn().mockRejectedValue(new Error('no db')),
      update: jest.fn().mockRejectedValue(new Error('no db')),
      delete: jest.fn().mockRejectedValue(new Error('no db')),
    },
    patient: {
      findFirst: jest.fn().mockRejectedValue(new Error('no db')),
    },
    ...overrides,
  }
  return prisma as never
}

describe('ExamService', () => {
  describe('list uses admin default_page_size', () => {
    it('falls back to 20 when no config', async () => {
      const findMany = jest.fn().mockResolvedValue([])
      const count = jest.fn().mockResolvedValue(0)
      const systemConfig = { getNumber: jest.fn().mockResolvedValue(20) } as never
      const prisma = makePrisma({ exam: { findMany, count } })
      const service = new ExamService(prisma, systemConfig)
      await service.list({})
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }))
    })
  })

  describe('importMany [W4-A]', () => {
    it('creates rows, skips duplicate accession and lists missing patients', async () => {
      const patientFindFirst = jest.fn()
        .mockResolvedValueOnce({ id: 'P1' })   // row0: 患者存在
        .mockResolvedValueOnce(null)            // row1: 患者不存在 → error
        .mockResolvedValueOnce({ id: 'P1' })    // row2: 患者存在, accession 重复 → skip
      const examFindUnique = jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'EX-dup' })
      const examCreate = jest.fn().mockResolvedValue({ id: 'EX-new' })
      const prisma = makePrisma({
        patient: { findFirst: patientFindFirst },
        exam: { findUnique: examFindUnique, create: examCreate },
      })
      const service = new ExamService(prisma, makeSystemConfig())
      const res = await service.importMany([
        { patientId: 'P1', accessionNumber: 'ACC-001', modality: 'CT', bodyPart: '胸部' },
        { patientId: 'P-MISSING', accessionNumber: 'ACC-002', modality: 'MR', bodyPart: '头部' },
        { patientId: 'P1', accessionNumber: 'ACC-001', modality: 'DR', bodyPart: '四肢' },
      ] as never)
      expect(res.imported).toBe(1)
      expect(res.skipped).toBe(1)
      expect(res.errors).toHaveLength(1)
      expect(res.errors[0]!.message).toContain('患者不存在')
      expect(examCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ accessionNumber: 'ACC-001', state: 'SCHEDULED', tenantId: expect.any(String) }),
      }))
    })

    it('reports validation errors per row', async () => {
      const prisma = makePrisma({})
      const service = new ExamService(prisma, makeSystemConfig())
      const res = await service.importMany([
        { patientId: '', accessionNumber: 'ACC-003', modality: 'CT', bodyPart: '' },
      ] as never)
      expect(res.errors).toHaveLength(1)
      expect(res.errors[0]!.message).toContain('必填')
      expect(res.imported).toBe(0)
    })
  })

  describe('exportCsv [W4-A]', () => {
    it('builds CSV with patient name joined', async () => {
      const findMany = jest.fn().mockResolvedValue([
        { id: 'EX-1', accessionNumber: 'ACC-001', patientId: 'P1', modality: 'CT', bodyPart: '胸部', state: 'SCHEDULED', scheduledAt: null, deviceId: null, createdAt: new Date('2026-01-01'), patient: { name: '张三' } },
      ])
      const prisma = makePrisma({ exam: { findMany } })
      const service = new ExamService(prisma, makeSystemConfig())
      const res = await service.exportCsv({})
      expect(res.count).toBe(1)
      expect(res.content.startsWith('\ufeff')).toBe(true)
      const lines = res.content.replace('\ufeff', '').split('\n')
      expect(lines[0]).toBe('id,accessionNumber,patientId,patientName,modality,bodyPart,state,scheduledAt,deviceId,createdAt')
      expect(lines[1]).toContain('张三')
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
        include: { patient: { select: { name: true } } },
      }))
    })
  })

  describe('get / delete', () => {
    it('get throws 404 when exam missing', async () => {
      const prisma = makePrisma({ exam: { findFirst: jest.fn().mockResolvedValue(null) } })
      const service = new ExamService(prisma, makeSystemConfig())
      await expect(service.get('EX-404')).rejects.toBeInstanceOf(NotFoundException)
    })

    it('delete soft-fails with 404 when missing', async () => {
      const prisma = makePrisma({ exam: { findUnique: jest.fn().mockResolvedValue(null) } })
      const service = new ExamService(prisma, makeSystemConfig())
      await expect(service.delete('EX-404')).rejects.toBeInstanceOf(NotFoundException)
    })
  })
})
