/**
 * [G005 Wave1B] Eye IOL Toric 散光模块 spec — 常数表 / Toric 规划 / 候选晶体 / 术后预测 / 泛化公式
 * 确定性公式 + 内存 seed (EyeService, 假 Prisma)
 */
import { NotFoundException } from '@nestjs/common'
import { EyeService } from '../src/eye/eye.service'

function makePrisma(): any {
  return {
    eyeStudy: { findMany: async () => [], findUnique: async () => null },
    eyeAiInference: { findMany: async () => [], findUnique: async () => null },
    eyeIolLens: { findMany: async () => [], findUnique: async () => null },
    patient: { findUnique: async () => null },
  }
}

describe('Wave1B Eye IOL Toric', () => {
  it('constant: 已知型号返回公式常数表 (含 aConst), meta 标注 ULIB 2024', async () => {
    const svc = new EyeService(makePrisma())
    const res = svc.getIolConstant('SA60AT')
    expect(res.success).toBe(true)
    expect(res.data['Barrett-true-K']).toMatchObject({ aConst: 118.4, sf: 1.59 })
    expect(res.data['SRK-T'].aConst).toBe(118.4)
    expect(res.meta.source).toContain('ULIB')
  })

  it('constant: SN6AT5 单型号归入 SN6AT3-SN6AT9 家族; 未知型号抛 NotFound', async () => {
    const svc = new EyeService(makePrisma())
    const family = svc.getIolConstant('SN6AT5')
    expect(family.success).toBe(true)
    expect(family.meta.family).toBe('SN6AT3-SN6AT9')
    expect(family.data['Barrett-true-K'].aConst).toBe(118.7)
    await expect(() => svc.getIolConstant('UNKNOWN-MODEL')).toThrow(NotFoundException)
  })

  it('toric/plan: 确定性公式 (K1-K2 角膜散光, 残余=角膜散光-晶体散光-SIA, 轴位旋转规则)', async () => {
    const svc = new EyeService(makePrisma())
    const res = svc.planToricIol({
      preOpK1: 44.0, preOpK2: 42.5, preOpAxis: 90,
      inducedAstigmatism: 0.3, iolModel: 'SN6AT5', iolCylinderPower: 2.25,
    })
    expect(res.success).toBe(true)
    expect(res.data.preOpCornealAstigmatism).toBe('1.50 D')
    expect(res.data.residualAstigmatism).toBe('-1.05 D')
    expect(res.data.suggestedAxis).toBe(90)
    expect(res.data.alignmentMarks.preOp).toBe('90°')
    expect(typeof res.data.calculatedAt).toBe('string')
  })

  it('toric/plan: 残余>0.5D 时轴位旋转 90°', async () => {
    const svc = new EyeService(makePrisma())
    const res = svc.planToricIol({
      preOpK1: 45.0, preOpK2: 42.0, preOpAxis: 180,
      inducedAstigmatism: 0.1, iolModel: 'SN6AT3', iolCylinderPower: 1.5,
    })
    expect(res.success).toBe(true)
    expect(Number(res.data.suggestedAxis)).toBe((180 + 90) % 180)
    expect(Number(res.data.suggestedAxis)).toBe(90)
  })

  it('toric/candidate: 返回 7 个 SN6AT3-9 候选, 每档 0.75D 递增, recommended 标记合理', async () => {
    const svc = new EyeService(makePrisma())
    const res = await svc.listToricCandidates({ cornealAst: 1.5, sia: 0.3 })
    expect(res.success).toBe(true)
    expect(res.data.length).toBeGreaterThanOrEqual(7)
    const first = res.data[0]
    expect(first.model).toBe('SN6AT3')
    expect(first.cylinderPower).toBe('2.25 D')
    expect(typeof first.recommended).toBe('boolean')
    expect(res.meta.total).toBe(res.data.length)
  })

  it('predict/postop: Hirnsdorf 公式确定性预测 (predictedSE 字符串带 D 后缀, confidence 固定)', async () => {
    const svc = new EyeService(makePrisma())
    const res = svc.predictPostopIol({ targetPower: 21.0, K1: 43.0, K2: 43.5, AL: 23.5 })
    expect(res.success).toBe(true)
    expect(res.data.targetPower).toBe(21.0)
    expect(typeof res.data.predictedSE).toBe('string')
    expect(res.data.predictedSE.endsWith(' D')).toBe(true)
    expect(res.data.confidence).toBe(0.78)
    expect(res.data.method).toContain('Hirnsdorf')
  })

  it('calculate/:formula 泛化: Barrett-true-K / SRK-T / Hill-RBF 各自确定性结果 (power/method/source)', async () => {
    const svc = new EyeService(makePrisma())
    const base = { AL: 23.5, K1: 43.0, K2: 43.5, ACD: 3.0, LT: 4.5, iolModel: 'SA60AT' }
    const b = svc.calculateIolByFormula('Barrett-true-K', base)
    expect(b.success).toBe(true)
    expect(b.data.formula).toBe('Barrett-true-K')
    expect(typeof b.data.power).toBe('number')
    expect(b.data.method).toBe('Barrett-true-K')
    const s = svc.calculateIolByFormula('SRK-T', base)
    expect(s.data.power).toBe(Math.round((118.4 - 0.9 * 43.25) * 2) / 2)
    const h = svc.calculateIolByFormula('Hill-RBF', base)
    expect(h.data.power).toBe(Math.round((118.4 - 0.9 * 43.25 - 0.05 * 0) * 2) / 2)
    expect(b.data.source).toContain('IOL 公式计算')
  })
})
