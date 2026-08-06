// [v3.0.6.11-75] /api/v1/qc/image-ai MSW handlers
// 与后端 backend/src/modules/qc/image-ai.controller.ts + image-ai.service.ts 对齐:
//   POST /qc/image-ai/score, /qc/image-ai/score-v2
//   GET  /qc/image-ai/result/:instanceId, /qc/image-ai/result-v2/:instanceId
//   GET  /qc/image-ai/stats, /qc/image-ai/stats-v2
import { http, HttpResponse, delay } from 'msw'
import { v4 as uuidv4 } from 'uuid'

const API_BASE = '/api/v1'

interface ScoreRecordV2 {
  id: string
  instanceId: string
  modality: string
  artifactScores: { motion: number; metal: number; ring: number }
  positioningScores: { setup: number; rotation: number; offset: number }
  exposure: { value: '不足' | '正常' | '过度'; score: number }
  overall: number
  operatorId?: string
  createdAt: string
}

const storeV1 = new Map<string, Record<string, unknown>>()
const storeV2 = new Map<string, ScoreRecordV2>()

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min)

function buildStatsV2(items: ScoreRecordV2[], query: URLSearchParams): Record<string, unknown> {
  let list = items
  const modality = query.get('modality')
  const operatorId = query.get('operatorId')
  const dateFrom = query.get('dateFrom')
  const dateTo = query.get('dateTo')
  if (modality) list = list.filter(x => x.modality === modality)
  if (operatorId) list = list.filter(x => x.operatorId === operatorId)
  if (dateFrom) list = list.filter(x => x.createdAt.slice(0, 10) >= dateFrom)
  if (dateTo) list = list.filter(x => x.createdAt.slice(0, 10) <= dateTo)

  const total = list.length
  if (total === 0) {
    return { totalScores: 0, avgArtifactMotion: 0, avgArtifactMetal: 0, avgArtifactRing: 0, avgArtifactOverall: 0, avgPositioningSetup: 0, avgPositioningRotation: 0, avgPositioningOffset: 0, avgPositioningOverall: 0, avgExposureScore: 0, avgOverall: 0, byModality: {}, byDate: {}, byOperator: {} }
  }
  const avgArtifactMotion = list.reduce((s, x) => s + x.artifactScores.motion, 0) / total
  const avgArtifactMetal = list.reduce((s, x) => s + x.artifactScores.metal, 0) / total
  const avgArtifactRing = list.reduce((s, x) => s + x.artifactScores.ring, 0) / total
  const avgPositioningSetup = list.reduce((s, x) => s + x.positioningScores.setup, 0) / total
  const avgPositioningRotation = list.reduce((s, x) => s + x.positioningScores.rotation, 0) / total
  const avgPositioningOffset = list.reduce((s, x) => s + x.positioningScores.offset, 0) / total
  const avgExposureScore = list.reduce((s, x) => s + x.exposure.score, 0) / total
  const avgOverall = list.reduce((s, x) => s + x.overall, 0) / total
  const byModality: Record<string, number> = {}
  const byDate: Record<string, number> = {}
  const byOperator: Record<string, number> = {}
  for (const item of list) {
    byModality[item.modality] = (byModality[item.modality] ?? 0) + 1
    byDate[item.createdAt.slice(0, 10)] = (byDate[item.createdAt.slice(0, 10)] ?? 0) + 1
    if (item.operatorId) byOperator[item.operatorId] = (byOperator[item.operatorId] ?? 0) + 1
  }
  return {
    totalScores: total,
    avgArtifactMotion: Number(avgArtifactMotion.toFixed(2)),
    avgArtifactMetal: Number(avgArtifactMetal.toFixed(2)),
    avgArtifactRing: Number(avgArtifactRing.toFixed(2)),
    avgArtifactOverall: Number(((avgArtifactMotion + avgArtifactMetal + avgArtifactRing) / 3).toFixed(2)),
    avgPositioningSetup: Number(avgPositioningSetup.toFixed(2)),
    avgPositioningRotation: Number(avgPositioningRotation.toFixed(2)),
    avgPositioningOffset: Number(avgPositioningOffset.toFixed(2)),
    avgPositioningOverall: Number(((avgPositioningSetup + avgPositioningRotation + avgPositioningOffset) / 3).toFixed(2)),
    avgExposureScore: Number(avgExposureScore.toFixed(2)),
    avgOverall: Number(avgOverall.toFixed(2)),
    byModality, byDate, byOperator,
  }
}

