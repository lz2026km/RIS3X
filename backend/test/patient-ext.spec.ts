import { NotFoundException } from '@nestjs/common'
import { PatientService } from '../src/modules/patient/patient.service'

// [v3.0.6.11-99 Wave 10D] patient 扩展端点: overview / summary / visit-history / age-distribution
describe('PatientService Wave10D (overview/summary/visit-history/age-distribution)', () => {
  let svc: PatientService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      patient: {
        count: jest.fn(),
        groupBy: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      exam: {
        groupBy: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      report: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      appointment: { findMany: jest.fn().mockResolvedValue([]) },
      criticalValue: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    }
    svc = new PatientService(mockPrisma)
  })

  describe('getOverview', () => {
    it('aggregates total/todayNew/active/type/gender', async () => {
      mockPrisma.patient.count.mockResolvedValueOnce(5).mockResolvedValueOnce(2).mockResolvedValueOnce(1)
      mockPrisma.exam.groupBy.mockResolvedValue([{ patientId: 'p1', _count: { _all: 2 } }])
      mockPrisma.patient.groupBy
        .mockResolvedValueOnce([{ type: 'OUTPATIENT', _count: { _all: 5 } }])
        .mockResolvedValueOnce([{ gender: 'MALE', _count: { _all: 3 } }])
      const r = await svc.getOverview()
      expect(r.total).toBe(5)
      expect(r.todayNew).toBe(2)
      expect(r.monthlyNew).toBe(1)
      expect(r.active).toBe(1)
      expect(r.activeRate).toBe(20)
      expect(r.typeDistribution).toEqual({ OUTPATIENT: 5 })
      expect(r.genderDistribution).toEqual({ MALE: 3 })
    })

    it('falls back to seed when DB empty', async () => {
      mockPrisma.patient.count.mockResolvedValue(0)
      mockPrisma.exam.groupBy.mockResolvedValue([])
      mockPrisma.patient.groupBy.mockResolvedValue([])
      const r = await svc.getOverview()
      expect(r.total).toBe(326)
      expect(r.todayNew).toBe(7)
      expect(r.monthlyNew).toBe(58)
      expect(r.activeRate).toBe(12.9)
      expect(r.genderDistribution).toEqual({ MALE: 168, FEMALE: 158 })
    })
  })

  describe('getSummary', () => {
    it('returns counts and recent records', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({ id: 'p1', name: '张三', gender: 'MALE', birthDate: null, phone: '13800000000', type: 'OUTPATIENT', createdAt: new Date() })
      mockPrisma.exam.count.mockResolvedValue(3)
      mockPrisma.report.count.mockResolvedValue(2)
      mockPrisma.criticalValue.count.mockResolvedValue(1)
      mockPrisma.invoice = {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([
          { totalAmount: 1000, paidAmount: 200, status: 'UNPAID' },
          { totalAmount: 800, paidAmount: 800, status: 'PAID' },
        ]),
      }
      mockPrisma.exam.findMany.mockResolvedValue([{ id: 'e1', modality: 'CT', bodyPart: '胸部', state: 'COMPLETED', createdAt: new Date() }])
      mockPrisma.report.findMany.mockResolvedValue([{ id: 'r1', state: 'PUBLISHED', conclusion: '未见异常', createdAt: new Date() }])
      mockPrisma.criticalValue.findMany.mockResolvedValue([{ id: 'c1', description: '气胸', severity: 'HIGH', state: 'FOUND', createdAt: new Date() }])
      const r = await svc.getSummary('p1')
      expect(r.patient.name).toBe('张三')
      expect(r.counts).toMatchObject({ exams: 3, reports: 2, criticalValues: 1, invoices: 2, followUps: 0 })
      expect(r.totalCharges).toBe(800)
      expect(r.recentExams).toHaveLength(1)
      expect(r.criticals[0].description).toBe('气胸')
    })

    it('gracefully handles missing follow-up/invoice models', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({ id: 'p1', name: '李四', gender: 'FEMALE', birthDate: null, phone: null, type: 'INPATIENT', createdAt: new Date() })
      mockPrisma.exam.count.mockResolvedValue(0)
      mockPrisma.report.count.mockResolvedValue(0)
      mockPrisma.criticalValue.count.mockResolvedValue(0)
      const r = await svc.getSummary('p1')
      expect(r.counts).toMatchObject({ exams: 0, reports: 0, followUps: 0, criticalValues: 0, invoices: 0 })
    })

    it('throws NotFoundException for missing patient', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null)
      await expect(svc.getSummary('ghost')).rejects.toThrow(NotFoundException)
    })
  })

  describe('getVisitHistory', () => {
    it('merges appointments + exams into sorted events', async () => {
      const now = Date.now()
      mockPrisma.patient.findFirst.mockResolvedValue({ id: 'p1', name: '张三' })
      mockPrisma.appointment.findMany.mockResolvedValue([
        { id: 'a1', modality: 'CT', bodyPart: '胸部', scheduledAt: new Date(now - 5 * 86400000), state: 'COMPLETED' },
      ])
      mockPrisma.exam.findMany.mockResolvedValue([
        { id: 'e1', modality: 'CT', bodyPart: '胸部', createdAt: new Date(now - 3 * 86400000), state: 'COMPLETED' },
      ])
      const r = await svc.getVisitHistory('p1')
      expect(r.total).toBe(2)
      expect(r.events[0].type).toBe('exam')
      expect(r.events[1].type).toBe('appointment')
      expect(r.events[0].detail).toContain('CT')
    })

    it('falls back to deterministic seed when no history', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({ id: 'p1', name: '张三' })
      mockPrisma.appointment.findMany.mockResolvedValue([])
      mockPrisma.exam.findMany.mockResolvedValue([])
      const r = await svc.getVisitHistory('p1')
      expect(r.total).toBe(5)
      expect(r.events[0].label).toBe('预约登记')
    })
  })

  describe('getAgeDistribution', () => {
    it('buckets patients by age with gender split', async () => {
      const now = Date.now()
      const age = (years: number) => new Date(now - years * 365.25 * 86400000)
      mockPrisma.patient.findMany.mockResolvedValue([
        { birthDate: age(10), gender: 'MALE' },
        { birthDate: age(35), gender: 'FEMALE' },
        { birthDate: age(70), gender: 'MALE' },
        { birthDate: age(50), gender: 'FEMALE' },
      ])
      const r = await svc.getAgeDistribution()
      expect(r.total).toBe(4)
      expect(r.items[0]).toMatchObject({ bucket: '0-17', count: 1, male: 1, female: 0 })
      expect(r.items[2]).toMatchObject({ bucket: '31-45', count: 1, male: 0, female: 1 })
      expect(r.items[3]).toMatchObject({ bucket: '46-60', count: 1, male: 0, female: 1 })
      expect(r.items[4]).toMatchObject({ bucket: '61-75', count: 1, male: 1, female: 0 })
    })

    it('falls back to seed when no patients with birthDate', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([])
      const r = await svc.getAgeDistribution()
      expect(r.total).toBe(326)
      expect(r.items).toHaveLength(6)
      expect(r.items[5]).toMatchObject({ bucket: '76+', count: 25 })
    })
  })
})
