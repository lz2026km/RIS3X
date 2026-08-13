/**
 * [G005 Wave1A P0] Eye Subspecialty 亚专科模块 spec — seed 回退 + Exam 派生 + 动作端点判定
 */
import { EyeSubspecialtyService } from '../src/modules/eye-subspecialty/eye-subspecialty.service'

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

describe('Wave1A Eye Subspecialty', () => {
  it('listRecords: 6 亚专科 seed 回退 + 按 sub 过滤', async () => {
    const svc = new EyeSubspecialtyService(failingPrisma())
    for (const sub of ['strabismus', 'neuro', 'oncology', 'cornea', 'cataract', 'refractive']) {
      const res = await svc.listRecords(sub)
      expect(res.success).toBe(true)
      expect(res.data.every((r: any) => r.subspecialty === sub)).toBe(true)
    }
  })

  it('createRecord: 内存创建 + 列表可回读', async () => {
    const svc = new EyeSubspecialtyService(failingPrisma())
    const created = svc.createRecord('cornea', { patientId: 'P9', diagnosis: '圆锥角膜待随访' })
    expect(created.success).toBe(true)
    const res = await svc.listRecords('cornea', { patientId: 'P9' })
    expect(res.data.some((r: any) => r.id === created.data.id)).toBe(true)
  })

  it('listRecords: 未知亚专科抛 NotFoundException', async () => {
    const svc = new EyeSubspecialtyService(failingPrisma())
    await expect(svc.listRecords('unknown')).rejects.toThrow()
  })

  it('synoptophore / colorVision / pvep: 判定逻辑与 MSW 一致', () => {
    const svc = new EyeSubspecialtyService(failingPrisma())
    const st = svc.synoptophore({ patientId: 'P1', eye: 'OD', horizontalPrism: 12, verticalPrism: 0, torsion: 0 })
    expect(st.data.result.horizontal.type).toBe('内斜')
    expect(st.data.result.diagnosis).toBe('内斜视')
    const cv = svc.colorVision({ patientId: 'P1', test: 'ishihara', errors: 8, eye: 'OD' })
    expect(cv.data.diagnosis).toContain('色觉异常')
    const pv = svc.pvep({ patientId: 'P1', eye: 'OD', p100Latency: 128, p100Amplitude: 6.2 })
    expect(pv.data.p100Latency.normal).toBe(false)
    expect(pv.data.diagnosis).toContain('P100')
  })

  it('exophthalmometry / pentacam / lensOpacity: 判定逻辑与 MSW 一致', () => {
    const svc = new EyeSubspecialtyService(failingPrisma())
    const ex = svc.exophthalmometry({ patientId: 'P1', odValue: 14, osValue: 17.5, reference: 12 })
    expect(ex.data.diagnosis).toBe('左眼眼球突出')
    expect(ex.data.difference).toBe(3.5)
    const pc = svc.pentacam({ patientId: 'P1', eye: 'OD', kmax: 48.2, thinnestPachy: 455, pachyMin: 455, pachyMinX: 0, pachyMinY: 0 })
    expect(pc.data.badScore).toBe(3)
    expect(pc.data.isKeratoconus).toBe(true)
    const lo = svc.lensOpacity({ patientId: 'P1', eye: 'OD', nuclearGrade: 3, corticalGrade: 2, pscGrade: 1 })
    expect(lo.data.totalScore).toBe(6)
    expect(lo.data.needsSurgery).toBe(true)
  })

  it('refractive / low-vision prescription: 形状与 MSW 对齐', () => {
    const svc = new EyeSubspecialtyService(failingPrisma())
    const rp = svc.refractivePrescription({ rightEye: { sphere: -3.5, cylinder: -0.75, axis: 180 }, leftEye: { sphere: -3.0, cylinder: -0.5, axis: 170 } })
    expect(rp.data.prescription.rightEye.se).toBe(-3.875)
    expect(rp.data.recommendedProcedure).toBe('SMILE 全飞秒激光手术')
    const lv = svc.lowVisionPrescription({ patientId: 'P2', reDist: '0.1', reNear: '0.5', recommendation: '手持放大镜 4X' })
    expect(lv.data.rightEye.distance).toBe('0.1')
    expect(lv.data.deviceRecommendation).toBe('手持放大镜 4X')
  })
})
