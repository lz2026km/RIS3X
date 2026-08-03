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
      expect(rules).toHaveLength(4)
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

  describe('qualifications', () => {
    it('returns seeded qualifications with subspecialty', () => {
      const quals = svc.getQualifications()
      expect(quals.length).toBeGreaterThan(0)
      expect(quals[0]).toHaveProperty('subspecialty')
      expect(quals[0]).toHaveProperty('qualifications')
      expect(quals[0]).toHaveProperty('currentLoad')
    })

    it('assign routes by qualification -> load balance (lowest load doctor)', async () => {
      mockPrisma.smartRouteRule.findMany.mockResolvedValue([
        { id: 'rr-001', name: 'CT Chest - Senior', priority: 1, enabled: true, order: 0, condition: { modality: 'CT', bodyPart: 'Chest', patientStatus: 'Inpatient', maxLoad: 10 }, action: {} },
      ])
      const a = await svc.assign('STU-Q1', '钱一', 'CT', 'Chest', 'Inpatient')
      expect(a.assignedTo).toBe('Dr. Wang')
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
