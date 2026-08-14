/**
 * [G005 Wave1B] Dental Ortho 正畸模块 spec — 计划派生 / 弓形分析 / 隐形矫治分期 / 审批 / 下单
 * 确定性公式 + 内存 store (DentalService, 假 Prisma)
 */
import { DentalService } from '../src/dental/dental.service'

function makePrisma(): any {
  return {
    dentalStudy: { findMany: async () => [], findUnique: async () => null },
    dentalAppointment: { findMany: async () => [], findUnique: async () => null },
    dentalAiFinding: { findMany: async () => [] },
    dentalImplant: { findMany: async () => [] },
    dentalInvoice: { findMany: async () => [] },
    dentalInventoryItem: { findMany: async () => [] },
    patient: { findMany: async () => [], findUnique: async () => null },
  }
}

describe('Wave1B Dental Ortho', () => {
  it('ortho/plans: 从治疗 store 派生正畸计划 (含 seed 褚一鸣 Orthodontic 记录)', async () => {
    const svc = new DentalService(makePrisma())
    const res = await svc.listOrthoPlans()
    expect(res.success).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.data.length).toBeGreaterThan(0)
    expect(res.data.every((p: any) => p.id && p.patientName && p.diagnosis)).toBe(true)
    expect(res.data.some((p: any) => p.patientName === '褚一鸣')).toBe(true)
  })

  it('ortho/plans POST: 创建后列表可见且含费用/状态字段', async () => {
    const svc = new DentalService(makePrisma())
    const created = await svc.createOrthoPlan({ patientName: '测试患者', diagnosis: '安氏 II 类', plan: '固定矫治', cost: 12000 })
    expect(created.success).toBe(true)
    expect(created.data!.id).toBeTruthy()
    expect(created.data!.status).toBe('Planned')
    const list = await svc.listOrthoPlans()
    expect(list.data.some((p: any) => p.id === created.data!.id)).toBe(true)
  })

  it('ortho/plans/:id: 详情含 stages 分期 + archAnalysis 弓分析; 不存在返回 NOT_FOUND', async () => {
    const svc = new DentalService(makePrisma())
    const list = await svc.listOrthoPlans()
    const detail = await svc.getOrthoPlan(list.data[0].id)
    expect(detail.success).toBe(true)
    expect(detail.data!.totalStages).toBeGreaterThan(0)
    expect(Array.isArray(detail.data!.stages)).toBe(true)
    expect(detail.data!.archAnalysis).toHaveProperty('discrepancy')
    const missing = await svc.getOrthoPlan('NO-SUCH')
    expect(missing.success).toBe(false)
    expect(missing.error!.code).toBe('NOT_FOUND')
  })

  it('arch-analysis: 确定性弓分析 (maxilla/mandible 弓长 + 拥挤度 + needExtraction 规则)', async () => {
    const svc = new DentalService(makePrisma())
    const res = await svc.archAnalysis({})
    expect(res.success).toBe(true)
    expect(res.data.maxillaArch.archLength).toBe(48.0)
    expect(res.data.mandibleArch.archLength).toBe(42.0)
    expect(res.data.discrepancy.needExtraction).toBe(false)
    const crowded = await svc.archAnalysis({ landmarks: Array.from({ length: 10 }) })
    expect(crowded.data.discrepancy.maxillaCrowding).toBe(5.0)
    expect(crowded.data.discrepancy.needExtraction).toBe(true)
  })

  it('aligner-plans: seed 列表 (ALIGN-001 治疗中 / ALIGN-002 待开始) + POST 创建', async () => {
    const svc = new DentalService(makePrisma())
    const list = await svc.listAlignerPlans()
    expect(list.success).toBe(true)
    expect(list.data.some((p: any) => p.id === 'ALIGN-001' && p.status === 'in-progress')).toBe(true)
    const created = await svc.createAlignerPlan({ patientName: '新患者', diagnosis: '反合' })
    expect(created.success).toBe(true)
    expect(created.data!.status).toBe('pending')
    expect(created.data!.totalStages).toBe(24)
  })

  it('aligner-plans/:id/stages GET + POST: 分期牙移动确定性生成 (stage 数 = totalStages, 每期 toothMovements)', async () => {
    const svc = new DentalService(makePrisma())
    const got = await svc.getAlignerStages('ALIGN-002')
    expect(got.success).toBe(true)
    expect(got.data.length).toBe(30)
    expect(got.data[0].toothMovements.length).toBeGreaterThan(0)
    expect(got.data[0].toothMovements[0]).toHaveProperty('toothNo')
    expect(got.data[0].toothMovements[0]).toHaveProperty('dx')
    const gen = await svc.generateAlignerStages('ALIGN-001')
    expect(gen.success).toBe(true)
    expect(gen.meta!.total).toBe(24)
    expect(gen.data.length).toBe(24)
  })

  it('aligner-plans/:id/progress GET + POST: 进度派生与更新 (compliance/trackingQuality)', async () => {
    const svc = new DentalService(makePrisma())
    const got = await svc.getAlignerProgress('ALIGN-001')
    expect(got.success).toBe(true)
    expect(got.data.currentStage).toBe(8)
    expect(got.data.patientCompliance).toBeGreaterThan(0.5)
    const updated = await svc.updateAlignerProgress('ALIGN-001', { currentStage: 12, patientCompliance: 0.85 })
    expect(updated.success).toBe(true)
    expect(updated.data!.currentStage).toBe(12)
    const after = await svc.getAlignerProgress('ALIGN-001')
    expect(after.data.currentStage).toBe(12)
  })

  it('aligner-plans/:id/approve + order-lab: 状态流转 approved → ordered + 订单信息', async () => {
    const svc = new DentalService(makePrisma())
    const approved = await svc.approveAlignerPlan('ALIGN-001')
    expect(approved.success).toBe(true)
    expect(approved.data!.status).toBe('approved')
    const order = await svc.orderAlignerLab('ALIGN-001', { lab: 'AlignTech', quantity: 6, shippingMethod: 'express' })
    expect(order.success).toBe(true)
    expect(order.data!.orderId).toContain('ORD-')
    expect(order.data!.quantity).toBe(6)
    expect(order.data!.estimatedDelivery).toBeTruthy()
    const plan = await svc.getAlignerPlan('ALIGN-001')
    expect(plan.data!.status).toBe('ordered')
  })
})
