import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DicomWebService } from '../src/dicom-web/dicom-web.service'
import { PrismaService } from '../src/prisma/prisma.service'
import { STORAGE_DRIVER } from '../src/common/storage/storage.module'

describe('DicomWebService', () => {
  let svc: DicomWebService
  let prisma: any

  const mockInstance = {
    id: 'i1',
    sopInstanceUid: '1.2.3.4.5',
    studyInstanceUid: '1.2.3',
    seriesInstanceUid: '1.2.3.4',
    sopClassUid: '1.2.840.10008.5.1.4.1.1.2',
    modality: 'CT',
    patientId: 'P001',
    patientName: '张三',
    storagePath: '/dicom/storage/1',
    sizeBytes: 1024,
    createdAt: new Date(),
  }

  const mockDicomInstance = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  }

  const mockPrisma: any = {
    dicomInstance: mockDicomInstance,
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DicomWebService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: { get: (key: string, fallback?: string) => fallback ?? 'dicom' } },
        { provide: STORAGE_DRIVER, useValue: { get: async () => Buffer.alloc(0), put: async () => undefined } },
      ],
    }).compile()
    svc = module.get(DicomWebService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  describe('getCapabilities', () => {
    it('returns capability object', () => {
      const r = svc.getCapabilities()
      expect(r.version).toBe('3.0.2.2')
      expect(r.qido.search).toBe(true)
      expect(r.wado.retrieve).toBe(true)
      expect(r.stow.store).toBe(true)
    })
  })

  describe('searchStudies', () => {
    it('queries with filter and pagination', async () => {
      mockDicomInstance.findMany.mockResolvedValue([mockInstance])
      const result = await svc.searchStudies({ PatientID: 'P001', Modality: 'CT', limit: 10, offset: 0 })
      expect(mockDicomInstance.findMany).toHaveBeenCalledWith({
        where: { patientId: 'P001', modality: 'CT' },
        take: 10, skip: 0, orderBy: { createdAt: 'desc' },
      })
      expect(result).toHaveLength(1)
    })

    it('returns empty array when model missing', async () => {
      const svcNoModel = new DicomWebService({} as any, { get: () => undefined } as any)
      const result = await svcNoModel.searchStudies({})
      expect(result).toEqual([])
    })
  })

  describe('searchSeries', () => {
    it('queries by studyInstanceUid', async () => {
      mockDicomInstance.findMany.mockResolvedValue([mockInstance])
      const result = await svc.searchSeries('1.2.3')
      expect(mockDicomInstance.findMany).toHaveBeenCalledWith({
        where: { studyInstanceUid: '1.2.3' },
        orderBy: { createdAt: 'asc' },
      })
      expect(result).toHaveLength(1)
    })
  })

  describe('searchInstances', () => {
    it('queries by study and optional series', async () => {
      mockDicomInstance.findMany.mockResolvedValue([mockInstance])
      const result = await svc.searchInstances('1.2.3', '1.2.3.4')
      expect(mockDicomInstance.findMany).toHaveBeenCalledWith({
        where: { studyInstanceUid: '1.2.3', seriesInstanceUid: '1.2.3.4' },
      })
      expect(result).toHaveLength(1)
    })
  })

  describe('retrieveInstance', () => {
    it('returns DICOM buffer for existing instance', async () => {
      mockDicomInstance.findUnique.mockResolvedValue(mockInstance)
      const result = await svc.retrieveInstance('1.2.3.4.5')
      expect(result.mimeType).toBe('application/dicom')
      expect(result.buffer.length).toBeGreaterThan(128)
      expect(result.buffer.slice(128, 132).toString()).toBe('DICM')
    })

    it('throws NotFoundException when missing', async () => {
      mockDicomInstance.findUnique.mockResolvedValue(null)
      await expect(svc.retrieveInstance('x')).rejects.toThrow(NotFoundException)
    })
  })

  describe('retrieveMetadata', () => {
    it('returns metadata for instance', async () => {
      mockDicomInstance.findUnique.mockResolvedValue(mockInstance)
      const result = await svc.retrieveMetadata('1.2.3.4.5')
      expect(result.sopInstanceUID).toBe('1.2.3.4.5')
      expect(result.size).toBeGreaterThan(0)
    })
  })

  describe('storeInstance', () => {
    it('creates dicom instance record', async () => {
      mockDicomInstance.create.mockResolvedValue(mockInstance)
      const result = await svc.storeInstance('1.2.3', '1.2.3.4', '1.2.3.4.5', 'CT', '1.2.3', 1024, '/path', 'P001')
      expect(result.id).toBe('i1')
    })
  })
})
