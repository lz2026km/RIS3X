/**
 * [G005 Wave1A] Consent Education 模块 spec — 知情同意记录 + 签署 + 宣教内容库
 */
import { ConsentEducationService } from '../src/modules/consent-education/consent-education.service'

describe('Wave1A Consent Education', () => {
  it('consents: seed 列表 + create/update + sign 生命周期', () => {
    const svc = new ConsentEducationService()
    const before = svc.listConsents()
    expect(before.length).toBeGreaterThan(0)
    expect(before.every((c) => ['signed', 'pending', 'refused'].includes(c.status))).toBe(true)

    const created = svc.createConsent({ patient: '测试患者', type: '增强检查知情同意', procedure: '胸部CT增强' })
    expect(created.status).toBe('pending')
    expect(svc.listConsents()).toHaveLength(before.length + 1)

    const updated = svc.updateConsent(created.id, { witness: '王护士' })
    expect(updated.witness).toBe('王护士')

    const signed = svc.signConsent(created.id, '李医生')
    expect(signed.status).toBe('signed')
    expect(signed.signedAt).toBeTruthy()
    expect(signed.signedBy).toBe('李医生')

    expect(() => svc.getConsent('ghost')).toThrow(/不存在/)
  })

  it('materials: seed 内容库 + create (含中英文)', () => {
    const svc = new ConsentEducationService()
    const before = svc.listMaterials()
    expect(before.length).toBeGreaterThan(0)
    expect(before.some((m) => m.lang === 'en')).toBe(true)
    expect(before.some((m) => m.lang === 'zh-CN')).toBe(true)

    const created = svc.createMaterial({ title: '新的宣教材料', category: '增强检查', format: 'PDF' })
    expect(created.views).toBe(0)
    expect(svc.listMaterials()).toHaveLength(before.length + 1)
    expect(svc.getMaterial(created.id).title).toBe('新的宣教材料')
  })
})
