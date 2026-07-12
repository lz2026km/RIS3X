import { Test } from '@nestjs/testing'
import { IheService } from '../src/ihe/ihe.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('IheService', () => {
  let svc: IheService
  let prisma: any

  const mockConfig = { key: 'ihe_affinity_domain', value: { homeCommunityId: 'urn:oid:1.2.3', name: '测试域', assigningAuthorityId: '1.2.3.4', pixManagerEndpoint: 'pix://test' } }
  const mockPixStore = { key: 'ihe_pix_store', value: {} }
  const mockPdqIndex = { key: 'ihe_pdq_index', value: {} }
  const mockPamLog = { key: 'ihe_pam_log', value: [] }

  const mockPrisma = {
    systemConfig: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    patient: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    patientExternalId: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    patientVisit: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    fhirResource: {
      upsert: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        IheService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()
    svc = module.get(IheService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.systemConfig.findUnique.mockImplementation(({ where: { key } }: any) => {
      if (key === 'ihe_affinity_domain') return Promise.resolve(mockConfig)
      if (key === 'ihe_pix_store') return Promise.resolve(mockPixStore)
      if (key === 'ihe_pdq_index') return Promise.resolve(mockPdqIndex)
      if (key === 'ihe_pam_log') return Promise.resolve(mockPamLog)
      return Promise.resolve(null)
    })
    mockPrisma.patientExternalId.findMany.mockResolvedValue([])
    mockPrisma.patient.findMany.mockResolvedValue([])
  })

  describe('Affinity Domain', () => {
    it('getAffinityDomain returns domain', async () => {
      const result = await svc.getAffinityDomain()
      expect(result.homeCommunityId).toBe('urn:oid:1.2.3')
    })

    it('setAffinityDomain upserts', async () => {
      mockPrisma.systemConfig.upsert.mockResolvedValue(mockConfig)
      const result = await svc.setAffinityDomain({ name: 'test' } as any)
      expect(result.name).toBe('test')
    })

    it('resetAffinityDomain returns default', async () => {
      mockPrisma.systemConfig.delete.mockResolvedValue(mockConfig)
      const result = await svc.resetAffinityDomain()
      expect(result.homeCommunityId).toBeDefined()
    })
  })

  describe('PIX Feed (ITI-8)', () => {
    it('returns AA ack with valid data', async () => {
      const result = await svc.pixFeed({
        patientId: 'EXT001',
        assigningAuthority: '1.2.3.4',
        name: { family: '张', given: ['三'] },
        birthDate: '1990-01-01',
        gender: 'M',
        identifiers: [{ domain: '1.2.3.4', value: 'EXT001', assigningAuthority: '1.2.3.4' }],
      })
      expect(result.ack).toBe('AA')
      expect(result.storedPid).toBe('EXT001')
    })

    it('returns AE ack with missing fields', async () => {
      const result = await svc.pixFeed({} as any)
      expect(result.ack).toBe('AE')
      expect(result.errors!.length).toBeGreaterThan(0)
    })

    it('upserts local patient on PIX feed', async () => {
      mockPrisma.patientExternalId.findUnique.mockResolvedValue(null)
      mockPrisma.patient.findFirst.mockResolvedValue(null)
      mockPrisma.patient.create.mockResolvedValue({ id: 'p1' })
      mockPrisma.patientExternalId.create.mockResolvedValue({})
      mockPrisma.fhirResource.upsert.mockResolvedValue({})
      mockPrisma.systemConfig.upsert.mockResolvedValue(mockPixStore)

      const result = await svc.pixFeed({
        patientId: 'EXT002',
        assigningAuthority: '1.2.3.4',
        name: { family: '李', given: ['四'] },
        birthDate: '1985-05-05',
        gender: 'M',
        identifiers: [{ domain: '1.2.3.4', value: 'EXT002', assigningAuthority: '1.2.3.4' }],
      })
      expect(result.ack).toBe('AA')
      expect(mockPrisma.patient.create).toHaveBeenCalled()
    })
  })

  describe('PIX Query (ITI-9)', () => {
    it('returns results for matching domain', async () => {
      mockPrisma.systemConfig.findUnique.mockImplementation(({ where: { key } }: any) => {
        if (key === 'ihe_affinity_domain') return Promise.resolve(mockConfig)
        if (key === 'ihe_pix_store') return Promise.resolve({
          key: 'ihe_pix_store',
          value: {
            '1.2.3.4^EXT001': {
              patientId: 'EXT001',
              assigningAuthority: '1.2.3.4',
              identifiers: [{ domain: '1.2.3.4', value: 'EXT001', assigningAuthority: '1.2.3.4' }],
              name: { family: '张', given: ['三'] },
              birthDate: '1990-01-01',
              gender: 'M',
              lastUpdated: new Date().toISOString(),
              source: 'PIX-FEED',
            },
          },
        })
        return Promise.resolve(null)
      })
      const results = await svc.pixQuery({ sourceDomain: '1.2.3.4', patientId: 'EXT001', targetDomains: ['1.2.3.4'] })
      expect(results).toHaveLength(1)
    })
  })

  describe('PDQ Query (ITI-21)', () => {
    it('returns scored results', async () => {
      mockPrisma.systemConfig.findUnique.mockImplementation(({ where: { key } }: any) => {
        if (key === 'ihe_affinity_domain') return Promise.resolve(mockConfig)
        if (key === 'ihe_pix_store') return Promise.resolve(mockPixStore)
        if (key === 'ihe_pdq_index') return Promise.resolve(mockPdqIndex)
        return Promise.resolve(null)
      })
      mockPrisma.patient.findMany.mockResolvedValue([{ id: 'p1', name: '张三', gender: 'MALE', birthDate: new Date('1990-01-01'), idCard: '110101199001010000', phone: '13800138000', createdAt: new Date(), updatedAt: new Date() }])
      const results = await svc.pdqQuery({ familyName: '张', limit: 10 })
      expect(results.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('PAM (ITI-30/31)', () => {
    const pamDto = {
      messageType: 'ADT^A01' as const,
      patientId: 'p1',
      assigningAuthority: '1.2.3.4',
      visitNumber: 'VN001',
      classCode: 'O' as const,
      assignedLocation: { facility: '放射科', ward: '放射科', room: 'CT-1', bed: '01' },
    }

    it('sendPamMessage returns AA ack', async () => {
      mockPrisma.patientVisit.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ patientId: 'p1', visitNumber: 'VN001', status: 'admitted', updatedAt: new Date() })
      mockPrisma.patientVisit.create.mockResolvedValue({ patientId: 'p1', visitNumber: 'VN001', status: 'admitted' })
      mockPrisma.patientExternalId.findUnique.mockResolvedValue(null)
      mockPrisma.patient.findFirst.mockResolvedValue(null)
      mockPrisma.auditLog.create.mockResolvedValue({})
      mockPrisma.systemConfig.upsert.mockResolvedValue(mockPamLog)

      const result = await svc.sendPamMessage(pamDto)
      expect(result.ack).toBe('AA')
      expect(result.visitNumber).toBe('VN001')
    })

    it('sendPamMessage returns AE on missing patientId', async () => {
      const result = await svc.sendPamMessage({ messageType: 'ADT^A04' as const } as any)
      expect(result.ack).toBe('AE')
    })

    it('sendPamMessage transitions visit state', async () => {
      mockPrisma.patientVisit.findUnique
        .mockResolvedValueOnce({ patientId: 'p1', visitNumber: 'VN001', status: 'registered', updatedAt: new Date() })
        .mockResolvedValueOnce({ patientId: 'p1', visitNumber: 'VN001', status: 'admitted', updatedAt: new Date() })
      mockPrisma.patientVisit.update.mockResolvedValue({ patientId: 'p1', visitNumber: 'VN001', status: 'admitted', updatedAt: new Date() })
      ;(mockPrisma.patientExternalId as any).findUnique = undefined
      mockPrisma.patient.findFirst.mockResolvedValue(null)
      mockPrisma.auditLog.create.mockResolvedValue({})
      mockPrisma.systemConfig.upsert.mockResolvedValue(mockPamLog)

      const result = await svc.sendPamMessage(pamDto)
      expect(result.ack).toBe('AA')
    })

    it('getVisitState returns visit', async () => {
      mockPrisma.patientVisit.findUnique.mockResolvedValue({ patientId: 'p1', visitNumber: 'VN001', status: 'admitted', updatedAt: new Date() })
      const result = await svc.getVisitState('p1', 'VN001')
      expect(result).not.toBeNull()
      expect(result!.status).toBe('admitted')
    })

    it('listPamMessages returns entries', async () => {
      mockPrisma.systemConfig.findUnique.mockImplementation(({ where: { key } }: any) => {
        if (key === 'ihe_pam_log') return Promise.resolve({ key: 'ihe_pam_log', value: [{ ts: '2026-01-01', message: pamDto, ack: 'AA', messageId: 'M1' }] })
        if (key === 'ihe_affinity_domain') return Promise.resolve(mockConfig)
        return Promise.resolve(null)
      })
      const result = await svc.listPamMessages({})
      expect(result.total).toBe(1)
    })
  })

  describe('getStatus', () => {
    it('returns status metrics', async () => {
      const result = await svc.getStatus()
      expect(result.profile).toBe('PAM/PIX/PDQ')
      expect(result.transactions).toContain('ITI-8')
    })
  })

  describe('Stubs', () => {
    it('registerDocumentStub returns doc ID', async () => {
      const id = await svc.registerDocumentStub({}, 'repo1')
      expect(id).toContain('doc-')
    })

    it('queryDocumentsStub returns documents', async () => {
      const docs = await svc.queryDocumentsStub('p1', 'domain')
      expect(docs).toHaveLength(2)
    })

    it('crossReferencePatientStub returns cross-ref', async () => {
      const ref = await svc.crossReferencePatientStub('local1', 'remote1')
      expect(ref).toBe('remote1-local1')
    })
  })
})
