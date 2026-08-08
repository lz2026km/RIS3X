// [W3-B] 典型病例库 MSW handlers: /api/v1/typical-cases, /api/v1/typical-cases/stats
// 后端暂无典型病例专用端点 (teachApi 仅示教录制), 由 MSW 提供确定性演示数据。
import { http, HttpResponse, delay } from 'msw'
import { TYPICAL_CASES_SEED } from './typicalCasesSeed'

const API_BASE =
  typeof process !== 'undefined' && process.env.VITEST
    ? 'http://localhost:5173/api/v1'
    : typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin + '/api/v1'
      : 'http://localhost:5173/api/v1'

const API = `${API_BASE}/typical-cases`

function envelope(data: unknown) {
  return { source: 'demo' as const, generatedAt: new Date().toISOString(), data }
}

export const typicalCaseHandlers = [
  http.get(API, async () => {
    await delay(120)
    return HttpResponse.json({ success: true, data: envelope(TYPICAL_CASES_SEED) })
  }),

  http.get(`${API}/stats`, async () => {
    await delay(80)
    const stats = {
      total: TYPICAL_CASES_SEED.length,
      teaching: TYPICAL_CASES_SEED.filter((c) => c.teaching).length,
      pending: TYPICAL_CASES_SEED.filter((c) => c.status === '待审核').length,
      views: TYPICAL_CASES_SEED.reduce((s, c) => s + c.viewCount, 0),
      likes: TYPICAL_CASES_SEED.reduce((s, c) => s + c.likeCount, 0),
    }
    return HttpResponse.json({ success: true, data: envelope(stats) })
  }),
]
