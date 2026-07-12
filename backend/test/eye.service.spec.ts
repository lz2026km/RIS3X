import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { EyeService } from '../src/eye/eye.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('EyeService', () => {
  let svc: EyeService
  let prisma: any

  const mockPrisma = {
    eyeStudy: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    patient: {
      findUnique: jest.fn(),
    },
    eyeAiInference: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    eyeIolLens: {
      findMany: jest.fn(),
    },
  }

  const mockStudy = { id: 'es1', patientId: 'p1', modality: 'OCT', bodyPart: '左眼', status: 'PENDING', findings: '', impressions: '', createdAt: new Date(), updatedAt: new Date() }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [EyeService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile()
    svc = module.get(EyeService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  describe('listStudies', () => {
    it('returns studies', async () => {
      mockPrisma.eyeStudy.findMany.mockResolvedValue([mockStudy])
      const result = await svc.listStudies()
      expect(result).toHaveLength(1)
    })
  })

  describe('getStudy', () => {
    it('returns study when found', async () => {
      mockPrisma.eyeStudy.findUnique.mockResolvedValue(mockStudy)
      const result = await svc.getStudy('es1')
      expect(result.id).toBe('es1')
    })

    it('throws on missing', async () => {
      mockPrisma.eyeStudy.findUnique.mockResolvedValue(null)
      await expect(svc.getStudy('x')).rejects.toThrow(NotFoundException)
    })
  })

  describe('createStudy', () => {
    it('creates study', async () => {
      mockPrisma.eyeStudy.create.mockResolvedValue(mockStudy)
      const result = await svc.createStudy({ patientId: 'p1', modality: 'OCT', bodyPart: '左眼' })
      expect(result.id).toBe('es1')
    })
  })

  describe('IOL Calculations', () => {
    it('calculateBarrett returns result', () => {
      const result = svc.calculateBarrett({ lensId: 'l1', axialLength: 24.5, keratometry: 43.2 })
      expect(result.formula).toBe('Barrett')
      expect(result.result).toBeDefined()
    })

    it('calculateKane returns result', () => {
      const result = svc.calculateKane({ lensId: 'l1', axialLength: 24.5, keratometry: 43.2 })
      expect(result.formula).toBe('Kane')
    })

    it('calculateHillRbf returns result', () => {
      const result = svc.calculateHillRbf({ lensId: 'l1', axialLength: 24.5, keratometry: 43.2 })
      expect(result.formula).toBe('Hill-RBF')
    })

    it('calculateSrkT returns result', () => {
      const result = svc.calculateSrkT({ lensId: 'l1', axialLength: 24.5, keratometry: 43.2 })
      expect(result.formula).toBe('SRK/T')
    })
  })

  describe('listReports / generateReport', () => {
    it('listReports returns completed studies', async () => {
      mockPrisma.eyeStudy.findMany.mockResolvedValue([mockStudy])
      const result = await svc.listReports()
      expect(result).toHaveLength(1)
    })

    it('generateReport returns message', () => {
      const result = svc.generateReport({ studyId: 'es1' })
      expect(result.message).toBe('Report generated')
    })
  })
})
