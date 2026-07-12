import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { FhirService } from '../src/fhir/fhir.service'
import { PrismaService } from '../src/prisma/prisma.service'
import { QueueService } from '../src/queue/queue.service'
import { NotificationsGateway } from '../src/notifications/notifications.gateway'

describe('FhirService - $export / Subscription / Resource', () => {
  let svc: FhirService
  let prisma: any

  const mockPrisma = {
    patient: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    report: { findUnique: jest.fn(), findMany: jest.fn() },
    exam: { findUnique: jest.fn(), findMany: jest.fn() },
    fhirResource: { findUnique: jest.fn(), findMany: jest.fn(), upsert: jest.fn(), delete: jest.fn(), update: jest.fn() },
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

  describe('bulkExport ($export)', () => {
    it('initiates system-level export', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([])
      mockPrisma.report.findMany.mockResolvedValue([])
      mockPrisma.exam.findMany.mockResolvedValue([])
      const result = await svc.bulkExport('ndjson', undefined, 'Patient,Observation,ImagingStudy')
      expect(result.jobId).toBeDefined()
      // Wait for async processing
      await new Promise((r) => setTimeout(r, 100))
    })

    it('initiates patient-level export', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([])
      mockPrisma.report.findMany.mockResolvedValue([])
      mockPrisma.exam.findMany.mockResolvedValue([])
      const result = await svc.bulkExport('ndjson')
      expect(result.jobId).toBeDefined()
      await new Promise((r) => setTimeout(r, 100))
    })

    it('exports with _since filter', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([{ id: 'p1', name: '张三', gender: 'MALE', createdAt: new Date(), updatedAt: new Date() }])
      mockPrisma.report.findMany.mockResolvedValue([])
      mockPrisma.exam.findMany.mockResolvedValue([])
      const result = await svc.bulkExport('ndjson', '2026-01-01')
      expect(result.jobId).toBeDefined()
      await new Promise((r) => setTimeout(r, 100))
    })
  })

  describe('bulkExportStatus ($export-status)', () => {
    it('returns status for running job', async () => {
      const { jobId } = await svc.bulkExport()
      const status = await svc.bulkExportStatus(jobId)
      expect(status.status).toBe('running')
    })

    it('throws on missing job', async () => {
      await expect(svc.bulkExportStatus('nonexistent')).rejects.toThrow(NotFoundException)
    })
  })

  describe('searchFhirResource', () => {
    it('searches by resource type', async () => {
      mockPrisma.fhirResource.findMany.mockResolvedValue([{ id: 'r1', resourceType: 'Patient', content: { resourceType: 'Patient' } }])
      const result = await svc.searchFhirResource('Patient', {})
      expect(result.total).toBe(1)
    })

    it('filters by patient', async () => {
      mockPrisma.fhirResource.findMany.mockResolvedValue([])
      await svc.searchFhirResource('Observation', { patient: 'p1' })
      expect(mockPrisma.fhirResource.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { resourceType: 'Observation', patientId: 'p1' } }),
      )
    })
  })

  describe('readDiagnosticReport edge cases', () => {
    it('handles non-PUBLISHED state', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({ id: 'r1', patientId: 'p1', findings: 'x', conclusion: 'y', state: 'WRITING', patient: { id: 'p1' }, createdAt: new Date(), updatedAt: new Date() })
      const result = await svc.readDiagnosticReport('r1')
      expect(result.status).toBe('preliminary')
    })
  })

  describe('patientEverything edge cases', () => {
    it('throws on missing patient', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null)
      await expect(svc.patientEverything('x')).rejects.toThrow(NotFoundException)
    })
  })

  describe('Subscription notification', () => {
    it('sends websocket notification', async () => {
      mockPrisma.fhirResource.update.mockResolvedValue({})
      // Setup a subscription in the map
      const subsMap = (svc as any).subscriptions as Map<string, any>
      subsMap.clear()
      subsMap.set('sub1', { endpoint: '', criteria: 'Patient', channel: { type: 'websocket' } })

      await (svc as any).notifySubscriptions('Patient', { id: 'p1' })
      expect(mockGateway.push).toHaveBeenCalled()
      subsMap.clear()
    })

    it('sends rest-hook notification', async () => {
      mockPrisma.fhirResource.update.mockResolvedValue({})
      global.fetch = jest.fn().mockResolvedValue({ ok: true })
      const subsMap = (svc as any).subscriptions as Map<string, any>
      subsMap.set('sub1', { endpoint: 'http://example.com/hook', criteria: 'Patient', channel: { type: 'rest-hook' } })

      await (svc as any).notifySubscriptions('Patient', { id: 'p1' })
      expect(global.fetch).toHaveBeenCalled()
      subsMap.clear()
    })
  })

  describe('searchSubscription', () => {
    it('returns bundle of subscriptions', async () => {
      mockPrisma.fhirResource.findMany.mockResolvedValue([{ id: 's1', content: { criteria: 'Patient', channel: { type: 'rest-hook', endpoint: 'http://example.com' } } }])
      const result = await svc.searchSubscription()
      expect(result.total).toBe(1)
    })
  })

  describe('readFhirResource error case', () => {
    it('throws on wrong resource type', async () => {
      mockPrisma.fhirResource.findUnique.mockResolvedValue({ id: 'r1', resourceType: 'Patient', content: {} })
      await expect(svc.readFhirResource('Observation', 'r1')).rejects.toThrow(NotFoundException)
    })
  })
})
