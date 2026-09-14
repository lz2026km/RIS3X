/**
 * G005 RIS v3.0.6.11-104 Wave 3C (知情同意落库绑定) - 服务 spec
 *
 * 覆盖:
 *   1. 落库绑定: patientId / examId 创建 + 按 patientId/examId 查询
 *   2. 扩展类型: pediatric(儿童) / pregnancy(孕妇)
 *   3. 状态机字段: pending/signed/refused/expired + signedAt/witnessName
 *   4. verify: 某检查某类型同意书是否已签 (增强检查/注射前)
 *   5. 门禁: getConsentGateForExam 增强检查未签署拦截
 *   6. 孤儿模块: seed 回退, 无 DB 可跑
 */
import { NotFoundException } from '@nestjs/common'
import { ConsentEducationService, verifyConsentForExam, getConsentGateForExam, isEnhancedExamMeta, CONSENT_STATUSES } from './consent-education.service'

describe('ConsentEducationService (Wave 3C 知情同意落库绑定)', () => {
  const svc = new ConsentEducationService()

  describe('1. 落库绑定 patientId/examId', () => {
    it('创建记录含 patientId/examId 绑定 (可选关联检查)', () => {
      const rec = svc.createConsent({ patient: '测试患者A', patientId: 'P-W3C-1', examId: 'EX-W3C-1', type: 'enhanced', procedure: '胸部增强CT' })
      expect(rec.patientId).toBe('P-W3C-1')
      expect(rec.examId).toBe('EX-W3C-1')
      expect(rec.status).toBe('pending')
      expect(rec.signedAt).toBeNull()
      expect(CONSENT_STATUSES).toContain(rec.status)
    })

    it('按 patientId / examId 过滤查询', () => {
      svc.createConsent({ patient: '测试患者B', patientId: 'P-W3C-2', examId: 'EX-W3C-2', type: 'mri' })
      const byPatient = svc.listConsents({ patientId: 'P-W3C-2' })
      expect(byPatient.some((r) => r.patientId === 'P-W3C-2')).toBe(true)
      const byExam = svc.listConsents({ examId: 'EX-W3C-2' })
      expect(byExam).toHaveLength(1)
      expect(byExam[0]!.examId).toBe('EX-W3C-2')
    })

    it('未知记录 → NotFoundException', () => {
      expect(() => svc.getConsent('no-such')).toThrow(NotFoundException)
    })
  })

  describe('2. 扩展类型 pediatric / pregnancy', () => {
    it('儿童同意书类型可创建并查询', () => {
      const rec = svc.createConsent({ patient: '儿童患者', patientId: 'P-W3C-3', examId: 'EX-W3C-3', type: 'pediatric', procedure: '儿童CT平扫' })
      expect(rec.type).toBe('pediatric')
      const list = svc.listConsents({ examId: 'EX-W3C-3', type: 'pediatric' })
      expect(list.some((r) => r.id === rec.id)).toBe(true)
    })

    it('孕妇同意书类型可创建并查询', () => {
      const rec = svc.createConsent({ patient: '孕妇患者', patientId: 'P-W3C-4', examId: 'EX-W3C-4', type: 'pregnancy', procedure: '孕期超声' })
      expect(rec.type).toBe('pregnancy')
      const list = svc.listConsents({ examId: 'EX-W3C-4', type: 'pregnancy' })
      expect(list.some((r) => r.id === rec.id)).toBe(true)
    })
  })

  describe('3. 签署状态机字段', () => {
    it('sign → status=signed + signedAt + witnessName', () => {
      const rec = svc.createConsent({ patient: '待签署患者', patientId: 'P-W3C-5', examId: 'EX-W3C-5', type: 'enhanced' })
      const signed = svc.signConsent(rec.id, { signer: '李医生', witnessName: '王护士' })
      expect(signed.status).toBe('signed')
      expect(signed.signedAt).toBeTruthy()
      expect(signed.witnessName).toBe('王护士')
      expect(signed.signedBy).toBe('李医生')
    })

    it('update 支持 refused / expired 状态', () => {
      const rec = svc.createConsent({ patient: '拒绝患者', patientId: 'P-W3C-6', examId: 'EX-W3C-6', type: 'interventional' })
      const refused = svc.updateConsent(rec.id, { status: 'refused' })
      expect(refused.status).toBe('refused')
      const expired = svc.updateConsent(rec.id, { status: 'expired' })
      expect(expired.status).toBe('expired')
      expect(expired.updatedAt).toBeTruthy()
    })

    it('update witness 与 witnessName 双写兼容', () => {
      const rec = svc.createConsent({ patient: '见证患者', patientId: 'P-W3C-7', examId: 'EX-W3C-7', type: 'mri' })
      const updated = svc.updateConsent(rec.id, { witness: '赵见证' })
      expect(updated.witness).toBe('赵见证')
      expect(updated.witnessName).toBe('赵见证')
    })
  })

  describe('4. verify 校验 (增强检查/注射前)', () => {
    it('未签署 → signed=false', () => {
      svc.createConsent({ patient: '未签患者', patientId: 'P-W3C-8', examId: 'EX-W3C-8', type: 'enhanced' })
      const v = svc.verifyConsent('EX-W3C-8', 'enhanced')
      expect(v.signed).toBe(false)
      expect(v.required).toBe(true)
      expect(v.status).toBe('pending')
    })

    it('已签署 → signed=true', () => {
      const rec = svc.createConsent({ patient: '已签患者', patientId: 'P-W3C-9', examId: 'EX-W3C-9', type: 'enhanced' })
      svc.signConsent(rec.id, { signer: '医生' })
      const v = svc.verifyConsent('EX-W3C-9', 'enhanced')
      expect(v.signed).toBe(true)
      expect(v.recordId).toBe(rec.id)
    })

    it('无绑定记录 → required=false, signed=false', () => {
      const v = verifyConsentForExam('EX-NO-RECORD')
      expect(v.required).toBe(false)
      expect(v.signed).toBe(false)
    })
  })

  describe('5. 门禁 getConsentGateForExam', () => {
    it('增强检查无同意记录 → required=true (增强检查需签署)', () => {
      const gate = getConsentGateForExam('EX-ENH-1', { modality: 'CT', bodyPart: '胸部', techNotes: '胸部增强CT' })
      expect(gate.required).toBe(true)
      expect(gate.signed).toBe(false)
    })

    it('已登记同意要求且未签署 → 门禁拦截', () => {
      svc.createConsent({ patient: '门禁患者', patientId: 'P-W3C-10', examId: 'EX-GATE-1', type: 'enhanced' })
      const gate = getConsentGateForExam('EX-GATE-1', { modality: 'CT', bodyPart: '腹部' })
      expect(gate.required).toBe(true)
      expect(gate.signed).toBe(false)
    })

    it('已登记且已签署 → 门禁放行', () => {
      const rec = svc.createConsent({ patient: '放行患者', patientId: 'P-W3C-11', examId: 'EX-GATE-2', type: 'enhanced' })
      svc.signConsent(rec.id, {})
      const gate = getConsentGateForExam('EX-GATE-2', { modality: 'CT', bodyPart: '腹部', techNotes: '增强' })
      expect(gate.required).toBe(true)
      expect(gate.signed).toBe(true)
    })

    it('普通平扫且无同意记录 → 不拦截', () => {
      const gate = getConsentGateForExam('EX-PLAIN-1', { modality: 'DR', bodyPart: '胸部', techNotes: '胸部正位片' })
      expect(gate.required).toBe(false)
      expect(gate.signed).toBe(false)
    })

    it('isEnhancedExamMeta 识别增强/对比剂关键词', () => {
      expect(isEnhancedExamMeta({ techNotes: '腹部增强CT' })).toBe(true)
      expect(isEnhancedExamMeta({ modality: 'CT', bodyPart: '对比剂' })).toBe(true)
      expect(isEnhancedExamMeta({ modality: 'CT', bodyPart: '头部' })).toBe(false)
      expect(isEnhancedExamMeta(null)).toBe(false)
    })
  })

  describe('6. seed 回退 (孤儿模块)', () => {
    it('含已签 / 待签 / 拒绝 / 儿童 / 孕妇 seed 记录', () => {
      const all = svc.listConsents()
      expect(all.length).toBeGreaterThanOrEqual(6)
      const statuses = new Set(all.map((r) => r.status))
      expect(statuses.has('signed')).toBe(true)
      expect(statuses.has('pending')).toBe(true)
      expect(statuses.has('refused')).toBe(true)
      expect(all.some((r) => r.type === 'pediatric')).toBe(true)
      expect(all.some((r) => r.type === 'pregnancy')).toBe(true)
    })
  })
})
