import { SimilarCaseService } from '../src/modules/similar-case/similar-case.service'

describe('SimilarCaseService', () => {
  let svc: SimilarCaseService

  beforeAll(() => {
    svc = new SimilarCaseService(null as any)
  })

  describe('extractKeywords', () => {
    it('extracts Chinese clinical keywords from report text', () => {
      const kw = svc.extractKeywords('右肺上叶见不规则结节影,考虑占位,边缘钙化')
      expect(kw).toContain('结节')
      expect(kw).toContain('占位')
      expect(kw).toContain('钙化')
    })

    it('extracts English keywords', () => {
      const kw = svc.extractKeywords('pulmonary nodule with calcification')
      expect(kw).toContain('结节')
      expect(kw).toContain('钙化')
    })

    it('returns empty for empty text', () => {
      expect(svc.extractKeywords('')).toEqual([])
      expect(svc.extractKeywords('   ')).toEqual([])
    })
  })

  describe('search by text', () => {
    it('returns ranked results for 肺结节 query, nodule cases first', async () => {
      const results = await svc.search({
        reportText: '右肺上叶见磨玻璃密度结节,大小约8mm,边界清晰',
        limit: 10,
      })
      expect(results.length).toBeGreaterThan(0)
      expect(results.length).toBeLessThanOrEqual(10)
      expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity)
      expect(results[0].keywords).toContain('结节')
    })

    it('text similarity drives ordering over feature match', async () => {
      const results = await svc.search({ reportText: '左侧基底节区梗死灶,脑缺血改变', limit: 10 })
      const top = results[0]
      expect(top.keywords).toContain('梗死')
      expect(top.textScore).toBeGreaterThanOrEqual(top.featureScore)
    })

    it('modality + bodyPart filter boosts feature score', async () => {
      const base = await svc.search({ reportText: '胸部CT发现结节影', limit: 50 })
      const boosted = await svc.search({
        reportText: '胸部CT发现结节影',
        modality: 'CT',
        bodyPart: '胸部',
        limit: 50,
      })
      expect(boosted[0].featureScore).toBeGreaterThanOrEqual(base[0].featureScore)
    })

    it('results are deterministic', async () => {
      const a = await svc.search({ reportText: '骨折伴骨质疏松', limit: 10 })
      const b = await svc.search({ reportText: '骨折伴骨质疏松', limit: 10 })
      expect(a.map((r) => `${r.id}:${r.similarity}`)).toEqual(b.map((r) => `${r.id}:${r.similarity}`))
    })

    it('respects limit', async () => {
      const results = await svc.search({ reportText: '结节', limit: 3 })
      expect(results).toHaveLength(3)
    })
  })

  describe('findByReport', () => {
    it('finds similar cases for demo report id, excluding source', async () => {
      const results = await svc.findByReport('rpt-1001', 5)
      expect(results.length).toBeGreaterThan(0)
      expect(results.some((r) => r.reportId === 'rpt-1001')).toBe(false)
      expect(results[0].reportId).toBe('rpt-1002')
    })

    it('returns empty for unknown report id without db', async () => {
      const results = await svc.findByReport('rpt-unknown')
      expect(results).toEqual([])
    })
  })

  describe('feedback', () => {
    it('records useful feedback in memory fallback', async () => {
      await svc.feedback({ reportId: 'rpt-1001', targetReportId: 'rpt-1002', useful: true })
      const stats = svc.feedbackStats()
      expect(stats.total).toBeGreaterThan(0)
      expect(stats.useful).toBeGreaterThan(0)
    })
  })

  describe('composite scoring weights', () => {
    it('similarity = round(100 * (0.5*text + 0.3*feature + 0.2*snomed))', async () => {
      const results = await svc.search({ reportText: '右肺上叶结节', modality: 'CT', bodyPart: '胸部', limit: 10 })
      for (const r of results) {
        const expected = Math.round(100 * (0.5 * r.textScore + 0.3 * r.featureScore + 0.2 * r.snomedScore))
        expect(r.similarity).toBe(expected)
      }
    })
  })
})
