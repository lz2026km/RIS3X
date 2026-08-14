import { BadRequestException } from '@nestjs/common'
import { CadRadsService, RADS_RULES } from '../src/modules/cad/cad-rads.service'

// v3.0.6.11-99 G-20: 多 RADS 后端化 — 统一评分 /rules /score /stats
describe('RadsScore (G-20 统一评分端点后端)', () => {
  let svc: CadRadsService

  beforeEach(() => {
    svc = new CadRadsService()
  })

  describe('GET /rules (评分规则表)', () => {
    it('覆盖全部 5 种 RADS 类型', () => {
      const rules = svc.getRules()
      expect(rules.map((r) => r.type)).toEqual(['lung', 'breast', 'prostate', 'liver', 'thyroid'])
    })

    it('每个类型含完整 level 列表 (criteria/level 映射)', () => {
      const byType = Object.fromEntries(svc.getRules().map((r) => [r.type, r]))
      expect(byType['lung'].levels.map((l) => l.level)).toEqual(['1', '2', '3', '4A', '4B', '4X'])
      expect(byType['breast'].levels).toHaveLength(9)
      expect(byType['prostate'].levels.map((l) => l.level)).toEqual(['1', '2', '3', '4', '5'])
      expect(byType['liver'].levels.map((l) => l.level)).toEqual(['LR-1', 'LR-2', 'LR-3', 'LR-4', 'LR-5', 'LR-M', 'LR-TIV'])
      expect(byType['thyroid'].levels.map((l) => l.level)).toEqual(['TR1', 'TR2', 'TR3', 'TR4', 'TR5'])
    })

    it('每条规则含 criteria 与 recommendations', () => {
      for (const group of RADS_RULES) {
        for (const rule of group.levels) {
          expect(rule.criteria.length).toBeGreaterThan(0)
          expect(rule.recommendations.length).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('POST /score (统一确定性评分)', () => {
    it('lung: 规则匹配返回 level + description', () => {
      const r = svc.score('lung', { noduleSizeMm: 10 })
      expect(r.level).toBe('4A')
      expect(r.score).toBe('4A')
      expect(r.category).toBe('Lung-RADS 4A')
      expect(r.description).toBe('可疑恶性')
    })

    it('lung: 毛刺状边缘 ≥8mm → 4X', () => {
      const r = svc.score('lung', { noduleSizeMm: 9, spiculatedMargin: true })
      expect(r.score).toBe('4X')
    })

    it('breast: biradsCategory 直接映射', () => {
      const r = svc.score('breast', { biradsCategory: '5' })
      expect(r.score).toBe('5')
      expect(r.description).toContain('恶性')
    })

    it('prostate: PZ 高 DWI + 低 ADC → 5', () => {
      const r = svc.score('prostate', { lesionZone: 'PZ', dwiSignal: 'high', adcValue: 600 })
      expect(r.score).toBe('5')
      expect(r.description).toBe('极高概率')
    })

    it('liver: 经典 HCC 组合 → LR-5', () => {
      const r = svc.score('liver', { sizeMm: 25, arterialPhaseEnhancement: 'nonrim', washout: 'yes', enhancingCapsule: 'yes' })
      expect(r.score).toBe('LR-5')
      expect(r.description).toBe('肯定 HCC')
    })

    it('thyroid: 实性低回声+微小钙化 → TR5', () => {
      const r = svc.score('thyroid', { composition: 'solid', echogenicity: 'hypo', shape: 'taller-than-wide', margins: 'irregular', echogenicFoci: 'punctate' })
      expect(r.score).toBe('TR5')
      expect(r.description).toBe('高度可疑')
    })

    it('findings 缺省时按类型默认规则兜底', () => {
      const r = svc.score('lung', {})
      expect(['1', '2', '3', '4A', '4B', '4X']).toContain(r.score)
      const p = svc.score('prostate', {})
      expect(p.score).toMatch(/^[1-5]$/)
    })

    it('未知类型抛 BadRequestException', () => {
      expect(() => svc.score('unknown', {})).toThrow(BadRequestException)
    })
  })

  describe('GET /stats (评分统计)', () => {
    it('记录各类型评分次数与总数', () => {
      svc.score('lung', { noduleSizeMm: 8 })
      svc.score('lung', { noduleSizeMm: 12 })
      svc.score('liver', {})
      const stats = svc.getStats()
      expect(stats.total).toBe(3)
      expect(stats.byType['lung']).toBe(2)
      expect(stats.byType['liver']).toBe(1)
      expect(stats.byType['breast']).toBeUndefined()
    })
  })
})
