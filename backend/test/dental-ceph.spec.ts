/**
 * [G005 Wave1B] Dental Ceph 头影测量模块 spec — 检查列表 / 分析类型字典 / 标定点 / 确定性测量计算
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

describe('Wave1B Dental Ceph', () => {
  it('ceph/studies: seed 检查列表 (含已分析/待分析状态) + POST 创建', async () => {
    const svc = new DentalService(makePrisma())
    const res = await svc.listCephStudies()
    expect(res.success).toBe(true)
    expect(res.data.length).toBeGreaterThanOrEqual(4)
    expect(res.data.some((s: any) => s.id === 'CEPH-001' && s.status === 'analyzed')).toBe(true)
    const created = await svc.createCephStudy({ patientName: '测试', age: 10, gender: 'F' })
    expect(created.success).toBe(true)
    expect(created.data!.status).toBe('pending')
    expect(created.data!.id).toContain('CEPH-')
  })

  it('ceph/studies/:id: 详情; 不存在返回 NOT_FOUND', async () => {
    const svc = new DentalService(makePrisma())
    const res = await svc.getCephStudy('CEPH-003')
    expect(res.success).toBe(true)
    expect(res.data!.patientName).toBe('刘阳')
    const missing = await svc.getCephStudy('NO-SUCH')
    expect(missing.success).toBe(false)
    expect(missing.error!.code).toBe('NOT_FOUND')
  })

  it('ceph/analysis-types: 字典含 Steiner/Downs/McNamara/Ricketts/Tweed/Coben 6 类', async () => {
    const svc = new DentalService(makePrisma())
    const res = await svc.listCephAnalysisTypes()
    expect(res.success).toBe(true)
    expect(res.data.length).toBe(6)
    const ids = res.data.map((t: any) => t.id)
    expect(ids).toContain('steiner')
    expect(ids).toContain('tweeds')
    expect(res.data[0].keyMeasurements).toContain('SNA')
  })

  it('ceph/landmarks + ceph/:id/landmarks: 默认 18 标定点; PUT 保存后可读回', async () => {
    const svc = new DentalService(makePrisma())
    const def = await svc.getDefaultCephLandmarks()
    expect(def.success).toBe(true)
    expect(Object.keys(def.data).length).toBeGreaterThanOrEqual(18)
    expect(def.data.N).toMatchObject({ x: 250, y: 80 })
    const per = await svc.getCephLandmarks('CEPH-001')
    expect(per.success).toBe(true)
    expect(per.meta!.source).toBe('default')
    const saved = await svc.saveCephLandmarks('CEPH-001', { landmarks: { N: { x: 10, y: 10 } } })
    expect(saved.success).toBe(true)
    expect(saved.data!.studyId).toBe('CEPH-001')
    const reread = await svc.getCephLandmarks('CEPH-001')
    expect(reread.meta!.source).toBe('saved')
    expect(reread.data.N).toMatchObject({ x: 10, y: 10 })
  })

  it('ceph/:id/analysis POST: 有标定点时 SNA/SNB/ANB 由夹角确定性计算 (ANB = SNA - SNB)', async () => {
    const svc = new DentalService(makePrisma())
    const svc2 = new DentalService(makePrisma())
    // S-A-N 三点: 夹角由 atan2 计算 (像素坐标)
    await svc.saveCephLandmarks('CEPH-001', {
      landmarks: {
        S: { x: 220, y: 150 }, N: { x: 250, y: 80 }, A: { x: 240, y: 200 }, B: { x: 230, y: 260 },
      },
    })
    const res = await svc.runCephAnalysis('CEPH-001', { type: 'steiner' })
    expect(res.success).toBe(true)
    const m = (res.data.measurements as any[]).reduce((acc: any, x: any) => { acc[x.key] = x.value; return acc }, {} as any)
    expect(m.SNA).toBeGreaterThan(0)
    expect(m.SNA).toBeLessThan(90)
    expect(m.SNB).toBeGreaterThan(0)
    expect(m.SNB).toBeLessThan(90)
    expect(m.ANB).toBeCloseTo(m.SNA - m.SNB, 0)
    expect(res.data.analysisType).toBe('steiner')
    expect(res.data.computedFrom).toBe('landmarks')
    // 同样标定点 → 结果确定性一致
    const res2 = await svc2.runCephAnalysis('CEPH-001', { type: 'steiner' })
    expect(res2.data.measurements[0].value).toBe(res.data.measurements[0].value)
  })

  it('ceph/:id/analysis POST: 无标定点回退 seed (82/80/2) 且标记未用标定点', async () => {
    const svc = new DentalService(makePrisma())
    const res = await svc.runCephAnalysis('CEPH-004', { type: 'steiner' })
    expect(res.success).toBe(true)
    const m = (res.data.measurements as any[]).reduce((acc: any, x: any) => { acc[x.key] = x.value; return acc }, {} as any)
    expect(m.SNA).toBe(82)
    expect(m.SNB).toBe(80)
    expect(m.ANB).toBe(2)
    expect(res.data.measurements.length).toBeGreaterThan(5)
    expect(res.data.diagnosis).toContain('骨性 I 类')
  })

  it('ceph/:id/analysis GET: 未分析检查返回 NOT_FOUND; 分析后可读回', async () => {
    const svc = new DentalService(makePrisma())
    const missing = await svc.getCephAnalysis('CEPH-002')
    expect(missing.success).toBe(false)
    await svc.runCephAnalysis('CEPH-002', { type: 'mcmamara' })
    const got = await svc.getCephAnalysis('CEPH-002')
    expect(got.success).toBe(true)
    expect(got.data!.analysisType).toBe('mcmamara')
  })
})
