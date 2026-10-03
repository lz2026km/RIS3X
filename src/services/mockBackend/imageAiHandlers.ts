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

// [G005 Wave3A P16] 三维度评估历史 (内存 + seed, 与后端 image-ai.service.listAssessments 对齐)
interface AssessRecord {
  id: string
  studyId: string
  instanceId?: string
  modality: string
  bodyPart: string
  assessedAt: string
  artifact: { score: number; label: string; issues: string[] }
  exposure: { score: number; label: string; issues: string[] }
  positioning: { score: number; label: string; issues: string[] }
  overall: { score: number; label: string }
}
const assessStore = new Map<string, AssessRecord>()
let assessSeq = 0

const ASSESS_SEED_IDS = ['EX-5001', 'EX-5002', 'EX-5003', 'EX-5004', 'EX-5005', 'STU20260701', 'STU20260702', 'STU20260703', 'STU20260704', 'STU20260705', 'STU20260706', 'STU20260707']
const ASSESS_SEED_MODS = ['CT', 'MR', 'DR', 'CT', 'MG', 'DR', 'CT', 'MR', 'DR', 'CT', 'MR', 'DR']
const ASSESS_SEED_PARTS = ['头颅', '胸部', '腹部', '腰椎', '胸部', '颈椎', '胸部', '头颅', '胸部', '盆腔', '腰椎', '胸部']

function seedAssessStore(): void {
  if (assessStore.size > 0) return
  for (let i = 0; i < ASSESS_SEED_IDS.length; i++) {
    const studyId = ASSESS_SEED_IDS[i]!
    const h = hashAssess(studyId)
    const rnd = (salt: number) => ((h >>> (salt % 28)) % 1000) / 1000
    const clamp = (v: number) => Math.max(55, Math.min(99, v))
    const label = (s: number) => (s >= 90 ? '优秀' : s >= 80 ? '良好' : s >= 70 ? '一般' : '较差')
    const modality = ASSESS_SEED_MODS[i]!
    const bodyPart = ASSESS_SEED_PARTS[i]!
    const m = modality.toUpperCase()
    let ab = 88
    if (m === 'MR') ab = 80
    if (m === 'CT') ab = 84
    if (m === 'DR' || m === 'CR') ab = 86
    if (m === 'MG') ab = 82
    let eb = 90
    if (m === 'DR' || m === 'CR') eb = 82
    if (m === 'MG') eb = 85
    if (m === 'MR') eb = 92
    let pb = 88
    if (m === 'DR' || m === 'CR') pb = 80
    if (m === 'MG') pb = 78
    if (m === 'MR') pb = 90
    const artifact = clamp(Math.round(ab - rnd(3) * 14))
    const exposure = clamp(Math.round(eb - rnd(7) * 12))
    const positioning = clamp(Math.round(pb - rnd(11) * 14))
    const overall = clamp(Math.round(artifact * 0.35 + exposure * 0.3 + positioning * 0.35))
    assessStore.set(studyId, {
      id: `assess-${++assessSeq}`,
      studyId,
      modality,
      bodyPart,
      assessedAt: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
      artifact: { score: artifact, label: label(artifact), issues: artifact < 85 ? ['检测到轻微运动伪影，建议检查时固定患者体位'] : ['未见明显伪影'] },
      exposure: { score: exposure, label: label(exposure), issues: exposure < 85 ? ['曝光参数偏暗，软组织对比度不足'] : ['曝光参数正常'] },
      positioning: { score: positioning, label: label(positioning), issues: positioning < 85 ? ['体位轻度旋转，解剖对称性欠佳'] : ['体位摆位正确'] },
      overall: { score: overall, label: label(overall) },
    })
  }
}

function hashAssess(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0
  return h
}

seedAssessStore()

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

// [G005 Wave1A W9] V2 评分记录列表 (qcImageAiApi.listResults: GET /qc/image-ai/result-v2)
// 与后端 image-ai.service.listV2 对齐: storeV2 为空时以确定性 seed 派生记录
const SEED_V1_RESULTS = Array.from({ length: 12 }, (_, i) => ({
  id: `qc-img-${String(i + 1).padStart(3, '0')}`,
  instanceId: `STU202607${String(i + 1).padStart(2, '0')}`,
  modality: ['CT', 'MR', 'DR', 'CT', 'MG', 'DR'][i % 6],
  artifactScores: { motion: 4, metal: 3 + (i % 2), ring: 4 },
  positioningScores: { setup: 4, rotation: 3 + (i % 2), offset: 4 },
  exposure: { value: '正常', score: 4 },
  overall: Number((3.2 + ((i * 37) % 16) / 10).toFixed(1)),
  operatorId: `op-${(i % 3) + 1}`,
  createdAt: new Date(Date.now() - i * 86400000).toISOString(),
}))

// [G005 demo] V1 评分记录确定性 seed (与 SEED_V1_RESULTS 同实例集, 保证
//   GET /qc/image-ai/result/:instanceId 对 seed 实例返回记录而非 404,
//   并使 GET /qc/image-ai/stats 非零)
const SEED_V1_SCORES = Array.from({ length: 12 }, (_, i) => ({
  id: `qc-img-v1-${String(i + 1).padStart(3, '0')}`,
  instanceId: `STU202607${String(i + 1).padStart(2, '0')}`,
  modality: ['CT', 'MR', 'DR', 'CT', 'MG', 'DR'][i % 6],
  motionArtifact: 4,
  metalArtifact: 3 + (i % 2),
  ringArtifact: 4,
  exposureLow: 0,
  exposureNormal: 1,
  exposureOver: 0,
  positioningCorrect: 4,
  positioningMildRotation: 3 + (i % 2),
  positioningSevereOffset: 0,
  overall: Number((3.2 + ((i * 37) % 16) / 10).toFixed(1)),
  operatorId: `op-${(i % 3) + 1}`,
  createdAt: new Date(Date.now() - i * 86400000).toISOString(),
}))

