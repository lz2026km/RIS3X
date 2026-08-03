import { NotFoundException } from '@nestjs/common'
import { AiDiagnosisService } from '../src/modules/ai-diagnosis/ai-diagnosis.service'

describe('AiDiagnosisService', () => {
  let svc: AiDiagnosisService

  beforeAll(() => {
    svc = new AiDiagnosisService()
  })

  describe('lung CAD', () => {
    it('listLungCad returns seeded results', async () => {
      const { data } = await svc.listLungCad()
      expect(data.length).toBeGreaterThanOrEqual(4)
      expect(data[0].nodules.length).toBe(data[0].noduleCount)
    })

    it('getLungCad returns a result by id', async () => {
      const { data } = await svc.getLungCad('LUNG-001')
      expect(data.patientName).toBe('张伟')
    })

    it('getLungCad throws for unknown id', async () => {
      await expect(svc.getLungCad('LUNG-XXX')).rejects.toThrow(NotFoundException)
    })

    it('analyzeLungCad returns existing result for known study', async () => {
      const { data } = await svc.analyzeLungCad('LS20260718-001')
      expect(data.id).toBe('LUNG-001')
    })

    it('analyzeLungCad creates a deterministic new result', async () => {
      const first = await svc.analyzeLungCad('NEW-STUDY-LUNG-42')
      const second = await svc.analyzeLungCad('NEW-STUDY-LUNG-42')
      expect(first.data.id).toBeDefined()
      expect(second.data.id).toBe(first.data.id)
      expect(first.data.noduleCount).toBeGreaterThan(0)
      expect(first.data.overallRisk).toMatch(/^(low|moderate|high)$/)
    })

    it('reviewLungCad confirms status and amends characteristics', async () => {
      const { data } = await svc.reviewLungCad('LUNG-002', { noduleId: 'LUNG-002-N1', status: 'confirmed', amendedDiagnosis: '良性钙化' })
      expect(data.status).toBe('confirmed')
      expect(data.nodules[0].characteristics).toEqual(['良性钙化'])
    })

    it('reviewLungCad marks non-confirmed as reviewed', async () => {
      const { data } = await svc.reviewLungCad('LUNG-002', { noduleId: 'LUNG-002-N1', status: 'rejected' })
      expect(data.status).toBe('reviewed')
    })

    it('reviewLungCad throws for unknown id', async () => {
      await expect(svc.reviewLungCad('LUNG-XXX', { noduleId: 'n', status: 'confirmed' })).rejects.toThrow(NotFoundException)
    })

    it('lungCadStats aggregates risk and size distribution', async () => {
      const { data } = await svc.lungCadStats()
      expect(data.totalStudies).toBeGreaterThan(0)
      expect(Array.isArray(data.riskDistribution)).toBe(true)
      expect(Array.isArray(data.sizeDistribution)).toBe(true)
    })
  })

  describe('breast CAD', () => {
    it('listBreastCad returns results', async () => {
      const { data } = await svc.listBreastCad()
      expect(data.length).toBeGreaterThanOrEqual(4)
    })

    it('getBreastCad throws for unknown id', async () => {
      await expect(svc.getBreastCad('BREAST-XXX')).rejects.toThrow(NotFoundException)
    })

    it('analyzeBreastCad returns existing or creates new result', async () => {
      const existing = await svc.analyzeBreastCad('BS20260715-002')
      expect(existing.data.id).toBe('BREAST-001')
      const created = await svc.analyzeBreastCad('NEW-STUDY-BREAST-7')
      expect(created.data.lesionCount).toBe(1)
      expect(created.data.overallBiRads).toMatch(/^[2345][abc]?$|^[0-9]$/)
    })

    it('reviewBreastCad updates biRads', async () => {
      const { data } = await svc.reviewBreastCad('BREAST-002', { lesionId: 'BREAST-002-L1', status: 'confirmed', amendedBiRads: '4a' })
      expect(data.overallBiRads).toBe('4a')
      expect(data.status).toBe('confirmed')
    })

    it('breastCadStats aggregates biRads and type distribution', async () => {
      const { data } = await svc.breastCadStats()
      expect(data.totalLesions).toBeGreaterThan(0)
      expect(Array.isArray(data.biRadsDistribution)).toBe(true)
    })
  })

  describe('fracture CAD', () => {
    it('listFractureCad returns results', async () => {
      const { data } = await svc.listFractureCad()
      expect(data.length).toBeGreaterThanOrEqual(4)
    })

    it('analyzeFractureCad creates deterministic result', async () => {
      const a = await svc.analyzeFractureCad('NEW-STUDY-FX-3')
      const b = await svc.analyzeFractureCad('NEW-STUDY-FX-3')
      expect(a.data.id).toBe(b.data.id)
      expect(a.data.fractureCount).toBe(1)
    })

    it('reviewFractureCad amends recommendation', async () => {
      const { data } = await svc.reviewFractureCad('FRACTURE-003', { findingId: 'FRACTURE-003-F1', status: 'amended', amendedDiagnosis: '未见明确骨折' })
      expect(data.status).toBe('reviewed')
      expect(data.recommendation).toBe('未见明确骨折')
    })

    it('fractureCadStats aggregates bone and type distribution', async () => {
      const { data } = await svc.fractureCadStats()
      expect(data.totalFractures).toBeGreaterThan(0)
      expect(Array.isArray(data.boneDistribution)).toBe(true)
    })
  })

  describe('cardiac AI', () => {
    it('listCardiacAi returns results', async () => {
      const { data } = await svc.listCardiacAi()
      expect(data.length).toBeGreaterThanOrEqual(4)
    })

    it('analyzeCardiacAi returns existing or creates new result', async () => {
      const existing = await svc.analyzeCardiacAi('CS20260713-001')
      expect(existing.data.id).toBe('CARDIAC-001')
      const created = await svc.analyzeCardiacAi('NEW-STUDY-CARD-9')
      expect(created.data.measurements.length).toBeGreaterThan(0)
    })

    it('reviewCardiacAi amends assessment', async () => {
      const { data } = await svc.reviewCardiacAi('CARDIAC-002', { status: 'confirmed', amendedAssessment: '正常范围' })
      expect(data.overallAssessment).toBe('正常范围')
      expect(data.status).toBe('confirmed')
    })

    it('cardiacAiStats aggregates cadRads and stenosis distribution', async () => {
      const { data } = await svc.cardiacAiStats()
      expect(data.avgEjectionFraction).toBeGreaterThan(0)
      expect(Array.isArray(data.cadRadsDistribution)).toBe(true)
    })
  })

  describe('combined stats / accuracy / trend', () => {
    it('stats() combines all model stats', async () => {
      const { data } = await svc.stats()
      const d = data as any
      expect(d.lungCad.total).toBeGreaterThan(0)
      expect(d.breastCad.total).toBeGreaterThan(0)
      expect(d.fractureCad.total).toBeGreaterThan(0)
      expect(d.cardiacAi.total).toBeGreaterThan(0)
      expect(d.accuracy.overall).toBeGreaterThan(80)
    })

    it('accuracy returns numeric fields with coherent totals', async () => {
      const r = await svc.accuracy({ startDate: '2026-07-01', endDate: '2026-07-31' })
      expect(r.totalCases).toBeGreaterThan(0)
      expect(r.aiPositive + r.aiNegative).toBe(r.totalCases)
      expect(r.physicianPositive + r.physicianNegative).toBe(r.totalCases)
      expect(r.sensitivity).toBeGreaterThan(0)
      expect(r.accuracy).toBeGreaterThan(0)
    })

    it('trend returns one point per day', async () => {
      const r = await svc.trend({ startDate: '2026-07-01', endDate: '2026-07-11' })
      expect(r).toHaveLength(10)
      expect(r[0].date).toBe('2026-07-01')
      expect(r[0].totalCases).toBeGreaterThan(0)
    })

    it('trend caps at 90 days and handles inverted range', async () => {
      const r = await svc.trend({ startDate: '2026-01-01', endDate: '2027-01-01' })
      expect(r.length).toBeLessThanOrEqual(90)
      const inverted = await svc.trend({ startDate: '2026-07-10', endDate: '2026-07-01' })
      expect(inverted.length).toBe(1)
    })
  })
})
