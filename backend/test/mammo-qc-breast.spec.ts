/**
 * [G-21 Wave3C] 乳腺质控规则 + 影像评估 spec
 *  - GET  /mammo-qc/breast-rules:  乳腺质控规则列表 (投照质量/剂量/随访建议, 15 条 seed)
 *  - POST /mammo-qc/breast-evaluate: {images:[{view,coverage,nippleTangential,compression,agd}]}
 *     → 规则命中评估 (通过/告警/不合格 + 依据)
 */
import { BadRequestException } from '@nestjs/common'
import { MammoQcService } from '../src/modules/mammo-qc/mammo-qc.service'

function failingPrisma(): any {
  return new Proxy(
    {},
    {
      get: () => () => {
        throw new Error('no db (verification stub)')
      },
    },
  )
}

const svc = new MammoQcService(failingPrisma())

describe('Wave3C 乳腺质控规则', () => {
  describe('GET /mammo-qc/breast-rules', () => {
    it('返回 15 条规则, 覆盖三类 (投照质量/剂量/随访建议)', () => {
      const rules = svc.listBreastRules()
      expect(rules).toHaveLength(15)
      const cats = new Set(rules.map((r) => r.category))
      expect(cats).toEqual(new Set(['投照质量', '剂量', '随访建议']))
    })

    it('规则含必填与建议级别, 剂量规则带 AGD 限值', () => {
      const rules = svc.listBreastRules()
      expect(rules.some((r) => r.level === 'required' && r.category === '投照质量')).toBe(true)
      const agd = rules.find((r) => r.id === 'BR-008')!
      expect(agd.metric).toBe('agd')
      expect(agd.thresholdMax).toBe(3.0)
      expect(agd.description).toContain('3.0 mGy')
    })

    it('规则副本不可污染 seed (修改副本不影响再次查询)', () => {
      const first = svc.listBreastRules()
      ;(first[0] as any).name = 'HACKED'
      const second = svc.listBreastRules()
      expect(second[0]!.name).not.toBe('HACKED')
    })
  })

  describe('POST /mammo-qc/breast-evaluate', () => {
    it('全部达标影像 → 通过 (覆盖/乳头/压迫/AGD 均合格)', () => {
      const res = svc.evaluateBreast({
        images: [
          { view: 'LCC', coverage: 92, nippleTangential: true, compression: 52, agd: 2.2 },
          { view: 'LMLO', coverage: 96, nippleTangential: true, compression: 62, agd: 2.3 },
        ],
      })
      expect(res.overall).toBe('通过')
      expect(res.failed).toBe(0)
      expect(res.warned).toBe(0)
      expect(res.passed).toBeGreaterThan(0)
      expect(res.hits.every((h) => h.status === '通过')).toBe(true)
    })

    it('CC 位覆盖不足 → 不合格且依据含覆盖百分比', () => {
      const res = svc.evaluateBreast({
        images: [{ view: 'RCC', coverage: 80, nippleTangential: true, compression: 50, agd: 2.0 }],
      })
      expect(res.overall).toBe('不合格')
      const hit = res.hits.find((h) => h.ruleId === 'BR-001')!
      expect(hit.status).toBe('不合格')
      expect(hit.basis).toContain('80%')
      expect(res.images[0]!.status).toBe('不合格')
    })

    it('AGD 超法规限值 3.0 mGy → 不合格 (BR-008)', () => {
      const res = svc.evaluateBreast({
        images: [{ view: 'RMLO', coverage: 96, nippleTangential: true, compression: 60, agd: 3.4 }],
      })
      expect(res.overall).toBe('不合格')
      const hit = res.hits.find((h) => h.ruleId === 'BR-008')!
      expect(hit.status).toBe('不合格')
      expect(hit.basis).toContain('3.40 mGy')
    })

    it('AGD 超优化目标但未超法规 → 告警 (BR-009 告警, 整体告警)', () => {
      const res = svc.evaluateBreast({
        images: [{ view: 'LCC', coverage: 91, nippleTangential: true, compression: 54, agd: 2.6 }],
      })
      expect(res.overall).toBe('告警')
      const hit = res.hits.find((h) => h.ruleId === 'BR-009')!
      expect(hit.status).toBe('告警')
      expect(res.failed).toBe(0)
      expect(res.warned).toBeGreaterThan(0)
    })

    it('乳头未切线位 → 不合格 (BR-003)', () => {
      const res = svc.evaluateBreast({
        images: [{ view: 'LMLO', coverage: 96, nippleTangential: false, compression: 60, agd: 2.3 }],
      })
      const hit = res.hits.find((h) => h.ruleId === 'BR-003')!
      expect(hit.status).toBe('不合格')
      expect(hit.basis).toContain('切线')
      expect(res.overall).toBe('不合格')
    })

    it('压迫厚度超目标 → 告警 (CC > 55mm)', () => {
      const res = svc.evaluateBreast({
        images: [{ view: 'RCC', coverage: 92, nippleTangential: true, compression: 58, agd: 2.1 }],
      })
      const hit = res.hits.find((h) => h.ruleId === 'BR-004')!
      expect(hit.status).toBe('告警')
      expect(hit.basis).toContain('58mm')
      expect(res.overall).toBe('告警')
    })

    it('视图匹配: CC 位不应用 MLO 专属规则 (BR-005/BR-011)', () => {
      const res = svc.evaluateBreast({
        images: [{ view: 'LCC', coverage: 92, nippleTangential: true, compression: 52, agd: 2.2 }],
      })
      expect(res.hits.some((h) => h.ruleId === 'BR-005')).toBe(false)
      expect(res.hits.some((h) => h.ruleId === 'BR-011')).toBe(false)
      expect(res.hits.some((h) => h.ruleId === 'BR-004')).toBe(true)
      expect(res.hits.some((h) => h.ruleId === 'BR-010')).toBe(true)
    })

    it('参数缺失影像 → 影像参数完整性告警', () => {
      const res = svc.evaluateBreast({ images: [{ view: 'RMLO' }] })
      expect(res.overall).toBe('告警')
      expect(res.images[0]!.hits.some((h) => h.ruleId === 'BR-000')).toBe(true)
    })

    it('多影像混合: 一张不合格 → 整体不合格', () => {
      const res = svc.evaluateBreast({
        images: [
          { view: 'LCC', coverage: 93, nippleTangential: true, compression: 50, agd: 2.0 },
          { view: 'LMLO', coverage: 88, nippleTangential: true, compression: 66, agd: 2.4 },
        ],
      })
      expect(res.overall).toBe('不合格')
      expect(res.images[1]!.status).toBe('不合格')
    })

    it('空 images → BadRequest', () => {
      expect(() => svc.evaluateBreast({ images: [] })).toThrow(BadRequestException)
    })
  })
})