// [G005 demo] 模块加载幂等 seed: 空 store 时注入确定性评分, 避免 KPI/统计为 0
function seedScoreStores(): void {
  if (storeV2.size === 0) {
    for (const r of SEED_V1_RESULTS) storeV2.set(r.id, r as unknown as ScoreRecordV2)
  }
  if (storeV1.size === 0) {
    for (const r of SEED_V1_SCORES) storeV1.set(r.instanceId, r as unknown as Record<string, unknown>)
  }
}

seedScoreStores()

export const imageAiHandlers = [
  http.get(`${API_BASE}/qc/image-ai/result-v2`, async ({ request }) => {
    await delay(delayMs())
    const url = new URL(request.url)
    let list = Array.from(storeV2.values())
    if (list.length === 0) list = SEED_V1_RESULTS as unknown as ScoreRecordV2[]
    const modality = url.searchParams.get('modality')
    const operatorId = url.searchParams.get('operatorId')
    if (modality) list = list.filter((r) => r.modality === modality)
    if (operatorId) list = list.filter((r) => r.operatorId === operatorId)
    list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return HttpResponse.json({ success: true, data: list, meta: { total: list.length } })
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

  // [G005 Wave4A] G-24 三维度自动质控 (伪影/曝光/体位) — 与后端 image-ai.service.assess 确定性逻辑对齐
  http.post(`${API_BASE}/qc/image-ai/assess`, async ({ request }) => {
    await delay(delayMs())
    const body = (await request.json()) as { studyId: string; instanceId?: string; modality?: string; bodyPart?: string }
    const studyId = String(body.studyId ?? '')
    let h = 0
    const seed = `${studyId}:${body.instanceId ?? ''}`
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
    const rnd = (salt: number) => ((h >>> (salt % 28)) % 1000) / 1000
    const clamp = (v: number) => Math.max(55, Math.min(99, v))
    const dimLabel = (score: number) => (score >= 90 ? '优秀' : score >= 80 ? '良好' : score >= 70 ? '一般' : '较差')

    const modality = String(body.modality ?? (studyId.includes('MR') ? 'MR' : studyId.includes('DR') ? 'DR' : 'CT'))
    const bodyPart = String(body.bodyPart ?? '常规')
    const m = modality.toUpperCase()

    let artifactBase = 88
    if (m === 'MR') artifactBase = 80
    if (m === 'CT') artifactBase = 84
    if (m === 'DR' || m === 'CR') artifactBase = 86
    if (m === 'MG') artifactBase = 82

    let exposureBase = 90
    if (m === 'DR' || m === 'CR') exposureBase = 82
    if (m === 'MG') exposureBase = 85
    if (m === 'MR') exposureBase = 92

    let positioningBase = 88
    if (m === 'DR' || m === 'CR') positioningBase = 80
    if (m === 'MG') positioningBase = 78
    if (m === 'MR') positioningBase = 90
    if (['脊柱', '颈椎', '腰椎', 'SPINE'].some((k) => bodyPart.includes(k))) positioningBase -= 3

    const artifactScore = clamp(Math.round(artifactBase - rnd(3) * 14))
    const exposureScore = clamp(Math.round(exposureBase - rnd(7) * 12))
    const positioningScore = clamp(Math.round(positioningBase - rnd(11) * 14))
    const overall = clamp(Math.round(artifactScore * 0.35 + exposureScore * 0.3 + positioningScore * 0.35))

    const artifactIssues = artifactScore < 85 ? ['检测到轻微运动伪影，建议检查时固定患者体位'] : artifactScore < 75 ? ['局部金属/高密度伪影影响诊断区域'] : ['未见明显伪影']
    const exposureIssues = exposureScore < 85 ? ['曝光参数偏暗，软组织对比度不足'] : exposureScore < 75 ? ['曝光过度，存在过曝区域，建议降低 mAs'] : ['曝光参数正常']
    const positioningIssues = positioningScore < 85 ? ['体位轻度旋转，解剖对称性欠佳'] : positioningScore < 75 ? ['检查部位偏移，边缘组织未完全覆盖'] : ['体位摆位正确']

    const record: AssessRecord = {
      id: `assess-${++assessSeq}`,
      studyId,
      ...(body.instanceId ? { instanceId: body.instanceId } : {}),
      modality,
      bodyPart,
      assessedAt: new Date().toISOString(),
      artifact: { score: artifactScore, label: dimLabel(artifactScore), issues: artifactIssues },
      exposure: { score: exposureScore, label: dimLabel(exposureScore), issues: exposureIssues },
      positioning: { score: positioningScore, label: dimLabel(positioningScore), issues: positioningIssues },
      overall: { score: overall, label: dimLabel(overall) },
    }
    assessStore.set(studyId, record)

    return HttpResponse.json({
      success: true,
      data: record,
    }, { status: 201 })
  }),

  // [G005 Wave3A P16] 历史三维度评估列表 (按时间倒序, 支持 studyId 过滤 + 分页)
  http.get(`${API_BASE}/qc/image-ai/assessments`, async ({ request }) => {
    await delay(delayMs())
    const url = new URL(request.url)
    let list = Array.from(assessStore.values())
    const studyId = url.searchParams.get('studyId')
    if (studyId) list = list.filter((r) => r.studyId === studyId)
    list = [...list].sort((a, b) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime())
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get('pageSize') ?? 50)))
    return HttpResponse.json({ success: true, data: list.slice((page - 1) * pageSize, page * pageSize), meta: { total: list.length } })
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
