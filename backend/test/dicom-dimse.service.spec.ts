import { Test } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DicomDimseService } from '../src/dicom-dimse/dicom-dimse.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('DicomDimseService', () => {
  let svc: DicomDimseService
  let prisma: any

  const mockPrisma = {
    exam: {
      findMany: jest.fn(),
    },
    dicomInstance: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
  }

  const mockConfig = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const map: Record<string, any> = {
        'DICOM_STORAGE_DIR': 'E:\\temp\\dicom_test',
        'DIMSE_DEFAULT_HOST': '127.0.0.1',
        'DIMSE_DEFAULT_PORT': 11112,
      }
      return map[key] ?? defaultValue
    }),
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DicomDimseService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile()
    svc = module.get(DicomDimseService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  describe('cEcho', () => {
    it('returns success with default params', async () => {
      const result = await svc.cEcho()
      expect(result.statusCode).toBe(0x0000)
      expect(result.message).toContain('Success')
    })

    it('accepts custom params', async () => {
      const result = await svc.cEcho({ affectedSopClassUid: '1.2.3', calledAeTitle: 'AE1', callingAeTitle: 'AE2' })
      expect(result.affectedSopClassUid).toBe('1.2.3')
      expect(result.calledAeTitle).toBe('AE1')
      expect(result.callingAeTitle).toBe('AE2')
    })
  })

  describe('cStore', () => {
    const validDto = {
      sopClassUid: '1.2.840.10008.5.1.4.1.1.2',
      sopInstanceUid: '1.2.840.10008.1.1',
      studyInstanceUid: '1.2.840.10008.1.2',
      seriesInstanceUid: '1.2.840.10008.1.3',
      modality: 'CT',
    }

    it('stores with valid SOP class', async () => {
      const result = await svc.cStore(validDto)
      expect(result.sopInstanceUid).toBe('1.2.840.10008.1.1')
    })

    it('throws on unsupported SOP class', async () => {
      await expect(svc.cStore({ ...validDto, sopClassUid: '1.1.1' })).rejects.toThrow(BadRequestException)
    })

    it('throws on invalid UID characters', async () => {
      await expect(svc.cStore({ ...validDto, studyInstanceUid: '../outside' })).rejects.toThrow(BadRequestException)
    })
  })

  describe('cFindMwl', () => {
    it('returns matches with query params', async () => {
      const mockExam = {
        id: 'e1',
        patientId: 'p1',
        accessionNumber: 'ACC001',
        modality: 'CT',
        bodyPart: '头部',
        scheduledAt: new Date(),
        patient: { id: 'p1', name: '张三' },
        device: { id: 'd1', name: 'CT-1', aeTitle: 'AET1' },
      }
      mockPrisma.exam.findMany.mockResolvedValue([mockExam])
      const result = await svc.cFindMwl({ queryRetrieveLevel: 'STUDY', modality: 'CT', patientName: '张三' })
      expect(result.matches).toBe(1)
      expect(result.items[0].accessionNumber).toBe('ACC001')
    })

    it('returns empty when no matches', async () => {
      mockPrisma.exam.findMany.mockResolvedValue([])
      const result = await svc.cFindMwl({ queryRetrieveLevel: 'STUDY', modality: 'MR' })
      expect(result.matches).toBe(0)
      expect(result.items).toHaveLength(0)
    })

    it('filters by scheduled date', async () => {
      mockPrisma.exam.findMany.mockResolvedValue([])
      await svc.cFindMwl({ queryRetrieveLevel: 'STUDY', scheduledDate: '2026-07-13' })
      expect(mockPrisma.exam.findMany).toHaveBeenCalled()
    })
  })

  describe('cMove', () => {
    it('returns move response', async () => {
      const result = await svc.cMove({ studyInstanceUid: '1.2.3', destinationAe: 'DEST_AE' })
      expect(result.statusCode).toBe(0x0000)
    })
  })
})
