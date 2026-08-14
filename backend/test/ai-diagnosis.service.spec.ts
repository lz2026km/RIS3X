import { AiDiagnosisService } from '../src/modules/ai-diagnosis/ai-diagnosis.service'

/**
 * [W6] ai-diagnosis 4 模型 results 端点回归: 纯内存 seed, 无 DB 依赖。
 * 覆盖 controller → service list* 路径 (GET /ai-diagnosis/{model}/results)。
 * 期望: 无 DB 时返回确定性数据 ({ success: true, data: [...] }), 而非 500。
 */
describe('AiDiagnosisService results endpoints (no DB)', () => {
  let svc: AiDiagnosisService

  beforeEach(() => {
    svc = new AiDiagnosisService()
  })

  it('listLungCad returns deterministic seed data without DB', async () => {
    const res = await svc.listLungCad()
    expect(res.success).toBe(true)
    expect(res.data.length).toBeGreaterThan(0)
    expect(res.data[0].id).toMatch(/^LUNG-/)
    expect(res.data[0].nodules.length).toBe(res.data[0].noduleCount)
    expect(res.data[0].status).toMatch(/^(auto|reviewed|confirmed)$/)
    expect(res.data[0].createdAt).toBeDefined()
  })

  it('listBreastCad returns deterministic seed data without DB', async () => {
    const res = await svc.listBreastCad()
    expect(res.success).toBe(true)
    expect(res.data.length).toBeGreaterThan(0)
    expect(res.data[0].id).toMatch(/^BREAST-/)
    expect(res.data[0].lesions.length).toBe(res.data[0].lesionCount)
    expect(res.data[0].overallBiRads).toBeDefined()
    expect(res.data[0].status).toMatch(/^(auto|reviewed|confirmed)$/)
  })

  it('listFractureCad returns deterministic seed data without DB', async () => {
    const res = await svc.listFractureCad()
    expect(res.success).toBe(true)
    expect(res.data.length).toBeGreaterThan(0)
    expect(res.data[0].id).toMatch(/^FRACTURE-/)
    expect(res.data[0].fractures.length).toBe(res.data[0].fractureCount)
    expect(res.data[0].severity).toMatch(/^(mild|moderate|severe)$/)
    expect(res.data[0].status).toMatch(/^(auto|reviewed|confirmed)$/)
  })

  it('listCardiacAi returns deterministic seed data without DB', async () => {
    const res = await svc.listCardiacAi()
    expect(res.success).toBe(true)
    expect(res.data.length).toBeGreaterThan(0)
    expect(res.data[0].id).toMatch(/^CARDIAC-/)
    expect(res.data[0].measurements.length).toBeGreaterThan(0)
    expect(Array.isArray(res.data[0].stenosis)).toBe(true)
    expect(res.data[0].status).toMatch(/^(auto|reviewed|confirmed)$/)
  })

  it('all four list* results are JSON-serializable (no circular/undefined leaves)', async () => {
    const all = [
      await svc.listLungCad(),
      await svc.listBreastCad(),
      await svc.listFractureCad(),
      await svc.listCardiacAi(),
    ]
    for (const r of all) {
      expect(() => JSON.parse(JSON.stringify(r))).not.toThrow()
    }
  })
})