// [v3.0.6.11-75 W3-1] V1 评分记录列表 (qcImageAiApi.listResults: GET /qc/image-ai/results)
const SEED_V1_RESULTS = Array.from({ length: 12 }, (_, i) => ({
  id: `qc-img-${String(i + 1).padStart(3, '0')}`,
  studyId: `STU202607${String(i + 1).padStart(2, '0')}`,
  patientName: ['张伟', '李娜', '王芳', '赵敏', '陈杰', '刘洋'][i % 6],
  modality: ['CT', 'MR', 'DR', 'CT', 'MG', 'DR'][i % 6],
  device: ['GE Revolution', 'Siemens Skyra', 'Philips Duo'][i % 3],
  examDate: `2026-07-${String(20 - i).padStart(2, '0')}`,
  score: Number((3.2 + ((i * 37) % 16) / 10).toFixed(1)),
  maxScore: 5,
  issues: [
    { id: `iss-${i}-1`, category: 'motion', description: '轻微运动伪影', severity: 'low', suggestion: '检查时固定患者头部' },
    { id: `iss-${i}-2`, category: 'exposure', description: '曝光参数偏亮', severity: 'low', suggestion: '降低 10% kVp' },
  ],
  aiModel: 'qc-ai-v2.1',
  status: ['pending', 'reviewed', 'accepted', 'rejected'][i % 4],
  createdAt: new Date(Date.now() - i * 86400000).toISOString(),
}))

export const imageAiHandlers = [
  http.get(`${API_BASE}/qc/image-ai/results`, async ({ request }) => {
    await delay(delayMs())
    const url = new URL(request.url)
    let list = SEED_V1_RESULTS
    const status = url.searchParams.get('status')
    const modality = url.searchParams.get('modality')
    if (status) list = list.filter((r) => r.status === status)
    if (modality) list = list.filter((r) => r.modality === modality)
    return HttpResponse.json({ success: true, data: list, meta: { total: list.length } })
  }),
  http.get(`${API_BASE}/qc/image-ai/results/:id`, async ({ params }) => {
    await delay(delayMs(30, 80))
    const found = SEED_V1_RESULTS.find((r) => r.id === params.id)
    if (!found) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `QC result ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: found })
  }),
  http.post(`${API_BASE}/qc/image-ai/score-v2`, async ({ request }) => {
    await delay(delayMs())
    const body = (await request.json()) as Omit<ScoreRecordV2, 'id' | 'createdAt'>
    const record: ScoreRecordV2 = {
      id: uuidv4(),
      instanceId: String(body.instanceId ?? ''),
      modality: String(body.modality ?? 'CT'),
      artifactScores: body.artifactScores ?? { motion: 4, metal: 4, ring: 4 },
      positioningScores: body.positioningScores ?? { setup: 4, rotation: 4, offset: 4 },
      exposure: body.exposure ?? { value: '正常', score: 4 },
      overall: Number(body.overall ?? 4),
      operatorId: body.operatorId,
      createdAt: new Date().toISOString(),
    }
    storeV2.set(record.id, record)
    return HttpResponse.json({ success: true, data: record }, { status: 201 })
  }),
  http.post(`${API_BASE}/qc/image-ai/score`, async ({ request }) => {
    await delay(delayMs())
    const body = (await request.json()) as Record<string, unknown>
    const record = { id: uuidv4(), ...body, createdAt: new Date().toISOString() }
    storeV1.set(String(body?.instanceId ?? ''), record)
    return HttpResponse.json({ success: true, data: record }, { status: 201 })
  }),
  http.get(`${API_BASE}/qc/image-ai/result-v2/:instanceId`, async ({ params }) => {
    await delay(delayMs(30, 80))
    const instanceId = String(params.instanceId ?? '')
    const found = Array.from(storeV2.values()).find(x => x.instanceId === instanceId)
    if (!found) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `AI score V2 for instance ${instanceId} not found` } },
        { status: 404 },
      )
    }
    return HttpResponse.json({ success: true, data: found })
  }),
  http.get(`${API_BASE}/qc/image-ai/result/:instanceId`, async ({ params }) => {
    await delay(delayMs(30, 80))
    const instanceId = String(params.instanceId ?? '')
    const found = storeV1.get(instanceId)
    if (!found) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `AI score for instance ${instanceId} not found` } },
        { status: 404 },
      )
    }
    return HttpResponse.json({ success: true, data: found })
  }),
  http.get(`${API_BASE}/qc/image-ai/stats-v2`, async ({ request }) => {
    await delay(delayMs())
    const url = new URL(request.url)
    return HttpResponse.json({ success: true, data: buildStatsV2(Array.from(storeV2.values()), url.searchParams) })
  }),
  http.get(`${API_BASE}/qc/image-ai/stats`, async () => {
    await delay(delayMs())
    const list = Array.from(storeV1.values())
    const total = list.length
    const avg = (fn: (r: Record<string, unknown>) => number) =>
      total === 0 ? 0 : Number((list.reduce((s, r) => s + fn(r), 0) / total).toFixed(2))
    return HttpResponse.json({
      success: true,
      data: {
        totalScores: total,
        avgArtifact: avg(r => ((r.motionArtifact as number) + (r.metalArtifact as number) + (r.ringArtifact as number)) / 3),
        avgExposure: avg(r => ((r.exposureLow as number) + (r.exposureNormal as number) + (r.exposureOver as number)) / 3),
        avgPositioning: avg(r => ((r.positioningCorrect as number) + (r.positioningMildRotation as number) + (r.positioningSevereOffset as number)) / 3),
        avgOverall: avg(r => r.overall as number),
        byModality: {},
        byDate: {},
        byOperator: {},
      },
    })
  }),
]
