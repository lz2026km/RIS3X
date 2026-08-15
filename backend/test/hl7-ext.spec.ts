import { Hl7Service } from '../src/hl7/hl7.service'
import { PrismaService } from '../src/prisma/prisma.service'

// [v3.0.6.11-99 Wave 10E-3] hl7 扩展端点: overview / error-analysis / throughput / message-types
describe('Hl7Service Wave10E-3 (overview/error-analysis/throughput/message-types)', () => {
  let svc: Hl7Service

  const mockPrisma = {
    hl7MessageArchive: {
      create: jest.fn().mockResolvedValue({ id: 'a1' }),
      findMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    patient: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    exam: { findUnique: jest.fn(), create: jest.fn() },
    appointment: { create: jest.fn() },
    $connect: jest.fn(),
  } as any

  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.hl7MessageArchive.findMany.mockReset()
    svc = new Hl7Service(mockPrisma as PrismaService, {
      getString: jest.fn(async (_key: string, fallback: string) => fallback),
      getNumber: jest.fn().mockResolvedValue(30),
      get: jest.fn(),
      invalidate: jest.fn(),
    } as never)
  })

  const msg = (overrides: Record<string, unknown> = {}) => ({
    id: 'm1',
    messageType: 'ORU^R01',
    controlId: 'G005-R1',
    rawMessage: 'MSH|^~\\&|G005|HOSP|HIS|HIS|20260815103000||ORU^R01|G005-R1|P|2.5.1',
    parsed: {},
    direction: 'OUTBOUND',
    ackStatus: 'AA',
    retryCount: 0,
    createdAt: new Date(),
    ...overrides,
  })

  describe('getOverview', () => {
    it('aggregates message volume/success by type from archive', async () => {
      mockPrisma.hl7MessageArchive.findMany.mockResolvedValue([
        msg({ ackStatus: 'AA', direction: 'OUTBOUND' }),
        msg({ id: 'm2', messageType: 'ADT^A01', ackStatus: 'AA', direction: 'INBOUND' }),
        msg({ id: 'm3', messageType: 'ADT^A01', ackStatus: 'AE', direction: 'INBOUND' }),
      ])
      const r = await svc.getOverview()
      expect(r.seeded).toBe(false)
      expect(r.totalMessages).toBe(3)
      expect(r.inboundCount).toBe(2)
      expect(r.outboundCount).toBe(1)
      expect(r.successCount).toBe(2)
      expect(r.failedCount).toBe(1)
      expect(r.successRate).toBe(67)
      expect(r.byType[0]).toMatchObject({ messageType: 'ADT^A01', count: 2 })
      expect(r.ackStatusBreakdown.find((a) => a.ackStatus === 'AA')?.count).toBe(2)
    })

    it('counts today messages by createdAt date', async () => {
      mockPrisma.hl7MessageArchive.findMany.mockResolvedValue([
        msg(),
        msg({ id: 'm2', createdAt: new Date(Date.now() - 86400000 * 2) }),
      ])
      const r = await svc.getOverview()
      expect(r.todayMessages).toBe(1)
    })

    it('falls back to deterministic seed when DB unavailable', async () => {
      mockPrisma.hl7MessageArchive.findMany.mockRejectedValue(new Error('db down'))
      const r = await svc.getOverview()
      expect(r.seeded).toBe(true)
      expect(r.totalMessages).toBeGreaterThan(1000)
      expect(r.byType.some((t) => t.messageType === 'ORU^R01')).toBe(true)
      expect(r.byType.reduce((a, b) => a + b.percent, 0)).toBe(100)
      expect(r.successRate).toBeGreaterThanOrEqual(90)
      const again = await svc.getOverview()
      expect(again).toEqual(r)
    })
  })

  describe('getErrorAnalysis', () => {
    it('groups errors by type/channel/hour with recent samples', async () => {
      const createdAt = new Date()
      createdAt.setHours(9, 30, 0, 0)
      mockPrisma.hl7MessageArchive.findMany.mockResolvedValue([
        msg({ ackStatus: 'AE', direction: 'INBOUND', createdAt }),
        msg({ id: 'm2', ackStatus: 'AE', direction: 'INBOUND', createdAt }),
        msg({ id: 'm3', ackStatus: 'AR', direction: 'OUTBOUND', createdAt }),
      ])
      const r = await svc.getErrorAnalysis()
      expect(r.seeded).toBe(false)
      expect(r.totalErrors).toBe(3)
      expect(r.byErrorType.find((e) => e.errorType === 'AE')?.count).toBe(2)
      expect(r.byErrorType.find((e) => e.errorType === 'AE')?.percent).toBe(67)
      expect(r.byChannel).toHaveLength(2)
      expect(r.byHour.find((h) => h.hour === '09:00')?.count).toBe(3)
      expect(r.recentErrors).toHaveLength(3)
      expect(r.recentErrors[0]).toMatchObject({ ackStatus: 'AE' })
    })

    it('returns deterministic seed profile when DB throws', async () => {
      mockPrisma.hl7MessageArchive.findMany.mockRejectedValue(new Error('db down'))
      const r = await svc.getErrorAnalysis()
      expect(r.seeded).toBe(true)
      expect(r.totalErrors).toBeGreaterThan(40)
      expect(r.byErrorType).toHaveLength(3)
      expect(r.byHour).toHaveLength(24)
      expect(r.byHour[0].hour).toBe('00:00')
      const again = await svc.getErrorAnalysis()
      expect(again).toEqual(r)
    })
  })

  describe('getThroughput', () => {
    it('returns 30 days of seeded throughput points by default', async () => {
      mockPrisma.hl7MessageArchive.findMany.mockResolvedValue([])
      const r = await svc.getThroughput()
      expect(r).toHaveLength(30)
      expect(r.every((p) => p.seeded)).toBe(true)
      expect(r[0].total).toBeGreaterThan(0)
      expect(r[0].success + r[0].failed).toBe(r[0].total)
      expect(r[0].successRate).toBeGreaterThanOrEqual(90)
      const again = await svc.getThroughput()
      expect(again).toEqual(r)
    })

    it('buckets archive rows per day when available', async () => {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0)
      mockPrisma.hl7MessageArchive.findMany.mockResolvedValue([
        msg({ ackStatus: 'AA', createdAt: today }),
        msg({ id: 'm2', ackStatus: 'AA', createdAt: today }),
        msg({ id: 'm3', ackStatus: 'FAILED', createdAt: today }),
      ])
      const r = await svc.getThroughput(7)
      const last = r[r.length - 1]!
      expect(last.seeded).toBe(false)
      expect(last.total).toBe(3)
      expect(last.success).toBe(2)
      expect(last.failed).toBe(1)
      expect(last.successRate).toBe(67)
    })
  })

  describe('getMessageTypes', () => {
    it('computes count/percent/avgBytes per message type', async () => {
      const raw = 'MSH|^~\\&|A|B|C|D|20260815103000||ORU^R01|X|P|2.5.1'.repeat(10)
      mockPrisma.hl7MessageArchive.findMany.mockResolvedValue([
        msg({ messageType: 'ORU^R01', rawMessage: raw, direction: 'INBOUND' }),
        msg({ id: 'm2', messageType: 'ORU^R01', rawMessage: raw, direction: 'INBOUND' }),
        msg({ id: 'm3', messageType: 'ACK', rawMessage: raw, direction: 'OUTBOUND' }),
      ])
      const r = await svc.getMessageTypes()
      expect(r).toHaveLength(2)
      const oru = r.find((t) => t.messageType === 'ORU^R01')!
      expect(oru.count).toBe(2)
      expect(oru.percent).toBe(67)
      expect(oru.avgBytes).toBe(Buffer.byteLength(raw, 'utf8'))
      expect(oru.direction).toBe('INBOUND')
      expect(r.find((t) => t.messageType === 'ACK')!.direction).toBe('OUTBOUND')
    })

    it('falls back to deterministic type distribution', async () => {
      mockPrisma.hl7MessageArchive.findMany.mockRejectedValue(new Error('db down'))
      const r = await svc.getMessageTypes()
      expect(r).toHaveLength(7)
      expect(r.some((t) => t.messageType === 'ORU^R01')).toBe(true)
      expect(r.reduce((a, b) => a + b.percent, 0)).toBe(100)
      const again = await svc.getMessageTypes()
      expect(again).toEqual(r)
    })
  })
})
