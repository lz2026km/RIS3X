/**
 * G005 放射RIS系统 v3.0.6.11-104 Wave 3B (contrast-safety) - 服务层 spec
 * 覆盖:
 *   1. 注射前核查阻断规则矩阵 (单独/组合)
 *   2. 过敏试验 overlay + seed 回退
 *   3. 留观门禁 (满时长 / 医生放行 / 未满拒绝)
 *   4. 孤儿模式 (无 Prisma) 审计静默跳过, 功能可用
 */
import { BadRequestException } from '@nestjs/common'
import { ContrastSafetyService } from './contrast-safety.service'

describe('ContrastSafetyService (Wave 3B 对比剂安全闭环)', () => {
  let svc: ContrastSafetyService

  beforeEach(() => {
    svc = new ContrastSafetyService(undefined)
  })

  describe('注射前核查阻断规则', () => {
    it('全部满足 → passed=true, blockers 空', () => {
      const r = svc.preInjectionCheck({ patientId: 'P1', consentSigned: true, egfr: 60, pregnant: false })
      expect(r.passed).toBe(true)
      expect(r.blockers).toEqual([])
      expect(r.checks.map((c) => c.key)).toEqual(['consent', 'allergy', 'egfr', 'pregnancy'])
    })

    it('无同意书 → NO_CONSENT', () => {
      const r = svc.preInjectionCheck({ patientId: 'P1', egfr: 60 })
      expect(r.passed).toBe(false)
      expect(r.blockers).toContain('NO_CONSENT')
    })

    it('eGFR 低于阈值 (默认 30) → EGFR_BELOW_THRESHOLD; 可覆盖阈值', () => {
      const r1 = svc.preInjectionCheck({ patientId: 'P1', consentSigned: true, egfr: 29.9 })
      expect(r1.blockers).toContain('EGFR_BELOW_THRESHOLD')
      const r2 = svc.preInjectionCheck({ patientId: 'P1', consentSigned: true, egfr: 45, threshold: 50 })
      expect(r2.blockers).toContain('EGFR_BELOW_THRESHOLD')
      expect(r2.threshold).toBe(50)
    })

    it('妊娠 → PREGNANCY', () => {
      const r = svc.preInjectionCheck({ patientId: 'P1', consentSigned: true, egfr: 90, pregnant: true })
      expect(r.blockers).toEqual(['PREGNANCY'])
    })

    it('多项命中 → blockers 含 4 项', () => {
      svc.recordAllergyTest({ patientId: 'P2', contrastType: '碘海醇', result: 'positive', testedBy: '张技师' })
      const r = svc.preInjectionCheck({ patientId: 'P2', consentSigned: false, egfr: 10, pregnant: true })
      expect(r.passed).toBe(false)
      expect(r.blockers).toEqual(expect.arrayContaining(['NO_CONSENT', 'ALLERGY_POSITIVE', 'EGFR_BELOW_THRESHOLD', 'PREGNANCY']))
    })
  })

  describe('过敏试验 overlay + seed 回退', () => {
    it('记录后患者历史只含真实记录 (时间倒序)', () => {
      svc.recordAllergyTest({ patientId: 'P3', contrastType: '碘海醇', result: 'negative', testedAt: '2026-08-01T00:00:00.000Z', testedBy: '张技师' })
      svc.recordAllergyTest({ patientId: 'P3', contrastType: '碘克沙醇', result: 'unknown', testedAt: '2026-08-02T00:00:00.000Z', testedBy: '李护士' })
      const res = svc.listAllergyTests('P3')
      expect(res.source).toBe('memory')
      expect(res.total).toBe(2)
      expect(res.latest?.result).toBe('unknown')
    })

    it('无记录患者 → seed 回退 (确定性)', () => {
      const res = svc.listAllergyTests('P-DEMO-002')
      expect(res.source).toBe('seed')
      expect(res.latest?.result).toBe('positive')
    })

    it('latestAllergyResult: 显式优先, 无记录回退 unknown', () => {
      expect(svc.latestAllergyResult('P4', 'negative')).toBe('negative')
      expect(svc.latestAllergyResult('P4')).toBe('unknown')
    })
  })

  describe('增强注射门禁', () => {
    it('未通过核查 → BadRequestException(code=PRE_INJECTION_CHECK_FAILED)', async () => {
      await expect(svc.runInjection({ patientId: 'P5', contrastType: '碘海醇' })).rejects.toBeInstanceOf(BadRequestException)
      try {
        await svc.runInjection({ patientId: 'P5', contrastType: '碘海醇' })
      } catch (e) {
        const body = (e as BadRequestException).getResponse() as { code: string; blockers: string[] }
        expect(body.code).toBe('PRE_INJECTION_CHECK_FAILED')
        expect(body.blockers).toContain('NO_CONSENT')
      }
    })

    it('通过核查 → 返回 injection-command 指令', async () => {
      const res = await svc.runInjection({ patientId: 'P6', contrastType: '碘海醇', consentSigned: true, eGFR: 80 })
      expect(res.passed).toBe(true)
      expect(res.resource).toBe('injection-command')
      expect(res.preCheck.passed).toBe(true)
      expect(res.id).toBeTruthy()
    })
  })

  describe('留观时长门禁', () => {
    it('默认 30 分钟, 未满不可离院, 医生放行可离院', async () => {
      const obs = await svc.startObservation({ patientId: 'P7' })
      expect(obs.durationMinutes).toBe(30)
      expect(obs.canDischarge).toBe(false)
      await expect(svc.dischargeObservation(obs.id, {})).rejects.toBeInstanceOf(BadRequestException)
      const released = await svc.dischargeObservation(obs.id, { doctorRelease: true, dischargedBy: '李医生' })
      expect(released.status).toBe('discharged')
      expect(released.doctorRelease).toBe(true)
    })

    it('满时长可离院', async () => {
      const startedAt = new Date(Date.now() - 31 * 60_000).toISOString()
      const obs = await svc.startObservation({ patientId: 'P8', durationMinutes: 30, startedAt })
      expect(obs.canDischarge).toBe(true)
      const done = await svc.dischargeObservation(obs.id, {})
      expect(done.status).toBe('discharged')
      expect(done.remainingSeconds).toBe(0)
    })

    it('留观记录追加 + 重复离院幂等', async () => {
      const obs = await svc.startObservation({ patientId: 'P9', durationMinutes: 1, startedAt: new Date(Date.now() - 2 * 60_000).toISOString() })
      const withRecord = await svc.addObservationRecord(obs.id, { symptoms: '轻微恶心', action: '观察', recordedBy: '张技师' })
      expect(withRecord.records).toHaveLength(1)
      const first = await svc.dischargeObservation(obs.id, {})
      const second = await svc.dischargeObservation(obs.id, {})
      expect(first.status).toBe('discharged')
      expect(second.status).toBe('discharged')
    })
  })
})
