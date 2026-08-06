import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { FhirService } from '../src/fhir/fhir.service'
import { PrismaService } from '../src/prisma/prisma.service'
import { QueueService } from '../src/queue/queue.service'
import { NotificationsGateway } from '../src/notifications/notifications.gateway'

describe('FhirService', () => {
  let svc: FhirService
  let prisma: any

  const mockPatient = {
    id: 'p1',
    tenantId: 'default',
    name: '张三',
    gender: 'MALE',
    birthDate: new Date('1990-01-01'),
    idCard: '110101199001010000',
    phone: '13800001111',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockReport = {
    id: 'r1',
    patientId: 'p1',
    findings: '正常',
    conclusion: '未见异常',
    state: 'PUBLISHED',
    version: 1,
    tenantId: 't1',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockExam = {
    id: 'e1',
    patientId: 'p1',
    accessionNumber: 'ACC001',
    modality: 'CT',
    state: 'COMPLETED',
    startedAt: new Date(),
    tenantId: 't1',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockPrisma = {
    patient: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    report: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    exam: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    fhirResource: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  }
  const mockQueue = {} as QueueService
  const mockGateway = { push: jest.fn() } as any

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FhirService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: QueueService, useValue: mockQueue },
        { provide: NotificationsGateway, useValue: mockGateway },
      ],
    }).compile()
    svc = module.get(FhirService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  describe('Patient CRUD', () => {
    it('readPatient returns FHIR Patient', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(mockPatient)
      const result = await svc.readPatient('p1')
      expect(result.resourceType).toBe('Patient')
      expect(result.id).toBe('p1')
      expect((result as any).name[0].family).toBe('张三')
    })

    it('readPatient throws when not found', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null)
      await expect(svc.readPatient('x')).rejects.toThrow(NotFoundException)
    })

    it('searchPatient returns Bundle', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([mockPatient])
      const result = await svc.searchPatient({ name: '张三' })
      expect(result.resourceType).toBe('Bundle')
      expect(result.total).toBe(1)
    })

    it('createPatient creates and returns FHIR Patient', async () => {
      mockPrisma.patient.create.mockResolvedValue(mockPatient)
      mockPrisma.fhirResource.upsert.mockResolvedValue({})
      const result = await svc.createPatient({ resourceType: 'Patient', name: [{ family: '张三', given: ['三'] }], gender: 'male' })
      expect(result.resourceType).toBe('Patient')
    })

    it('updatePatient updates and returns', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(mockPatient)
      mockPrisma.patient.update.mockResolvedValue(mockPatient)
      const result = await svc.updatePatient('p1', { name: [{ family: '李四', given: ['四'] }] })
      expect(result.resourceType).toBe('Patient')
    })

    it('deletePatient returns OperationOutcome', async () => {
      mockPrisma.patient.delete.mockResolvedValue(mockPatient)
      const result = await svc.deletePatient('p1')
      expect(result.resourceType).toBe('OperationOutcome')
    })
  })

  describe('Observation', () => {
    it('readObservation returns FHIR Observation', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(mockReport)
      const result = await svc.readObservation('r1')
      expect(result.resourceType).toBe('Observation')
      expect(result.valueString).toBe('正常')
    })

    it('searchObservation returns Bundle', async () => {
      mockPrisma.report.findMany.mockResolvedValue([mockReport])
      const result = await svc.searchObservation({ patient: 'p1' })
      expect(result.total).toBe(1)
    })
  })

  describe('DiagnosticReport', () => {
    it('readDiagnosticReport returns FHIR DiagnosticReport', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({ ...mockReport, patient: mockPatient })
      const result = await svc.readDiagnosticReport('r1')
      expect(result.resourceType).toBe('DiagnosticReport')
      expect(result.status).toBe('final')
    })

    it('searchDiagnosticReport returns Bundle', async () => {
      mockPrisma.report.findMany.mockResolvedValue([{ ...mockReport, patient: mockPatient }])
      const result = await svc.searchDiagnosticReport({ patient: 'p1' })
      expect(result.total).toBe(1)
    })
  })

  describe('ImagingStudy', () => {
    it('readImagingStudy returns FHIR ImagingStudy', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue(mockExam)
      const result = await svc.readImagingStudy('e1')
      expect(result.resourceType).toBe('ImagingStudy')
      expect((result as any).series[0].modality.coding[0].code).toBe('CT')
    })

    it('searchImagingStudy returns Bundle', async () => {
      mockPrisma.exam.findMany.mockResolvedValue([mockExam])
      const result = await svc.searchImagingStudy({ patient: 'p1' })
      expect(result.total).toBe(1)
    })
  })

  describe('patientEverything', () => {
    it('returns Bundle with patient, reports, exams', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(mockPatient)
      mockPrisma.report.findMany.mockResolvedValue([mockReport])
      mockPrisma.exam.findMany.mockResolvedValue([mockExam])
      const result = await svc.patientEverything('p1')
      expect(result.total).toBe(3)
    })
  })

  describe('Subscription', () => {
    it('createSubscription upserts and reloads', async () => {
      mockPrisma.fhirResource.upsert.mockResolvedValue({})
      mockPrisma.fhirResource.findMany.mockResolvedValue([])
      const result = await svc.createSubscription({ resourceType: 'Subscription', status: 'active', criteria: 'Patient', channel: { type: 'rest-hook', endpoint: 'http://example.com/hook' }, reason: 'test' })
      expect(result.resourceType).toBe('Subscription')
    })

    it('deleteSubscription removes', async () => {
      mockPrisma.fhirResource.delete.mockResolvedValue({})
      const result = await svc.deleteSubscription('s1')
      expect(result.resourceType).toBe('OperationOutcome')
    })

    it('getSubscription returns content', async () => {
      mockPrisma.fhirResource.findUnique.mockResolvedValue({ id: 's1', content: { criteria: 'Patient' } })
      const result = await svc.getSubscription('s1')
      expect((result as any).criteria).toBe('Patient')
    })
  })

  describe('Subscription SSRF protection', () => {
    const subscription = (endpoint: string) => ({
      resourceType: 'Subscription' as const,
      status: 'active' as const,
      criteria: 'Patient',
      channel: { type: 'rest-hook' as const, endpoint },
      reason: 'test',
    })

    const expectBlocked = async (endpoint: string) => {
      await expect(svc.createSubscription(subscription(endpoint))).rejects.toMatchObject({
        response: expect.objectContaining({
          resourceType: 'OperationOutcome',
          issue: expect.arrayContaining([
            expect.objectContaining({ details: expect.objectContaining({ text: 'SUBSCRIPTION_ENDPOINT_BLOCKED' }) }),
          ]),
        }),
      })
    }

    it('accepts public https endpoint', async () => {
      mockPrisma.fhirResource.upsert.mockResolvedValue({})
      mockPrisma.fhirResource.findMany.mockResolvedValue([])
      const result = await svc.createSubscription(subscription('https://hooks.example.com/fhir'))
      expect(result.resourceType).toBe('Subscription')
    })

    it('rejects http://localhost endpoint', () => expectBlocked('http://localhost:8080/hook'))

    it('rejects loopback 127.0.0.1 endpoint', () => expectBlocked('http://127.0.0.1:3000/hook'))

    it('rejects private 10.x endpoint', () => expectBlocked('https://10.0.0.8/internal'))

    it('rejects private 172.16-31.x endpoints', () => {
      expectBlocked('https://172.16.5.1/hook')
      expectBlocked('https://172.31.255.255/hook')
    })

    it('rejects private 192.168.x endpoint', () => expectBlocked('http://192.168.1.100/hook'))

    it('rejects link-local 169.254.x and 0.0.0.0 endpoints', () => {
      expectBlocked('http://169.254.169.254/latest/meta-data')
      expectBlocked('http://0.0.0.0/hook')
    })

    it('rejects non-http protocol endpoints', () => expectBlocked('file:///etc/passwd'))
  })

  describe('readFhirResource', () => {
    it('returns resource content', async () => {
      mockPrisma.fhirResource.findUnique.mockResolvedValue({ id: 'r1', resourceType: 'Patient', content: { resourceType: 'Patient', id: 'r1' } })
      const result = await svc.readFhirResource('Patient', 'r1')
      expect((result as any).resourceType).toBe('Patient')
    })
  })
})
