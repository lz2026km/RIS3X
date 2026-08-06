// [v3.0.6.11-75] /api/v1/ai/cad MSW handlers
// 与后端 backend/src/modules/cad/cad.controller.ts + cad.service.ts 对齐:
//   POST /ai/cad/detect           -> 确定性检测 (2-5 个病灶)
//   GET  /ai/cad/result/:instanceId -> 返回内存中已检测结果, 无则确定性生成
import { http, HttpResponse, delay } from 'msw'

const API_BASE = '/api/v1'

interface CadDetection {
  type: 'nodule' | 'calcification'
  x: number
  y: number
  width: number
  height: number
  confidence: number
  size: number
}

interface CadResult {
  instanceId: string
  findings: CadDetection[]
  heatmapUrl: string | null
  detectedAt: string
  simulated: boolean
}

const mockStorage = new Map<string, CadResult>()

function hashCode(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  }
  return h >>> 0
}

function intInRange(seed: string, min: number, max: number, salt: number): number {
  return min + (hashCode(`${seed}:${salt}`) % (max - min + 1))
}

function floatInRange(seed: string, min: number, max: number, salt: number, digits = 2): number {
  const h = hashCode(`${seed}:${salt}:f`)
  const ratio = h % 10000 / 10000
  const v = min + ratio * (max - min)
  return Number(v.toFixed(digits))
}

function deterministicDetect(instanceId: string): CadResult {
  const seed = `cad:${instanceId}`
  const h = hashCode(seed)
  const findingCount = 2 + (h % 4) // 2-5 个病灶
  const findings: CadDetection[] = []
  for (let i = 0; i < findingCount; i++) {
    const slice = hashCode(`${seed}:${i}:type`)
    findings.push({
      type: (slice & 0x3) === 0 ? 'calcification' : 'nodule',
      x: intInRange(seed, 40, 460, i * 7 + 1),
      y: intInRange(seed, 40, 460, i * 7 + 2),
      width: intInRange(seed, 10, 64, i * 7 + 3),
      height: intInRange(seed, 10, 58, i * 7 + 4),
      confidence: floatInRange(seed, 0.55, 0.98, i * 7 + 5),
      size: floatInRange(seed, 2.0, 22.0, i * 7 + 6, 1),
    })
  }
  return {
    instanceId,
    findings,
    heatmapUrl: `/ai/cad/heatmap/${instanceId}`,
    detectedAt: new Date().toISOString(),
    simulated: true,
  }
}

export const cadHandlers = [
  http.post(`${API_BASE}/ai/cad/detect`, async ({ request }) => {
    await delay(200)
    const body = (await request.json()) as { instanceId?: string }
    const instanceId = String(body?.instanceId ?? '')
    if (!instanceId) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'instanceId 必填' } },
        { status: 400 },
      )
    }
    const result = deterministicDetect(instanceId)
    mockStorage.set(instanceId, result)
    return HttpResponse.json({ success: true, data: result })
  }),
  http.get(`${API_BASE}/ai/cad/result/:instanceId`, async ({ params }) => {
    await delay(100)
    const instanceId = String(params.instanceId ?? '')
    const existing = mockStorage.get(instanceId)
    if (existing) return HttpResponse.json({ success: true, data: existing })
    // 未检测过: 按确定性算法现场生成 (与后端 getResult 语义一致)
    const result = deterministicDetect(instanceId)
    mockStorage.set(instanceId, result)
    return HttpResponse.json({ success: true, data: result })
  }),
]
