// [G005 W8-Report] ReviewTierService spec — 分级审核规则判定 + CRUD
import { ReviewTierService } from './review-tier.service'

const make = () => new ReviewTierService({} as never)

describe('ReviewTierService (W8 分级审核)', () => {
  it('危急征象 → 双签 (dual-sign)', () => {
    const res = make().resolve({ reportId: 'R1', isCritical: true, modality: 'CT' })
    expect(res.requiredTier).toBe('dual-sign')
    expect(res.critical).toBe(true)
    expect(res.steps.map((s) => s.step)).toContain('co-sign')
  })

  it('RADS 5 → 双阅 (dual-read)', () => {
    const res = make().resolve({ reportId: 'R2', radsCategory: 5, modality: 'MRI' })
    expect(res.requiredTier).toBe('dual-read')
    expect(res.steps.map((s) => s.step)).toContain('peer-read')
  })

  it('RADS 3 + 低资历 → 至少终核', () => {
    const res = make().resolve({ reportId: 'R3', radsCategory: 3, authorSeniority: 'resident', modality: 'CT' })
    expect(['final', 'dual-sign', 'dual-read']).toContain(res.requiredTier)
    expect(res.matchedRules.some((m) => m.code === 'RT-RADS-3')).toBe(true)
    expect(res.matchedRules.some((m) => m.code === 'RT-AUTHOR-JR')).toBe(true)
  })

  it('常规 → 初核', () => {
    const res = make().resolve({ reportId: 'R4', modality: 'DR', authorSeniority: 'senior' })
    expect(res.requiredTier).toBe('initial')
    expect(res.steps).toHaveLength(1)
  })

  it('自定义规则 CRUD: 创建/更新/删除', async () => {
    const svc = make()
    const created = await svc.createRule({ name: '超声双签', tier: 'dual-sign', when: { modalities: ['US'] }, reason: '超声特殊要求' })
    expect(created.id).toMatch(/^rtier-c-/)
    expect(svc.resolve({ modality: 'US' }).requiredTier).toBe('dual-sign')
    const updated = await svc.updateRule(created.id, { enabled: false })
    expect(updated.enabled).toBe(false)
    expect(svc.resolve({ modality: 'US' }).requiredTier).toBe('initial')
    const del = await svc.deleteRule(created.id)
    expect(del.deleted).toBe(true)
  })

  it('内置规则不可删除', async () => {
    const svc = make()
    await expect(svc.deleteRule('rtier-b-001')).rejects.toThrow('内置规则不可删除')
  })
})
