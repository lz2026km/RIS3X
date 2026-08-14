/**
 * [G005 Wave1A 17] Eye-Optometry 视光中心闭环 spec — seed 回退 + 确定性规则 + 内存记录
 */
import { EyeOptometryService } from '../src/modules/eye-optometry/eye-optometry.service'

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

describe('Wave1A Eye-Optometry 视光中心闭环', () => {
  it('stats: DB 失败回退确定性 seed (2580/320/480/0.42)', async () => {
    const svc = new EyeOptometryService(failingPrisma())
    const res = await svc.stats()
    expect(res.success).toBe(true)
    expect(res.data.totalPatients).toBe(2580)
    expect(res.data.okLensPatients).toBe(320)
    expect(res.data.defocusLensPatients).toBe(480)
    expect(res.data.progressionRate).toBe(0.42)
    expect(res.data.efficacyStats.okLens).toBe(-0.35)
    expect(res.data.screeningCount).toBeGreaterThan(0)
  })

  it('screening: 高/低风险确定性规则 (年龄+遗传)', () => {
    const svc = new EyeOptometryService(failingPrisma())
    const high = svc.screening({ patientId: 'P1', age: 12, parentRefraction: { reSphere: -4.0, leSphere: -3.5 } })
    expect(high.data.myopiaRisk).toBe('high')
    expect(high.data.parentRisk).toBe('high')
    expect(high.data.recommendations[0]).toBe('强烈建议 OK 镜干预')
    const low = svc.screening({ patientId: 'P2', age: 6 })
    expect(low.data.myopiaRisk).toBe('low')
    expect(low.data.screeningId).toBeTruthy()
  })

  it('refractionCurve: 确定性 5 年序列 (progression/axialGrowth)', async () => {
    const svc = new EyeOptometryService(failingPrisma())
    const res = await svc.refractionCurve('P000099')
    expect(res.success).toBe(true)
    expect(res.data.history).toHaveLength(5)
    expect(res.data.progression.rate).toBe(-0.4)
    expect(typeof res.data.axialGrowth.rate).toBe('number')
    expect(res.data.interventionEffect).toContain('OK 镜')
    const first = res.data.history[0]!
    expect(typeof first.rightEye.sphere).toBe('number')
    expect(typeof first.axialLength).toBe('number')
  })

  it('okTrial: 荧光素模式 → 配适判定', () => {
    const svc = new EyeOptometryService(failingPrisma())
    const optimal = svc.okTrial({ patientId: 'P1', trialLensId: 'TRIAL-A1', fluoresceinPattern: 'bulls-eye' })
    expect(optimal.data.fit).toBe('optimal')
    const tight = svc.okTrial({ patientId: 'P1', fluoresceinPattern: 'central-pool' })
    expect(tight.data.fit).toBe('too-tight')
    const loose = svc.okTrial({ patientId: 'P1', fluoresceinPattern: 'edge-lift' })
    expect(loose.data.fit).toBe('too-loose')
  })

  it('orthoKOrder: 订单形状 (品牌/参数/成本/随访计划)', () => {
    const svc = new EyeOptometryService(failingPrisma())
    const res = svc.orthoKOrder({
      patientId: 'P000099',
      design: { baseCurve: 7.8, returnZoneDepth: 0.55, landingZoneAngle: 33, diameter: 10.6, brand: 'Euclid Emerald' },
      prescriptionId: 'PRES001',
    })
    expect(res.success).toBe(true)
    expect(res.data.orderId.startsWith('OKO-')).toBe(true)
    expect(res.data.brand).toBe('Euclid Emerald')
    expect(res.data.parameters.baseCurve).toBe(7.8)
    expect(res.data.cost.total).toBe(8000)
    expect(res.data.followupSchedule).toHaveLength(6)
  })

  it('defocusOrder: DIMS/MiSight 品牌区分', () => {
    const svc = new EyeOptometryService(failingPrisma())
    const dims = svc.defocusOrder({ patientId: 'P1', frameSelection: 'Ray-Ban Junior', lensType: 'DIMS' })
    expect(dims.data.brand).toContain('新乐学')
    expect(dims.data.efficacy).toContain('30-60%')
    const misight = svc.defocusOrder({ patientId: 'P1', lensType: 'MiSight' })
    expect(misight.data.brand).toContain('CooperVision')
  })

  it('createRefraction + listRefraction: 创建后按 patientId 可查', async () => {
    const svc = new EyeOptometryService(failingPrisma())
    const created = svc.createRefraction({ patientId: 'P-TEST-1', reSphere: -4.25, reCylinder: -1.0, reAxis: 175, leSphere: -4.0, leCylinder: -0.75, leAxis: 5, prescriptionType: '渐进' })
    expect(created.success).toBe(true)
    expect(created.data.rightEye.sphere).toBe(-4.25)
    expect(created.data.validUntil).toBeTruthy()
    const list = await svc.listRefraction({ patientId: 'P-TEST-1' })
    expect(list.data.length).toBeGreaterThanOrEqual(1)
    expect(list.data[0]!.refractionId).toBe(created.data.refractionId)
    const all = await svc.listRefraction()
    expect(all.meta.total).toBeGreaterThanOrEqual(3)
  })

  it('createOkLens + listOkLens: 基弧 = 平K + 0.6', async () => {
    const svc = new EyeOptometryService(failingPrisma())
    const created = svc.createOkLens({ patientId: 'P-TEST-2', k1: 43.0, k2: 43.5, targetReduction: 3.0 })
    expect(created.success).toBe(true)
    expect(created.data.design.baseCurve).toBeCloseTo((43.0 + 43.5) / 2 - 0.6, 2)
    expect(created.data.design.brand).toBe('Euclid Emerald')
    expect(created.data.design.targetReduction).toBe(-3)
    const list = await svc.listOkLens({ patientId: 'P-TEST-2' })
    expect(list.data.length).toBe(1)
    expect(list.meta.total).toBe(1)
  })

  it('visionRecord: 有记录时用历史, 无记录时确定性回退序列', async () => {
    const svc = new EyeOptometryService(failingPrisma())
    svc.createRefraction({ patientId: 'P-VR', reSphere: -3.0, leSphere: -3.25 })
    const withHistory = await svc.visionRecord('P-VR')
    expect(withHistory.data.history.length).toBeGreaterThanOrEqual(1)
    expect(typeof withHistory.data.history[0]!.rightEye.sphere).toBe('number')
    const fallback = await svc.visionRecord('UNKNOWN-PATIENT')
    expect(fallback.data.history).toHaveLength(5)
    expect(fallback.data.progression.recommendation).toContain('OK 镜')
  })

  it('getOrder: 订单详情/不存在抛 NotFoundException', async () => {
    const svc = new EyeOptometryService(failingPrisma())
    const created = svc.orthoKOrder({ patientId: 'P1' })
    const detail = await svc.getOrder(created.data.orderId)
    expect(detail.data.orderId).toBe(created.data.orderId)
    await expect(svc.getOrder('NOPE')).rejects.toThrow()
  })
})
