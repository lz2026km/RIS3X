/**
 * [G005 W6] 登记/分诊深度增强规格:
 *   - RegistrationService: scan 检索 / prep-confirm / consent / charge-pay
 *   - TriageService: vitals + ESI 五级 + 复评 + 护士指派 + 队列优先级联动
 *   - PatientService: 结构化临床档案 read/update
 * 全部 DB-less-safe (mock Prisma 抛错 → seed/内存回退)。
 */
import { BadRequestException } from '@nestjs/common'
import { RegistrationService } from '../src/modules/registration/registration.service'
import { TriageService, type TriageExamInput } from '../src/modules/triage/triage.service'
import { PatientService } from '../src/modules/patient/patient.service'

const noDb = () => ({
  patient: {
    findFirst: jest.fn().mockRejectedValue(new Error('no db')),
    findUnique: jest.fn().mockRejectedValue(new Error('no db')),
    findMany: jest.fn().mockRejectedValue(new Error('no db')),
    count: jest.fn().mockRejectedValue(new Error('no db')),
  },
  triageRecord: {
    findFirst: jest.fn().mockRejectedValue(new Error('no db')),
    findMany: jest.fn().mockRejectedValue(new Error('no db')),
    findUnique: jest.fn().mockRejectedValue(new Error('no db')),
    create: jest.fn().mockRejectedValue(new Error('no db')),
    update: jest.fn().mockRejectedValue(new Error('no db')),
  },
}) as never

describe('RegistrationService [G005 W6]', () => {
  let svc: RegistrationService
  beforeEach(() => {
    svc = new RegistrationService(noDb() as never)
  })

  describe('scan lookup', () => {
    it('resolves a fallback patient by 18-digit ID card', async () => {
      const r = await svc.scan('110101196803120011')
      expect(r.source).toBe('seed')
      expect(r.type).toBe('ID_CARD')
      expect(r.matched?.patientId).toBe('P100001')
      expect(r.matched?.name).toBe('张伟')
    })

    it('resolves by EMPI id and marks scan type EMPI', async () => {
      const r = await svc.scan('EMPI-000003')
      expect(r.type).toBe('EMPI')
      expect(r.matched?.patientId).toBe('P100003')
    })

    it('resolves by phone number', async () => {
      const r = await svc.scan('13800001002')
      expect(r.type).toBe('PHONE')
      expect(r.matched?.name).toBe('李娜')
      expect(r.matched?.pregnancyStatus).toBe('PREGNANT')
    })

    it('returns null match for unknown code with empty candidates', async () => {
      const r = await svc.scan('UNKNOWN-CODE-XYZ')
      expect(r.matched).toBeNull()
      expect(r.candidates).toHaveLength(0)
    })

    it('rejects empty scan content', async () => {
      await expect(svc.scan('   ')).rejects.toBeInstanceOf(BadRequestException)
    })
  })

  describe('prep-confirm', () => {
    it('flags required items not yet checked', async () => {
      const r = await svc.prepConfirm('V-1001', {
        items: [{ key: 'identity', label: '身份核对', required: true, checked: true }],
        confirmedBy: '护士A',
      })
      expect(r.allRequiredChecked).toBe(false)
      expect(r.pendingKeys).toContain('consent')
      expect(r.confirmedBy).toBe('护士A')
    })

    it('marks all required checked when every required item is ticked', async () => {
      const initial = await svc.prepConfirm('V-1002', {})
      const items = initial.items.map((i) => ({ ...i, checked: true }))
      const r = await svc.prepConfirm('V-1002', { items })
      expect(r.allRequiredChecked).toBe(true)
      expect(r.pendingKeys).toHaveLength(0)
      expect(svc.getPrepConfirm('V-1002')?.allRequiredChecked).toBe(true)
    })
  })

  describe('consent', () => {
    it('records a signed consent and lists it back', async () => {
      const rec = await svc.recordConsent('V-2001', { patientId: 'P100001', consentType: 'contrast', signedBy: '张伟', witnessName: '护士A' })
      expect(rec.status).toBe('signed')
      expect(rec.agreed).toBe(true)
      expect(svc.listConsents('V-2001')).toHaveLength(1)
    })

    it('marks refused consent', async () => {
      const rec = await svc.recordConsent('V-2002', { agreed: false })
      expect(rec.status).toBe('refused')
      expect(rec.agreed).toBe(false)
    })
  })

  describe('charge / pay', () => {
    it('derives deterministic charge and pays to PAID', async () => {
      const charge = await svc.getCharge('V-3001')
      expect(charge.items.length).toBeGreaterThan(0)
      expect(charge.status).toBe('UNPAID')
      expect(charge.balance).toBe(charge.totalAmount)
      const paid = await svc.pay('V-3001', { amount: charge.totalAmount, method: 'INSURANCE' })
      expect(paid.status).toBe('PAID')
      expect(paid.balance).toBe(0)
      expect(paid.method).toBe('INSURANCE')
    })

    it('supports partial payment', async () => {
      const charge = await svc.getCharge('V-3002')
      const partial = await svc.pay('V-3002', { amount: Math.max(1, Math.round(charge.totalAmount / 2)) })
      expect(partial.status).toBe('PARTIAL')
      expect(partial.balance).toBeGreaterThan(0)
    })

    it('rejects non-positive payment amount', async () => {
      await expect(svc.pay('V-3003', { amount: 0 })).rejects.toBeInstanceOf(BadRequestException)
    })
  })
})

