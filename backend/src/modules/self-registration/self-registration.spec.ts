/**
 * [G005 W12-PatientService] 自助登记 识别/签到/问卷/同意/取号 规格
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { SelfRegistrationService } from './self-registration.service'

describe('[W12] 自助登记', () => {
  let svc: SelfRegistrationService
  beforeEach(() => {
    svc = new SelfRegistrationService()
  })

  it('identify: 身份证/手机号匹配患者', () => {
    const byCard = svc.identify({ idCard: '110101196803120011' })
    expect(byCard.matched?.patientId).toBe('P100001')
    expect(byCard.source).toBe('seed')
    const byPhone = svc.identify({ phone: '13800001002' })
    expect(byPhone.matched?.name).toBe('李娜')
    expect(() => svc.identify({})).toThrow(BadRequestException)
  })

  it('identify: 通过姓名给候选', () => {
    const res = svc.identify({ name: '不存在' })
    expect(res.matched).toBeNull()
    expect(res.candidates.length).toBeGreaterThan(0)
  })

  it('check-in: 缺问卷/同意时 BLOCKED, 完成后 CHECKED_IN', () => {
    const blocked = svc.checkIn({ patientId: 'P100001' })
    expect(blocked.status).toBe('BLOCKED')
    expect(blocked.blockers).toEqual(expect.arrayContaining(['未完成检查前问卷', '未签署知情同意']))
    svc.submitQuestionnaire({ patientId: 'P100001' })
    svc.signConsent({ patientId: 'P100001', signature: '张伟' })
    const done = svc.checkIn({ patientId: 'P100001' })
    expect(done.status).toBe('CHECKED_IN')
    const again = svc.checkIn({ patientId: 'P100001' })
    expect(again.status).toBe('ALREADY_CHECKED_IN')
    expect(() => svc.checkIn({ patientId: 'P-nope' })).toThrow(NotFoundException)
  })

  it('questionnaire: 过敏/妊娠/植入物 → HIGH 风险', () => {
    const q = svc.submitQuestionnaire({ patientId: 'P100002', allergies: ['碘对比剂'], pregnant: true, implants: ['金属瓣膜'] })
    expect(q.allergyFlag).toBe(true)
    expect(q.pregnancyFlag).toBe(true)
    expect(q.implantFlag).toBe(true)
    expect(q.riskLevel).toBe('HIGH')
    expect(q.riskNotes.length).toBeGreaterThanOrEqual(3)
    expect(q.prepItems.length).toBeGreaterThan(0)
    const low = svc.submitQuestionnaire({ patientId: 'P100003' })
    expect(low.riskLevel).toBe('LOW')
  })

  it('consent: 同意需签名, 拒绝免签', () => {
    expect(() => svc.signConsent({ patientId: 'P100001', agreed: true })).toThrow(BadRequestException)
    const refused = svc.signConsent({ patientId: 'P100001', agreed: false })
    expect(refused.status).toBe('refused')
    const signed = svc.signConsent({ patientId: 'P100001', signature: '张伟', consentType: 'contrast' })
    expect(signed.status).toBe('signed')
    expect(signed.signatureHash).toMatch(/^[0-9a-f]+$/)
    expect(svc.listConsents('P100001')).toHaveLength(2)
  })

  it('queue-number: 取号确定性 + 优先序', () => {
    const a = svc.issueQueueNumber({ patientId: 'P100001', modality: 'CT' })
    expect(a.ticket).toMatch(/^C\d{3}$/)
    expect(a.position).toBeGreaterThanOrEqual(1)
    expect(a.room).toMatch(/^CT-\d$/)
    const urgent = svc.issueQueueNumber({ patientId: 'P100002', modality: 'CT', priority: 'URGENT' })
    expect(urgent.priority).toBe('URGENT')
    expect(svc.listQueue('CT').length).toBe(2)
  })

  it('status: 汇总签到/问卷/同意/取号', () => {
    svc.submitQuestionnaire({ patientId: 'P100004' })
    svc.signConsent({ patientId: 'P100004', signature: '陈杰' })
    svc.checkIn({ patientId: 'P100004' })
    svc.issueQueueNumber({ patientId: 'P100004', modality: 'DR' })
    const st = svc.status('P100004')
    expect(st.checkedIn).toBe(true)
    expect(st.questionnaireDone).toBe(true)
    expect(st.consentSigned).toBe(true)
    expect(st.queue?.modality).toBe('DR')
  })
})
