import { WorklistSmartService, SmartScoreInput } from '../src/modules/worklist-smart/worklist-smart.service'

describe('WorklistSmartService', () => {
  let svc: WorklistSmartService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      worklistSmartScore: { create: jest.fn() },
    }
    svc = new WorklistSmartService(mockPrisma)
  })

  const input: SmartScoreInput = { id: 'STU-1', urgency: 2, waitingMinutes: 60, age: 70, modality: 'CT', bodyPart: '头颅' }

  describe('weights', () => {
    it('returns default weights', () => {
      expect(svc.getWeights()).toEqual({ urgencyWeight: 0.35, waitWeight: 0.3, ageWeight: 0.15, examTypeWeight: 0.2 })
    })

    it('setWeights updates only provided weights', () => {
      svc.setWeights({ urgencyWeight: 0.5 })
      const w = svc.getWeights()
      expect(w.urgencyWeight).toBe(0.5)
      expect(w.waitWeight).toBe(0.3)
    })
  })

  describe('score', () => {
    it('marks high-scoring input as critical with reasons', async () => {
      const r = await svc.score(input)
      expect(r.studyId).toBe('STU-1')
      expect(r.level).toBe('critical')
      expect(r.reasons).toEqual(expect.arrayContaining(['紧急度+2', '等待60min', '高龄患者', '头颅优先']))
    })

    it('marks mid-scoring input as urgent', async () => {
      const r = await svc.score({ id: 'S2', urgency: 2, waitingMinutes: 240, age: 30 })
      expect(r.level).toBe('urgent')
    })

    it('marks low-scoring input as low and adds default reason', async () => {
      const r = await svc.score({ id: 'S3', urgency: 0, waitingMinutes: 0, age: 30 })
      expect(r.level).toBe('low')
      expect(r.reasons).toContain('常规排序')
    })

    it('records negative urgency reason', async () => {
      const r = await svc.score({ id: 'S3b', urgency: -5, waitingMinutes: 0, age: 30 })
      expect(r.level).toBe('low')
      expect(r.reasons).toContain('紧急度-5')
    })

    it('normal range maps to normal level', async () => {
      const r = await svc.score({ id: 'S4', urgency: -1, waitingMinutes: 10, age: 30 })
      expect(r.level).toBe('normal')
    })

    it('child patient adds child reason', async () => {
      const r = await svc.score({ id: 'S5', urgency: 0, waitingMinutes: 0, age: 5 })
      expect(r.reasons).toContain('儿童患者')
    })

    it('exam type score matches high-priority body part', async () => {
      const r = await svc.score({ id: 'S6', urgency: 0, waitingMinutes: 0, modality: 'MR', bodyPart: '主动脉' })
      expect(r.score).toBeGreaterThan(0)
      expect(r.reasons).toContain('主动脉优先')
    })

  describe('factors detail', () => {
    it('score returns factor details with score & weight per factor', async () => {
      const r = await svc.score({ id: 'F1', urgency: 2, waitingMinutes: 60, age: 70, modality: 'CT', bodyPart: '头颅' })
      expect(r.factors).toHaveLength(6)
      const byKey = Object.fromEntries(r.factors.map(f => [f.key, f]))
      expect(byKey.urgency).toMatchObject({ label: '紧急度', weight: 0.35 })
      expect(byKey.wait).toMatchObject({ weight: 0.3 })
      expect(byKey.age).toMatchObject({ weight: 0.15 })
      expect(byKey.examType).toMatchObject({ weight: 0.2, score: 1 })
      expect(byKey.patientType).toMatchObject({ weight: 0.15 })
      expect(byKey.aiTriage).toMatchObject({ weight: 0.1 })
      const sum = r.factors.reduce((s, f) => s + f.contribution, 0)
      expect(Math.round(sum * 1000) / 10).toBe(r.score)
    })

    it('patientType & aiTriage factors contribute when set', async () => {
      const r = await svc.score({ id: 'F2', urgency: 0, waitingMinutes: 0, patientType: '急诊', priority: '急诊', criticalFinding: true })
      expect(r.score).toBeGreaterThan(0)
      const ai = r.factors.find(f => f.key === 'aiTriage')!
      expect(ai.score).toBe(1)
      const pt = r.factors.find(f => f.key === 'patientType')!
      expect(pt.score).toBe(1)
      expect(r.reasons).toContain('AI 分检高风险')
    })

    it('reorder rows include factors', () => {
      const ranked = svc.reorder([{ id: 'A', urgency: 3, waitingMinutes: 240 }])
      expect(ranked[0].factors).toHaveLength(6)
    })
  })

  describe('priorities', () => {
    it('buckets recent scores into critical/high/medium/low', async () => {
      mockPrisma.worklistSmartScore.findMany = jest.fn().mockResolvedValue([
        { score: 80 }, { score: 50 }, { score: 25 }, { score: 5 },
      ])
      const p = await svc.getPriorities()
      expect(p).toEqual({ critical: 1, high: 1, medium: 1, low: 1 })
    })

    it('falls back to demo counts when DB fails', async () => {
      mockPrisma.worklistSmartScore.findMany = jest.fn().mockRejectedValue(new Error('db down'))
      const p = await svc.getPriorities()
      expect(p.critical + p.high + p.medium + p.low).toBeGreaterThan(0)
    })
  })
})

  describe('reorder', () => {
    it('ranks inputs by descending score', () => {
      const ranked = svc.reorder([
        { id: 'A', urgency: 3, waitingMinutes: 240 },
        { id: 'B', urgency: -2, waitingMinutes: 5 },
        { id: 'C', urgency: 1, waitingMinutes: 40 },
      ])
      expect(ranked.map((r) => r.id)).toEqual(['A', 'C', 'B'])
      expect(ranked[0].rank).toBe(1)
      expect(ranked[0].beforeRank).toBe(1)
      expect(ranked[2].rank).toBe(3)
      expect(ranked[2].level).toBeDefined()
    })
  })
})
