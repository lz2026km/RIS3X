import { SmartRouteService, RoutingRule } from '../src/modules/smart-route/smart-route.service'

describe('SmartRouteService', () => {
  let svc: SmartRouteService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      smartRouteRule: {
        count: jest.fn().mockResolvedValue(0),
        createMany: jest.fn().mockResolvedValue({ count: 4 }),
        findMany: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 4 }),
      },
    }
    svc = new SmartRouteService(mockPrisma)
  })

  describe('assign', () => {
    it('matches rules from DB by modality/bodyPart/patientStatus', async () => {
      mockPrisma.smartRouteRule.findMany.mockResolvedValue([
        { id: 'rr-004', name: 'CT Emergency', priority: 0, enabled: true, order: 0, condition: { modality: 'CT', bodyPart: 'Any', patientStatus: 'Emergency', maxLoad: 5 }, action: {} },
        { id: 'rr-001', name: 'CT Chest - Senior', priority: 1, enabled: true, order: 1, condition: { modality: 'CT', bodyPart: 'Chest', patientStatus: 'Inpatient', maxLoad: 10 }, action: {} },
      ])
      const a = await svc.assign('STU-1', '张三', 'CT', 'Chest', 'Inpatient')
      expect(a.ruleName).toBe('CT Chest - Senior')
      expect(a.studyId).toBe('STU-1')
      expect(a.assignedTo).toMatch(/^Dr\. /)
      expect(a.id).toMatch(/^as-/)
    })

    it('picks lowest-priority-number match (priority 0) when multiple rules apply', async () => {
      mockPrisma.smartRouteRule.findMany.mockResolvedValue([
        { id: 'rr-001', name: 'A', priority: 1, enabled: true, order: 0, condition: { modality: 'CT', bodyPart: 'Any', patientStatus: 'Any', maxLoad: 10 }, action: {} },
        { id: 'rr-004', name: 'B', priority: 0, enabled: true, order: 1, condition: { modality: 'CT', bodyPart: 'Any', patientStatus: 'Any', maxLoad: 5 }, action: {} },
      ])
      const a = await svc.assign('STU-2', '李四', 'CT', 'Any', 'Any')
      expect(a.ruleName).toBe('B')
    })

    it('falls back to first rule when no rule matches', async () => {
      mockPrisma.smartRouteRule.findMany.mockResolvedValue([
        { id: 'rr-001', name: 'CT Chest - Senior', priority: 1, enabled: true, order: 0, condition: { modality: 'CT', bodyPart: 'Chest', patientStatus: 'Inpatient', maxLoad: 10 }, action: {} },
      ])
      const a = await svc.assign('STU-3', '王五', 'MR', 'Brain', 'Outpatient')
      expect(a.ruleName).toBe('CT Chest - Senior')
    })

    it('uses in-memory fallback rules when DB fails', async () => {
      mockPrisma.smartRouteRule.count.mockRejectedValue(new Error('db down'))
      const a = await svc.assign('STU-4', '赵六', 'DX', 'Any', 'Outpatient')
      expect(a.ruleName).toBe('DX Routine')
      expect(svc.getHistory().length).toBe(3)
    })
  })

  describe('getRules / updateRules', () => {
    it('getRules returns DB rules mapped to DTO', async () => {
      mockPrisma.smartRouteRule.findMany.mockResolvedValue([
        { id: 'r1', name: 'Rule 1', priority: 0, enabled: true, order: 0, condition: { modality: 'MR' }, action: {} },
      ])
      const rules = await svc.getRules()
      expect(rules[0]).toMatchObject({ id: 'r1', modality: 'MR', bodyPart: 'Any', patientStatus: 'Any', maxLoad: 10 })
    })

    it('getRules falls back to defaults when DB fails', async () => {
      mockPrisma.smartRouteRule.count.mockRejectedValue(new Error('db down'))
      const rules = await svc.getRules()
      // [G005 Wave 10A] seed 扩充: 10 条科室路由规则
      expect(rules).toHaveLength(10)
    })

    it('updateRules replaces all rules via DB', async () => {
      mockPrisma.smartRouteRule.findMany.mockResolvedValue([
        { id: 'n1', name: 'New Rule', priority: 0, enabled: true, order: 0, condition: { modality: 'CT', bodyPart: 'Chest', patientStatus: 'Any', maxLoad: 7 }, action: {} },
      ])
      const newRules: RoutingRule[] = [{ id: 'n1', name: 'New Rule', modality: 'CT', bodyPart: 'Chest', patientStatus: 'Any', maxLoad: 7, priority: 0, enabled: true }]
      const updated = await svc.updateRules(newRules)
      expect(updated).toHaveLength(1)
      expect(mockPrisma.smartRouteRule.deleteMany).toHaveBeenCalled()
    })

    it('updateRules keeps new rules in memory when DB fails', async () => {
      mockPrisma.smartRouteRule.deleteMany.mockRejectedValue(new Error('db down'))
      const newRules: RoutingRule[] = [{ id: 'n1', name: 'Offline Rule', modality: 'DX', bodyPart: 'Any', patientStatus: 'Any', maxLoad: 20, priority: 0, enabled: true }]
      const updated = await svc.updateRules(newRules)
      expect(updated[0].name).toBe('Offline Rule')
      const rules = await svc.getRules()
      expect(rules[0].name).toBe('Offline Rule')
    })
  })

  describe('history / stats', () => {
    it('getHistory returns assignments including new ones', async () => {
      expect(svc.getHistory()).toHaveLength(2)
      mockPrisma.smartRouteRule.findMany.mockResolvedValue([
        { id: 'rr-001', name: 'CT Chest - Senior', priority: 1, enabled: true, order: 0, condition: { modality: 'CT', bodyPart: 'Chest', patientStatus: 'Inpatient', maxLoad: 10 }, action: {} },
      ])
      await svc.assign('STU-5', '孙七', 'CT', 'Any', 'Any')
      expect(svc.getHistory()).toHaveLength(3)
    })

    it('stats aggregates by modality and doctor', async () => {
      const stats = svc.stats()
      expect(stats.total).toBe(2)
      expect(stats.byModality.CT).toBe(1)
      expect(stats.byModality.MR).toBe(1)
      expect(stats.byDoctor['Dr. Wang']).toBe(1)
    })
  })

  describe('recommend', () => {
    it('ranks qualified doctors by matchScore/load/accuracy', async () => {
      const recs = await svc.recommend({ modality: 'CT', bodyPart: 'Chest', patientStatus: 'Inpatient' })
      expect(recs.length).toBeGreaterThan(0)
      const top = recs[0]
      expect(top).toBeDefined()
      // [G005 Wave 10A] 20 医生 seed: Dr. Feng (胸部影像, 准确率 0.95) 综合分最高
      expect(['Dr. Wang', 'Dr. Feng']).toContain(top!.name)
      expect(top!.qualified).toBe(true)
      expect(top!.matchScore).toBe(1)
      expect(top!.accuracy).toBeGreaterThan(0)
      expect(top!.composite).toBeGreaterThan(0)
      expect(top!.reasons.some((r) => r.includes('资质匹配'))).toBe(true)
      expect(top!.reasons.some((r) => r.includes('负载'))).toBe(true)
      expect(top!.reasons.some((r) => r.includes('准确率'))).toBe(true)
    })

    it('marks modality-only doctors as qualified with lower match score', async () => {
      const recs = await svc.recommend({ modality: 'MR', bodyPart: 'Chest', patientStatus: 'Any' })
      const li = recs.find((r) => r.doctorId === 'doc-002')
      expect(li).toBeDefined()
      expect(li!.qualified).toBe(true)
      expect(li!.matchScore).toBe(0.5)
    })

    it('marks non-matching doctors as unqualified', async () => {
      const recs = await svc.recommend({ modality: 'US', bodyPart: '腹部', patientStatus: 'Any' })
      const wang = recs.find((r) => r.doctorId === 'doc-001')
      expect(wang).toBeDefined()
      expect(wang!.qualified).toBe(false)
      expect(wang!.matchScore).toBe(0)
    })

    it('uses DB report load and ReportQualityScore accuracy when available', async () => {
      mockPrisma.report = {
        groupBy: jest.fn().mockResolvedValue([
          { radiologistId: 'doc-001', _count: { radiologistId: 2 } },
          { radiologistId: 'doc-002', _count: { radiologistId: 7 } },
        ]),
      }
      mockPrisma.reportQualityScore = {
        findMany: jest.fn().mockResolvedValue([
          { totalScore: 96, report: { radiologistId: 'doc-001' } },
          { totalScore: 90, report: { radiologistId: 'doc-001' } },
          { totalScore: 80, report: { radiologistId: 'doc-002' } },
        ]),
      }
      const recs = await svc.recommend({ modality: 'CT', bodyPart: 'Chest', patientStatus: 'Inpatient' })
      const wang = recs.find((r) => r.doctorId === 'doc-001')
      const li = recs.find((r) => r.doctorId === 'doc-002')
      expect(wang).toBeDefined()
      expect(wang!.currentLoad).toBe(2)
      expect(wang!.accuracy).toBeCloseTo(0.93, 2)
      expect(li).toBeDefined()
      expect(li!.currentLoad).toBe(7)
    })

    it('falls back to seed signals when DB is unavailable', async () => {
      const broken: any = {
        smartRouteRule: { count: jest.fn().mockRejectedValue(new Error('db down')) },
        report: { groupBy: jest.fn().mockRejectedValue(new Error('db down')) },
        reportQualityScore: { findMany: jest.fn().mockRejectedValue(new Error('db down')) },
      }
      const offline = new SmartRouteService(broken)
      const recs = await offline.recommend({ modality: 'CT', bodyPart: 'Chest', patientStatus: 'Inpatient' })
      const wang = recs.find((r) => r.doctorId === 'doc-001')
      expect(wang).toBeDefined()
      expect(wang!.currentLoad).toBe(3)
      expect(wang!.accuracy).toBe(0.94)
    })

    it('assign respects a forced doctorId from recommendations', async () => {
      mockPrisma.smartRouteRule.findMany.mockResolvedValue([
        { id: 'rr-001', name: 'CT Chest - Senior', priority: 1, enabled: true, order: 0, condition: { modality: 'CT', bodyPart: 'Chest', patientStatus: 'Inpatient', maxLoad: 10 }, action: {} },
      ])
      const a = await svc.assign('STU-F1', '周八', 'CT', 'Brain', 'Inpatient', 'doc-002')
      expect(a.assignedTo).toBe('Dr. Li')
      expect(a.stage).toBe('qualification')
      expect(a.reason).toContain('推荐指定')
    })

    it('ignores forced doctorId when the doctor is not an exact match', async () => {
      mockPrisma.smartRouteRule.findMany.mockResolvedValue([
        { id: 'rr-001', name: 'CT Chest - Senior', priority: 1, enabled: true, order: 0, condition: { modality: 'CT', bodyPart: 'Chest', patientStatus: 'Inpatient', maxLoad: 10 }, action: {} },
      ])
      const a = await svc.assign('STU-F2', '吴九', 'CT', 'Chest', 'Inpatient', 'doc-002')
      // [G005 Wave 10A] 20 医生 seed: 胸部影像综合分最高者为 Dr. Feng
      expect(['Dr. Wang', 'Dr. Feng']).toContain(a.assignedTo)
      expect(a.stage).toBe('load-balance')
    })
  })

  describe('qualifications', () => {
    it('returns seeded qualifications with subspecialty', () => {
      const quals = svc.getQualifications()
      expect(quals.length).toBeGreaterThan(0)
      expect(quals[0]).toHaveProperty('subspecialty')
      expect(quals[0]).toHaveProperty('qualifications')
      expect(quals[0]).toHaveProperty('currentLoad')
      expect(quals[0]).toHaveProperty('accuracy')
    })

    it('assign routes by qualification -> load balance (lowest load doctor)', async () => {
      mockPrisma.smartRouteRule.findMany.mockResolvedValue([
        { id: 'rr-001', name: 'CT Chest - Senior', priority: 1, enabled: true, order: 0, condition: { modality: 'CT', bodyPart: 'Chest', patientStatus: 'Inpatient', maxLoad: 10 }, action: {} },
      ])
      const a = await svc.assign('STU-Q1', '钱一', 'CT', 'Chest', 'Inpatient')
      expect(['Dr. Wang', 'Dr. Feng']).toContain(a.assignedTo)
      expect(a.stage).toBe('load-balance')
      expect(a.qualification).toBe('胸部影像')
      expect(a.reason).toContain('资质匹配')
    })

    it('assign falls back to priority stage when all qualified doctors are at max load', async () => {
      ;(svc as any).qualifications.forEach((q: { currentLoad: number; maxLoad: number }) => { q.currentLoad = q.maxLoad })
      mockPrisma.smartRouteRule.findMany.mockResolvedValue([
        { id: 'rr-001', name: 'CT Chest - Senior', priority: 1, enabled: true, order: 0, condition: { modality: 'CT', bodyPart: 'Chest', patientStatus: 'Inpatient', maxLoad: 10 }, action: {} },
      ])
      const a = await svc.assign('STU-Q2', '孙二', 'CT', 'Chest', 'Inpatient')
      expect(a.stage).toBe('priority')
      expect(a.assignedTo).toMatch(/^Dr\. /)
    })
  })
})
