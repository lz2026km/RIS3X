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

  describe('patient studies and EMR', () => {
    it('lists studies by patient', async () => {
      mockPrisma.eyeStudy.findMany.mockResolvedValue([mockStudy])
      const r = await svc.listStudiesByPatient('p1')
      expect(r).toHaveLength(1)
      expect(mockPrisma.eyeStudy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { patientId: 'p1' } }),
      )
    })

    it('getEmr returns patient with studies', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({ id: 'p1', name: '张三' })
      mockPrisma.eyeStudy.findMany.mockResolvedValue([mockStudy])
      const r = await svc.getEmr('p1')
      expect(r.patient.id).toBe('p1')
      expect(r.studies).toHaveLength(1)
    })

    it('getEmr throws when patient missing', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null)
      await expect(svc.getEmr('nope')).rejects.toThrow(NotFoundException)
    })

    it('updateEmr marks patient updated and throws when missing', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({ id: 'p1' })
      const r = await svc.updateEmr('p1', { notes: '随访' })
      expect(r.updated).toBe(true)
      mockPrisma.patient.findUnique.mockResolvedValue(null)
      await expect(svc.updateEmr('nope', {})).rejects.toThrow(NotFoundException)
    })
  })

  describe('AI inferences and IOL lenses', () => {
    it('lists distinct AI models', async () => {
      mockPrisma.eyeAiInference.findMany.mockResolvedValue([{ modelId: 'm1' }])
      const r = await svc.listAiModels()
      expect(r).toHaveLength(1)
      expect(mockPrisma.eyeAiInference.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ select: { modelId: true }, distinct: ['modelId'] }),
      )
    })

    it('creates AI inference with tenant', async () => {
      mockPrisma.eyeAiInference.create.mockResolvedValue({ id: 'i1' })
      const r = await svc.createAiInference({ studyId: 'es1', modelId: 'm1', diagnosis: '黄斑水肿', confidence: 0.9, heatmapUrl: 'h' })
      expect(r.id).toBe('i1')
      expect(mockPrisma.eyeAiInference.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tenantId: 'default', modelId: 'm1' }) }),
      )
    })

    it('lists IOL lenses', async () => {
      mockPrisma.eyeIolLens.findMany.mockResolvedValue([{ id: 'l1' }])
      const r = await svc.listIolLenses()
      expect(r).toHaveLength(1)
    })
  })

  describe('updateStudy / deleteStudy missing paths', () => {
    it('updateStudy throws when study missing', async () => {
      mockPrisma.eyeStudy.findUnique.mockResolvedValue(null)
      await expect(svc.updateStudy('x', {})).rejects.toThrow(NotFoundException)
    })

    it('deleteStudy removes study and throws when missing', async () => {
      mockPrisma.eyeStudy.findUnique.mockResolvedValue(mockStudy)
      mockPrisma.eyeStudy.delete.mockResolvedValue(mockStudy)
      const r = await svc.deleteStudy('es1')
      expect(r.id).toBe('es1')
      mockPrisma.eyeStudy.findUnique.mockResolvedValue(null)
      await expect(svc.deleteStudy('x')).rejects.toThrow(NotFoundException)
    })
  })
})
