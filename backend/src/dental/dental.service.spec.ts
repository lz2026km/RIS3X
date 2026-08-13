import { DentalService } from './dental.service'

/**
 * [G005 W1-A] 口腔 API 对齐: 在用孤儿端点单元测试 (内存 seed + 假 Prisma)
 * 覆盖: 治疗 CRUD / 排班 / 患者 / 医生 / PSR / 转诊 / 远程会诊 /
 *       CAD / 种植 3D / 导板 / 口扫 / 口腔 AI
 */

const makePrisma = () => {
  const dentalStudies: any[] = []
  const patients: any[] = []
  const prisma = {
    dentalStudy: {
      findMany: async () => dentalStudies,
      findUnique: async ({ where }: any) => dentalStudies.find(s => s.id === where.id) ?? null,
    },
    dentalAppointment: {
      findMany: async () => [],
    },
    patient: {
      findMany: async () => patients,
    },
  }
  return { prisma: prisma as any, dentalStudies, patients }
}

describe('DentalService [G005 W1-A] 在用孤儿端点', () => {
  it('治疗 CRUD + 状态流转', async () => {
    const { prisma } = makePrisma()
    const svc = new DentalService(prisma)
    const list = await svc.listTreatments({})
    expect(list.success).toBe(true)
    expect(list.data.length).toBeGreaterThan(0)
    const created = await svc.createTreatment({ patientId: 'PDNT-001', patientName: '钱立军', type: '根管治疗', toothNo: '46', status: 'pending', plan: '46 根管治疗' })
    expect(created.success).toBe(true)
    expect(created.data.id).toBeTruthy()
    const updated = await svc.updateTreatment(created.data.id, { plan: '更新方案' })
    expect(updated.data.plan).toBe('更新方案')
    const started = await svc.startTreatment(created.data.id)
    expect(started.data!.status).toBe('InProgress')
    const completed = await svc.completeTreatment(created.data.id)
    expect(completed.data!.status).toBe('Completed')
    expect((await svc.getTreatment('no-such')).success).toBe(false)
  })

  it('排班: chairs / appointments / stats / PSR', async () => {
    const { prisma } = makePrisma()
    const svc = new DentalService(prisma)
    const chairs = await svc.listScheduleChairs()
    expect(chairs.data.length).toBeGreaterThan(0)
    expect(chairs.data[0]).toHaveProperty('status')
    const appts = await svc.listScheduleAppointments('2026-08-08')
    expect(appts.success).toBe(true)
    expect(appts.data.length).toBeGreaterThan(0)
    expect(appts.data[0]).toHaveProperty('chairName')
    const stats = await svc.getScheduleStats()
    expect(stats.data).toHaveProperty('todayAppointments')
    expect(stats.data).toHaveProperty('chairUtilization')
    const created = await svc.createScheduleAppointment({ patientId: 'PDNT-001', time: '09:00', type: '初诊' })
    expect(created.data.id).toBeTruthy()
    const psr = await svc.createPsrRecord('P100001', { quadrant: 1, psrCode: 2 })
    expect(psr.success).toBe(true)
    expect((await svc.listPsrRecords('P100001')).data.length).toBeGreaterThan(0)
  })

  it('患者 / 医生列表 (假 Prisma 空表回退 seed)', async () => {
    const { prisma } = makePrisma()
    const svc = new DentalService(prisma)
    const pts = await svc.listDentalPatients()
    expect(pts.success).toBe(true)
    expect(pts.data.length).toBeGreaterThan(0)
    expect(pts.data[0]).toHaveProperty('name')
    const docs = await svc.listDentists()
    expect(docs.data.length).toBeGreaterThan(0)
    expect(docs.data[0]).toHaveProperty('specialty')
  })

  it('转诊: 创建 / 列表 / 接受', async () => {
    const { prisma } = makePrisma()
    const svc = new DentalService(prisma)
    const created = await svc.createReferral({ patientId: 'P100009', patient: '测试', target: '放射科' })
    expect(created.success).toBe(true)
    const list = await svc.listReferrals()
    expect(list.data.some((r: any) => r.id === created.data.id)).toBe(true)
    const accepted = await svc.acceptReferral(created.data.id)
    expect(accepted.data.status).toBe('accepted')
    expect((await svc.acceptReferral('no-such')).success).toBe(false)
  })

  it('远程会诊: 创建 / 列表 / 结束', async () => {
    const { prisma } = makePrisma()
    const svc = new DentalService(prisma)
    const created = await svc.createTeleSession({ title: '测试会诊', patientName: '张伟' })
    expect(created.success).toBe(true)
    expect(created.data.id).toBeTruthy()
    const list = await svc.listTeleSessions()
    expect(list.data.some((s: any) => s.id === created.data.id)).toBe(true)
    const ended = await svc.endTeleSession(created.data.id)
    expect(ended.success).toBe(true)
    const after = await svc.listTeleSessions()
    expect(after.data.some((s: any) => s.id === created.data.id)).toBe(false)
  })

  it('CAD/CAM: 材料/比色/模板 + 设计 CRUD', async () => {
    const { prisma } = makePrisma()
    const svc = new DentalService(prisma)
    expect((await svc.getCadMaterials()).data.length).toBeGreaterThan(0)
    expect((await svc.getCadShades()).data.length).toBeGreaterThan(0)
    expect((await svc.getCadTemplates()).data.length).toBeGreaterThan(0)
    const design = await svc.createCadDesign({ patientId: 'PDNT-001', toothNo: '36', type: 'crown' })
    expect(design.data.id).toBeTruthy()
    expect(design.data.status).toBe('draft')
    expect((await svc.getCadDesign(design.data.id)).data.id).toBe(design.data.id)
    const saved = await svc.saveMarginLine(design.data.id, { marginLine: [[1, 2], [3, 4]] })
    expect(saved.success).toBe(true)
    await svc.saveAnatomy(design.data.id, { thickness: 2.0 })
    expect((await svc.getCadDesign(design.data.id)).data.thickness).toBe(2.0)
    expect((await svc.updateCadStatus(design.data.id, { status: 'approved' })).data!.status).toBe('approved')
    const milled = await svc.submitMill(design.data.id, { millingUnit: 'mill-001' })
    expect(milled.data!.status).toBe('milling')
    const preview = await svc.previewCadDesign(design.data.id)
    expect(preview.data.triangleCount).toBeGreaterThan(0)
    expect((await svc.exportCadStl(design.data.id)).data.format).toBe('STL')
    expect((await svc.listCadDesigns('PDNT-001')).data.length).toBeGreaterThan(0)
  })

  it('种植 3D: 品牌/型号/导环 + 规划 CRUD + 校验审批', async () => {
    const { prisma } = makePrisma()
    const svc = new DentalService(prisma)
    const brands = await svc.getImplantBrands()
    expect(brands.data.length).toBeGreaterThan(0)
    expect(brands.data[0]).toHaveProperty('modelCount')
    const models = await svc.getImplantModels(brands.data[0].id)
    expect(models.data.length).toBeGreaterThan(0)
    expect((await svc.getGuideSleeves('Straumann')).data.length).toBeGreaterThan(0)
    const plan = await svc.createImplantPlan3d({ patientId: 'PDNT-001', toothNo: '46' })
    expect(plan.data.id).toBeTruthy()
    expect((await svc.listImplantPlans3d()).data.length).toBeGreaterThan(0)
    await svc.updateImplantPlacement(plan.data.id, { entryPoint: { x: 1, y: 2, z: 3 } })
    await svc.updateImplantModel(plan.data.id, { brand: 'Nobel', model: 'Active' })
    expect((await svc.getImplantPlan3d(plan.data.id)).data.brand).toBe('Nobel')
    const nerve = await svc.getImplantNerveDistance(plan.data.id)
    expect(nerve.data.closestNerve.safe).toBe(true)
    const roi = await svc.getImplantBoneDensityRoi(plan.data.id, {})
    expect(roi.data.densityMap.length).toBeGreaterThan(0)
    expect((await svc.markImplantNerve(plan.data.id, { points: [{ x: 1 }] })).data.markedPoints).toHaveLength(1)
    expect((await svc.validateImplantPlan(plan.data.id)).data.valid).toBe(true)
    expect((await svc.approveImplantPlan(plan.data.id)).data!.status).toBe('approved')
  })

  it('导板 / 口扫模型', async () => {
    const { prisma } = makePrisma()
    const svc = new DentalService(prisma)
    expect((await svc.getGuideMaterials()).data.length).toBeGreaterThan(0)
    const guide = await svc.createSurgicalGuide({ patientId: 'PDNT-001', toothNo: '46' })
    expect(guide.data.id).toBeTruthy()
    expect(guide.data.status).toBe('designing')
    expect((await svc.listSurgicalGuides()).data.length).toBeGreaterThan(0)
    expect((await svc.exportSurgicalGuide(guide.data.id)).data.format).toBe('STL')
    expect((await svc.getScanModel('SCAN-1')).data.format).toBe('STL')
  })

  // [v3.0.6.11-92 Wave2A P1] 导板套筒配置: PUT /dental/guide/:id/sleeve
  it('导板套筒: 更新已存在导板 sleeveType/diameter/height/angle', async () => {
    const { prisma } = makePrisma()
    const svc = new DentalService(prisma)
    const guide = await svc.createSurgicalGuide({ patientId: 'PDNT-001', toothNo: '46' })
    const res: any = await svc.updateGuideSleeve(guide.data.id, { sleeveType: 'BLT-RC-4.8', diameter: 5.0, height: 6.0, angle: 15 })
    expect(res.success).toBe(true)
    expect(res.data.sleeveType).toBe('BLT-RC-4.8')
    expect(res.data.diameter).toBe(5.0)
    expect(res.data.height).toBe(6.0)
    expect(res.data.angle).toBe(15)
    const list = await svc.listSurgicalGuides()
    const updated: any = list.data.find((g: any) => g.id === guide.data.id)
    expect(updated.sleeveType).toBe('BLT-RC-4.8')
    expect(updated.updatedAt).toBeTruthy()
  })

  it('导板套筒: 部分字段更新 (仅 sleeveType) + 不存在返回 NOT_FOUND', async () => {
    const { prisma } = makePrisma()
    const svc = new DentalService(prisma)
    const guide = await svc.createSurgicalGuide({ patientId: 'PDNT-001', toothNo: '46' })
    const res: any = await svc.updateGuideSleeve(guide.data.id, { sleeveType: 'NP-RP-4.3' })
    expect(res.success).toBe(true)
    expect(res.data.sleeveType).toBe('NP-RP-4.3')
    expect(res.data.diameter).toBeUndefined()
    const missing: any = await svc.updateGuideSleeve('GUIDE-NOPE', { sleeveType: 'x' })
    expect(missing.success).toBe(false)
    expect(missing.error.code).toBe('NOT_FOUND')
  })

  it('口腔 AI 检测返回演示结果', async () => {
    const { prisma } = makePrisma()
    const svc = new DentalService(prisma)
    const caries = await svc.detectCaries()
    expect(caries.data.detections.length).toBeGreaterThan(0)
    expect((await svc.gradePeriapical()).data.rcpScore).toBeGreaterThan(0)
    expect((await svc.measureBoneLoss()).data.boneLoss.unit).toBe('%')
    expect((await svc.detectRootCanal()).data.canals.length).toBeGreaterThan(0)
    expect((await svc.screenOralCavity()).data.findings.length).toBeGreaterThan(0)
  })
})