describe('TriageService vitals + ESI [G005 W6]', () => {
  let svc: TriageService
  const base: TriageExamInput = { examId: 'E1', patientId: 'P1', patientName: '张三', examType: 'CT头' }

  beforeEach(() => {
    svc = new TriageService(noDb() as never)
  })

  it('keeps legacy 0-100 scoring stable (unknown exam = 4)', async () => {
    const r = await svc.score({ ...base, examType: 'UnknownExam' })
    expect(r.score).toBe(4)
    expect(r.level).toBe('ROUTINE')
    expect(r.esiLevel).toBe(5)
  })

  it('elevates ESI to 1 on critical vitals breach and recommends re-triage', async () => {
    const r = await svc.score({ ...base, vitals: { systolicBp: 82, spo2: 86, heartRate: 160 } })
    expect(r.esiLevel).toBe(1)
    expect(r.queuePriority).toBe('危重')
    expect(r.reTriageRecommended).toBe(true)
    expect(r.vitalsBreaches.length).toBeGreaterThanOrEqual(1)
  })

  it('elevates ESI to 2 on moderate breach (spo2 92)', async () => {
    const r = await svc.score({ ...base, examType: 'Unknown', vitals: { spo2: 92 } })
    expect(r.esiLevel).toBe(2)
    expect(r.queuePriority).toBe('紧急')
  })

  it('does not create breaches for normal vitals', async () => {
    const r = await svc.score({ ...base, vitals: { systolicBp: 118, diastolicBp: 76, heartRate: 72, temperature: 36.6, spo2: 98, respiratoryRate: 16 } })
    expect(r.vitalsBreaches).toHaveLength(0)
    expect(r.reTriageRecommended).toBe(false)
    expect(r.esiLevel).toBe(4)
  })

  it('reTriage sets reTriageAt timestamp', async () => {
    const r = await svc.reTriage({ ...base, examId: 'E-RT', vitals: { spo2: 88 } })
    expect(r.reTriageAt).toBeTruthy()
    expect(r.reTriageRecommended).toBe(true)
    const pending = await svc.getPending()
    expect(pending.some((p) => p.examId === 'E-RT')).toBe(false) // score 未持久化, 仅内存 overlay
  })

  it('assigns a triage nurse and exposes queue priority', async () => {
    await svc.score({ ...base, examId: 'E-NURSE', vitals: { spo2: 86 } })
    const r = await svc.assignNurse('E-NURSE', 'N001', '护士长王')
    expect(r.nurseId).toBe('N001')
    expect(r.queuePriority).toBe('危重')
  })
})

describe('PatientService clinical profile [G005 W6]', () => {
  let svc: PatientService
  beforeEach(() => {
    svc = new PatientService(noDb() as never)
  })

  it('returns a deterministic seeded profile when DB unavailable', async () => {
    const a = await svc.getClinicalProfile('P100001')
    const b = await svc.getClinicalProfile('P100001')
    expect(a.patientId).toBe('P100001')
    expect(a.empiId).toBe(b.empiId)
    expect(a.idType).toBe(b.idType)
  })

  it('updates structured fields and recomputes BMI', async () => {
    await svc.getClinicalProfile('P200002')
    const updated = await svc.updateClinicalProfile('P200002', {
      heightCm: 170,
      weightKg: 68,
      structuredAllergyCodes: [{ code: '373255001', display: '碘对比剂过敏', severity: 'SEVERE' }],
      pregnancyStatus: 'PREGNANT',
      isolationFlag: 'AIRBORNE',
      renalFunction: { egfr: 45, creatinine: 130, egfrSource: 'LIS' },
      vitals: { systolicBp: 150, spo2: 93 },
    })
    expect(updated.bmi).toBeCloseTo(23.5, 1)
    expect(updated.structuredAllergyCodes[0]?.code).toBe('373255001')
    expect(updated.pregnancyStatus).toBe('PREGNANT')
    expect(updated.isolationFlag).toBe('AIRBORNE')
    expect(updated.renalFunction.egfrSource).toBe('LIS')
    expect(updated.vitals.systolicBp).toBe(150)
  })
})
