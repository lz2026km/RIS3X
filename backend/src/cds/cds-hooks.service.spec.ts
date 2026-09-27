/**
 * [G005 v3.0.6.13] CDS Hooks spec
 * 覆盖: discovery / order-select eGFR 卡片 / order-sign / feedback
 */
import { NotFoundException } from '@nestjs/common'
import { CdsHooksService } from './cds-hooks.service'

describe('CdsHooksService', () => {
  let svc: CdsHooksService

  beforeEach(() => {
    svc = new CdsHooksService()
  })

  it('discovery 返回 order-select + order-sign 服务', () => {
    const res = svc.discovery()
    expect(res.services.length).toBe(2)
    const hooks = res.services.map((s) => s.hook)
    expect(hooks).toContain('order-select')
    expect(hooks).toContain('order-sign')
    expect(res.services.every((s) => s.id && s.title && s.description)).toBe(true)
  })

  it('order-select: eGFR<30 → critical 卡片 + override 原因', () => {
    const res = svc.invoke('contrast-appropriateness', {
      hook: 'order-select',
      context: { patientId: 'P1', examType: '增强CT', egfr: 20 },
    })
    const critical = res.cards.find((c) => c.indicator === 'critical')
    expect(critical).toBeDefined()
    expect(critical!.overrideReasons?.length).toBeGreaterThan(0)
    expect(critical!.suggestions?.length).toBeGreaterThan(0)
  })

  it('order-select: 30<=eGFR<45 → warning', () => {
    const res = svc.invoke('contrast-appropriateness', {
      hook: 'order-select',
      context: { patientId: 'P1', examType: '增强CT', egfr: 40 },
    })
    expect(res.cards.some((c) => c.indicator === 'warning')).toBe(true)
  })

  it('order-select: 非增强检查 → 无造影剂卡片', () => {
    const res = svc.invoke('contrast-appropriateness', {
      hook: 'order-select',
      context: { patientId: 'P1', modality: 'DR', examType: '胸部正位' },
    })
    expect(res.cards).toHaveLength(0)
  })

  it('order-select: 儿童增强 → 儿童剂量卡片', () => {
    const res = svc.invoke('contrast-appropriateness', {
      hook: 'order-select',
      context: { patientId: 'P1', examType: '增强CT', egfr: 80, age: 8 },
    })
    expect(res.cards.some((c) => /儿童/.test(c.summary))).toBe(true)
  })

  it('order-sign: 过敏史 + 妊娠 → 高风险卡片', () => {
    const res = svc.invoke('contrast-sign-check', {
      hook: 'order-sign',
      context: { patientId: 'P1', examType: '增强MRI', allergies: ['碘对比剂过敏'], pregnancy: true },
    })
    expect(res.cards.some((c) => c.indicator === 'critical')).toBe(true)
    expect(res.cards.some((c) => /妊娠/.test(c.summary))).toBe(true)
  })

  it('invoke 未知 service → NotFound', () => {
    expect(() => svc.invoke('nope', {})).toThrow(NotFoundException)
  })

  it('feedback 记录并可列出', () => {
    const rec = svc.recordFeedback({ serviceId: 'contrast-appropriateness', outcome: 'overridden', overrideReason: { code: 'benefit-outweighs-risk', display: '临床收益大于风险' } })
    expect(rec.id).toMatch(/^CDSFB-/)
    const list = svc.listFeedback()
    expect(list.total).toBe(1)
    expect(list.entries[0]!.outcome).toBe('overridden')
  })
})
