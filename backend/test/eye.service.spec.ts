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
    it('returns normalized studies', async () => {
      mockPrisma.eyeStudy.findMany.mockResolvedValue([mockStudy])
      const result = await svc.listStudies()
      // [G005 W3-A] 归一化: { success, data: DTO[] }
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toMatchObject({ id: 'es1', patientId: 'p1', modality: 'OCT' })
    })
  })

  describe('getStudy', () => {
    it('returns study when found', async () => {
      mockPrisma.eyeStudy.findMany.mockResolvedValue([mockStudy])
      const result = await svc.getStudy('es1')
      expect(result.success).toBe(true)
      expect(result.data.id).toBe('es1')
    })

    it('throws on missing', async () => {
      mockPrisma.eyeStudy.findMany.mockResolvedValue([])
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
    it('listReports returns report-shaped data', async () => {
      // [G005 W3-A] /eye/reports 归一化为报告形状 (seed 报告库)
      const result = await svc.listReports()
      expect(result.success).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
      expect(result.data[0]).toHaveProperty('reportType')
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

  // ── [G005-P1] 在用孤儿补齐: PACS/AI/EMR/Report (seed 回退) ──

  describe('listPacsStudies', () => {
    it('returns seed data when DB is empty', async () => {
      mockPrisma.eyeStudy.findMany.mockResolvedValue([])
      const r = await svc.listPacsStudies({})
      expect(r.success).toBe(true)
      expect(r.data.length).toBeGreaterThan(0)
      expect(r.data[0]).toHaveProperty('patientName')
    })

    it('filters by modality', async () => {
      mockPrisma.eyeStudy.findMany.mockResolvedValue([])
      const r = await svc.listPacsStudies({ modality: 'OCT' })
      expect(r.data.length).toBeGreaterThan(0)
      expect(r.data.every((s: any) => s.modality.toLowerCase().includes('oct'))).toBe(true)
    })

    it('maps prisma rows to frontend shape', async () => {
      mockPrisma.eyeStudy.findMany.mockResolvedValue([{ id: 'es1', patientId: 'p1', patient: { name: '张三' }, modality: 'OCT', bodyPart: '右眼', studyDate: new Date('2026-07-01'), status: 'COMPLETED', createdAt: new Date('2026-07-01') }])
      const r = await svc.listPacsStudies({})
      expect(r.data[0]).toMatchObject({ id: 'es1', patientName: '张三', modality: 'OCT' })
    })
  })

  describe('AI inferences', () => {
    it('listAiInferences falls back to seed', async () => {
      mockPrisma.eyeAiInference.findMany.mockResolvedValue([])
      const r = await svc.listAiInferences({})
      expect(r.success).toBe(true)
      expect(r.data.length).toBeGreaterThan(0)
      expect(r.data[0]).toHaveProperty('modelName')
    })

    it('getAiInference returns seeded inference by id', async () => {
      mockPrisma.eyeAiInference.findMany.mockResolvedValue([])
      const r = await svc.getAiInference('INF-3001')
      expect(r.data?.id).toBe('INF-3001')
    })
  })

  describe('IOL inventory', () => {
    it('lists inventory items', async () => {
      const r = await svc.listIolInventory({})
      expect(r.success).toBe(true)
      expect(r.data.length).toBeGreaterThan(0)
      expect(r.data[0]).toHaveProperty('barcode')
    })

    it('low-stock returns items below threshold', async () => {
      const r = await svc.listIolLowStock(5)
      expect(r.success).toBe(true)
      expect(r.data.every((i: any) => i.quantity < 5)).toBe(true)
    })

    it('in-stock + out-stock flow updates status', async () => {
      const created = await svc.createIolInventoryItem({ barcode: 'T-1', model: 'SA60AT', type: 'monofocal', power: 20, batchNumber: 'B1', expiryDate: '2028-01-01', stockLocation: 'A-1', supplier: 'Alcon', unitPrice: 100 })
      expect(created.data.status).toBe('in_stock')
      const out = await svc.iolOutStock(created.data.id, { reason: 'implant' })
      expect(out.data?.status).toBe('implanted')
    })
  })

  describe('Contact lens library', () => {
    it('lists lenses and filters by type', async () => {
      const r = await svc.listContactLensInventory({ type: 'RGP' })
      expect(r.success).toBe(true)
      expect(r.data.every((l: any) => l.type === 'RGP')).toBe(true)
    })

    it('create/update/delete flow', async () => {
      const created = await svc.createContactLens({ brand: 'Alcon', type: 'Soft', series: 'Dailies', bc: 8.6, dia: 14.2, power: -2.0, stock: 5, unitPrice: 100, supplier: 'Alcon' })
      expect(created.data.id).toBeTruthy()
      const updated = await svc.updateContactLens(created.data.id, { stock: 9 })
      expect(updated.data?.stock).toBe(9)
      const deleted = await svc.deleteContactLens(created.data.id)
      expect(deleted.data.deleted).toBe(true)
    })

    it('okLensDesign computes base curve', async () => {
      const r = await svc.okLensDesign({ patientId: 'p1', k1: 43, k2: 44, kAxis: 90, targetReduction: 3.0 })
      expect(r.success).toBe(true)
      expect(r.data.baseCurve).toBeLessThan(43.5)
      expect(r.data.designId).toBeTruthy()
    })
  })
})
