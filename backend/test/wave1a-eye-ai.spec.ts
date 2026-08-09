/**
 * [G005 Wave1A W9] EyeAiPage 4 端点 spec — ROC / 热图 / 待审核 / 病种分布 (派生 + 确定性 seed)
 */
import { EyeService } from '../src/eye/eye.service'

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

describe('Wave1A Eye AI 4 endpoints', () => {
  const svc = new EyeService(failingPrisma() as never)

  it('listPendingInferences: 仅返回待审核 (confirmed=false / pending*) 推理', async () => {
    const res = await svc.listPendingInferences()
    expect(res.success).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    for (const item of res.data as any[]) {
      expect(item.confirmed).toBe(false)
    }
    expect(res.meta.total).toBe((res.data as any[]).length)
  })

  it('getAiHeatmaps: 由推理记录确定性派生, 含 heatmapUrl', async () => {
    const res = await svc.getAiHeatmaps()
    expect(res.success).toBe(true)
    const data = res.data as any[]
    expect(data.length).toBeGreaterThan(0)
    expect(typeof data[0]!.heatmapUrl).toBe('string')
    expect(data[0]!.heatmapUrl).toContain('/mock-images/eye-heatmap-')
    // 确定性: 两次调用结果一致
    const again = await svc.getAiHeatmaps()
    expect(again.data).toEqual(data)
  })

  it('getAiRocCurve: 确定性指标且区间正确', () => {
    const res = svc.getAiRocCurve('model-dr-v5')
    expect(res.success).toBe(true)
    const d = res.data as any
    expect(d.modelId).toBe('model-dr-v5')
    expect(d.auc).toBeGreaterThan(0.8)
    expect(d.auc).toBeLessThanOrEqual(1)
    expect(d.sensitivity).toBeGreaterThan(0)
    expect(d.specificity).toBeGreaterThan(0)
    // 确定性: 同一 modelId 结果稳定
    expect(svc.getAiRocCurve('model-dr-v5')).toEqual(res)
  })

  it('getDiseaseDistribution: 病种归类统计', async () => {
    const res = await svc.getDiseaseDistribution()
    expect(res.success).toBe(true)
    const dist = res.data as Record<string, number>
    expect(Object.keys(dist).length).toBeGreaterThan(0)
    for (const v of Object.values(dist)) expect(v).toBeGreaterThan(0)
  })
})
