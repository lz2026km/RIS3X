// [G005 W3-BackendParity] 后端补齐端点的 MSW 前端 Parity handlers
//
// 背景: 前端调用的 36 条路由原本在 real 模式下 404。后端已补齐对应端点,
//       本文件把这些端点同步到 MSW (mock 模式), 注册于 handlers.ts 最前,
//       避免被既有参数/通配路由拦截。
//
// 覆盖 (与后端 controller 一一对应):
//   1. 口腔影像后处理 dental-imaging.controller
//      GET  /dental/studies/:id/dicom-paths | /segments | /mpr | /3d-model
//      POST /dental/studies/:id/segment
//      GET  /dental/cbct/:id/nerve-canal | /bone-density | /measure
//      GET  /dental/scan/:id/compare, POST /dental/scan/:id/align
//      GET  /dental/cad/milling-status/:id
//      GET  /dental/implant/abutments | /implant/inventory/price-check
//   2. 眼科 PACS eye.controller: key-images / lesion-segmentations / annotations /
//      measurements (POST/DELETE/export-sr)
//   3. AI 融合工作站 ai-fusion-workspace.controller
//   4. AI 诊断通用模型路由 ai-diagnosis.controller (:model/results*)
//   5. DICOMweb study/series 元数据 dicom-web.controller
//   6. 骨科影像分析 ortho-specialty.controller
//   7. RDSR 儿童剂量 rdsr.controller
//   8. 设备今日统计 /devices/stats/today (补充 totalDevices 字段)
//
// 注: /clinical-pathways/patients/:id/advance|exit 与 /radpath/records 已由
//     shellBatch3Handlers / radpathHandlers 有状态实现, 为保持 write-then-read
//     一致性, 此处不覆盖。
import { http, HttpResponse, delay } from 'msw'

const API_BASE = (() => {
  try { return window.location.origin + '/api/v1' } catch { return 'http://localhost/api/v1' }
})()

const nowIso = () => new Date().toISOString()

// ─────────────────────────────────────────────────────────────────────────
// 1) Dental imaging
// ─────────────────────────────────────────────────────────────────────────

const dentalSegments = new Map<string, Array<{ id: string; type: string; label: string; volume: number; color: string }>>()

function segmentsFor(id: string) {
  const existing = dentalSegments.get(id)
  if (existing) return existing
  const seed = [
    { id: `${id}-SEG-1`, type: 'bone', label: '下颌骨', volume: 18200, color: '#8fa3b8' },
    { id: `${id}-SEG-2`, type: 'teeth', label: '牙列', volume: 6400, color: '#e8c46a' },
    { id: `${id}-SEG-3`, type: 'nerve', label: '下牙槽神经管', volume: 320, color: '#38d9a9' },
  ]
  dentalSegments.set(id, seed)
  return seed
}

const ABUTMENTS = [
  { id: 'abt-001', brand: 'Straumann', type: 'titanium-straight', height: 4.0, angle: 0, price: 1280 },
  { id: 'abt-002', brand: 'Straumann', type: 'zirconia', height: 5.0, angle: 15, price: 2350 },
  { id: 'abt-003', brand: 'Nobel', type: 'titanium-angulated', height: 4.5, angle: 17, price: 1420 },
  { id: 'abt-004', brand: 'Dentsply', type: 'titanium-straight', height: 3.5, angle: 0, price: 1150 },
]

const IMPLANT_PRICES: Record<string, number> = {
  'ST-SL-3.3-10': 1980, 'ST-SL-4.1-10': 2180, 'NB-CC-3.5-11.5': 2450,
  'NB-CC-4.3-13': 2650, 'DP-ASTR-3.8-11': 1720, 'DP-ASTR-4.5-13': 1880,
}

const dentalImagingHandlers = [
  http.get(`${API_BASE}/dental/studies/:id/dicom-paths`, async ({ params }) => {
    await delay(30)
    return HttpResponse.json({ success: true, data: { series: [
      { path: `/pacs/dental/${String(params.id)}/series/1`, modality: 'CBCT', instanceCount: 320 },
      { path: `/pacs/dental/${String(params.id)}/series/2`, modality: 'SecondaryCapture', instanceCount: 1 },
    ] } })
  }),
  http.get(`${API_BASE}/dental/studies/:id/segments`, async ({ params }) => {
    await delay(30)
    return HttpResponse.json({ success: true, data: { segments: segmentsFor(String(params.id)) } })
  }),
  http.post(`${API_BASE}/dental/studies/:id/segment`, async ({ params, request }) => {
    await delay(120)
    const body = (await request.json().catch(() => ({}))) as { model?: string }
    const list = segmentsFor(String(params.id))
    const seg = { id: `seg-${Date.now()}`, type: body.model || 'tooth', label: '自动分割结果', volume: 100, color: '#52c41a' }
    list.push(seg)
    return HttpResponse.json({ success: true, data: seg }, { status: 201 })
  }),
  http.get(`${API_BASE}/dental/studies/:id/mpr`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: { axes: ['axial', 'sagittal', 'coronal'], sliceCount: 100, resolution: '512x512', format: 'DICOM' } })
  }),
  http.get(`${API_BASE}/dental/studies/:id/3d-model`, async ({ params }) => {
    await delay(60)
    return HttpResponse.json({ success: true, data: { modelUrl: `/api/v1/dental/studies/${String(params.id)}/3d-model.stl`, format: 'OBJ', triangleCount: 50000, size: '2.4 MB' } })
  }),
  http.get(`${API_BASE}/dental/cbct/:id/nerve-canal`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: {
      lowerAlveolarNerve: { path: [[100, 200, 50], [105, 210, 55], [110, 220, 60]], diameter: 3.2, safeDistance: 8.5 },
      mentalForamen: { left: { x: 45, y: 180, z: 30 }, right: { x: 155, y: 180, z: 30 } },
    } })
  }),
  http.get(`${API_BASE}/dental/cbct/:id/bone-density`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: { regions: [
      { region: '下颌前牙区', density: 850, unit: 'HU' },
      { region: '下颌后牙区', density: 1100, unit: 'HU' },
      { region: '上颌前牙区', density: 720, unit: 'HU' },
      { region: '上颌后牙区', density: 480, unit: 'HU' },
      { region: '颏部', density: 1450, unit: 'HU' },
    ] } })
  }),
  http.get(`${API_BASE}/dental/cbct/:id/measure`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: { measurements: [
      { id: 'meas-1', type: 'distance', label: '缺牙区骨高度', value: 12.5, unit: 'mm' },
      { id: 'meas-2', type: 'distance', label: '下牙槽神经管距牙槽嵴', value: 15.2, unit: 'mm' },
      { id: 'meas-3', type: 'angle', label: '下颌平面角', value: 28.5, unit: '°' },
    ] } })
  }),
  http.get(`${API_BASE}/dental/scan/:id/compare`, async () => {
    await delay(50)
    return HttpResponse.json({ success: true, data: { differences: { volume: 0.12, surfaceArea: 0.05, toothMovement: [] } } })
  }),
  http.post(`${API_BASE}/dental/scan/:id/align`, async ({ params, request }) => {
    await delay(80)
    const body = (await request.json().catch(() => ({}))) as { targetScanId?: string }
    return HttpResponse.json({ success: true, data: { aligned: true, sourceScanId: String(params.id), targetScanId: body.targetScanId ?? null, rmsError: 0.08, alignedAt: nowIso() } })
  }),
  http.get(`${API_BASE}/dental/cad/milling-status/:id`, async ({ params }) => {
    await delay(20)
    return HttpResponse.json({ success: true, data: { id: String(params.id), status: 'in-progress', progress: 65, estimatedRemaining: '5min', errors: [] } })
  }),
  http.get(`${API_BASE}/dental/implant/abutments`, async ({ request }) => {
    await delay(20)
    const brand = new URL(request.url).searchParams.get('brand')
    return HttpResponse.json({ success: true, data: ABUTMENTS.filter((a) => !brand || a.brand === brand) })
  }),
  http.get(`${API_BASE}/dental/implant/inventory/price-check`, async ({ request }) => {
    await delay(30)
    const url = new URL(request.url)
    const brand = url.searchParams.get('brand')
    const models = (url.searchParams.get('models') ?? '').split(',').filter(Boolean)
    return HttpResponse.json({ success: true, data: models.map((modelId) => ({ modelId, brand: brand ?? null, price: IMPLANT_PRICES[modelId] ?? 1500 })) })
  }),
]

// ─────────────────────────────────────────────────────────────────────────
// 2) Eye PACS
// ─────────────────────────────────────────────────────────────────────────

let eyeMeasurementSeq = 1
const eyeMeasurements: any[] = [
  { id: 'M-2001', studyId: 'ES-1001', patientName: '李慧敏', measurementType: 'RNFL 厚度', value: 82.4, unit: 'μm', description: '', coordinates: [], createdAt: '2026-07-02T09:45:00.000Z' },
]

const eyeKeyImages = [
  { id: 'KI-1001', studyId: 'ES-1001', reason: '糖尿病视网膜病变出血点', flaggedBy: '张明远', flaggedAt: '2026-07-02T10:05:00.000Z' },
  { id: 'KI-1002', studyId: 'ES-1003', reason: '黄斑囊样水肿', flaggedBy: '李慧敏', flaggedAt: '2026-06-30T15:20:00.000Z' },
]

const eyeLesionSegmentations = [
  { id: 'LS-1001', studyId: 'ES-1003', type: 'macularEdema', area: 3.2, distanceFromFovea: 0.4, quadrant: 'temporal', confidence: 0.95 },
  { id: 'LS-1002', studyId: 'ES-1001', type: 'microaneurysm', area: 0.08, distanceFromFovea: 1.8, quadrant: 'superior', confidence: 0.82 },
]

const eyeAnnotations = [
  { id: 'AN-1001', studyId: 'ES-1001', x: 512, y: 480, label: '视网膜出血', createdBy: '张明远' },
]

const eyePacsHandlers = [
  http.get(`${API_BASE}/eye/pacs/key-images`, async ({ request }) => {
    await delay(30)
    const studyId = new URL(request.url).searchParams.get('studyId')
    return HttpResponse.json({ success: true, data: studyId ? eyeKeyImages.filter((k) => k.studyId === studyId) : eyeKeyImages })
  }),
  http.get(`${API_BASE}/eye/pacs/lesion-segmentations`, async ({ request }) => {
    await delay(30)
    const studyId = new URL(request.url).searchParams.get('studyId')
    return HttpResponse.json({ success: true, data: studyId ? eyeLesionSegmentations.filter((s) => s.studyId === studyId) : eyeLesionSegmentations })
  }),
  http.get(`${API_BASE}/eye/pacs/annotations`, async ({ request }) => {
    await delay(30)
    const studyId = new URL(request.url).searchParams.get('studyId')
    return HttpResponse.json({ success: true, data: studyId ? eyeAnnotations.filter((a) => a.studyId === studyId) : eyeAnnotations })
  }),
  http.get(`${API_BASE}/eye/pacs/measurements`, async ({ request }) => {
    await delay(30)
    const studyId = new URL(request.url).searchParams.get('studyId')
    return HttpResponse.json({ success: true, data: studyId ? eyeMeasurements.filter((m) => m.studyId === studyId) : eyeMeasurements })
  }),
  http.post(`${API_BASE}/eye/pacs/measurements`, async ({ request }) => {
    await delay(50)
    const body = (await request.json().catch(() => ({}))) as Record<string, any>
    const item = {
      id: body.id || `MS${Date.now().toString(36)}${eyeMeasurementSeq++}`,
      studyId: body.studyId ?? '',
      patientName: body.patientName ?? '',
      measurementType: body.measurementType ?? body.type ?? '测量',
      value: Number(body.value ?? 0),
      unit: body.unit ?? '',
      description: body.description ?? '',
      coordinates: Array.isArray(body.coordinates) ? body.coordinates : [],
      createdAt: nowIso(),
    }
    eyeMeasurements.unshift(item)
    return HttpResponse.json({ success: true, data: item }, { status: 201 })
  }),
  http.delete(`${API_BASE}/eye/pacs/measurements/:id`, async ({ params }) => {
    const idx = eyeMeasurements.findIndex((m) => m.id === String(params.id))
    if (idx < 0) return new HttpResponse(null, { status: 404 })
    eyeMeasurements.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),
  http.post(`${API_BASE}/eye/pacs/measurements/export-sr`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ ok: true, studyUid: body.studyUid ?? '1.2.3', objectUrl: '/api/v1/eye/pacs/measurements/export-sr/result.dcm', createdAt: nowIso() })
  }),
]

// ─────────────────────────────────────────────────────────────────────────
// 3) AI Fusion Workspace
// ─────────────────────────────────────────────────────────────────────────

const FUSION_STUDIES = [
  { id: 'FS-001', patient: '张伟', modalities: 'CT+PET', fusionScore: 0.88, findings: 3, aiAlerts: 1, status: 'complete', date: '2026-07-15' },
  { id: 'FS-002', patient: '李娜', modalities: 'MR+CT', fusionScore: 0.92, findings: 5, aiAlerts: 2, status: 'complete', date: '2026-07-14' },
  { id: 'FS-003', patient: '王强', modalities: 'CBCT+OPG', fusionScore: 0.81, findings: 2, aiAlerts: 0, status: 'pending', date: '2026-07-13' },
  { id: 'FS-004', patient: '赵敏', modalities: 'SPECT+CT', fusionScore: 0.86, findings: 4, aiAlerts: 1, status: 'complete', date: '2026-07-12' },
]

const FUSION_INSIGHTS = [
  { id: 'AI-001', type: 'lesion', finding: '右肺上叶结节 (融合 SUVmax 4.2)', confidence: 0.91, modality: 'CT+PET', source: 'lung-cad', actionable: true },
  { id: 'AI-002', type: 'vessel', finding: '左前降支近段狭窄 65%', confidence: 0.87, modality: 'CT', source: 'cardiac-ai', actionable: true },
  { id: 'AI-003', type: 'measurement', finding: '病灶体积 4.8 cm³', confidence: 0.83, modality: 'MR+CT', source: 'radiomics', actionable: false },
  { id: 'AI-004', type: 'classification', finding: '肝右叶病灶倾向恶性 (LR-5)', confidence: 0.79, modality: 'MR', source: 'fusion-v2', actionable: true },
]

const aiFusionWorkspaceHandlers = [
  http.get(`${API_BASE}/ai/fusion-workspace/studies`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: FUSION_STUDIES })
  }),
  http.get(`${API_BASE}/ai/fusion-workspace/insights`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: FUSION_INSIGHTS })
  }),
  http.get(`${API_BASE}/ai/fusion-workspace`, async ({ request }) => {
    await delay(40)
    const modality = new URL(request.url).searchParams.get('modality')?.toUpperCase()
    const studies = modality ? FUSION_STUDIES.filter((s) => s.modalities.toUpperCase().includes(modality)) : FUSION_STUDIES
    return HttpResponse.json({ success: true, data: { studies, aiInsights: FUSION_INSIGHTS } })
  }),
  http.post(`${API_BASE}/ai/fusion-workspace/run`, async ({ request }) => {
    await delay(120)
    const body = (await request.json().catch(() => ({}))) as { studyId?: string }
    const source = FUSION_STUDIES.find((s) => s.id === body.studyId) ?? FUSION_STUDIES[0]!
    return HttpResponse.json({ success: true, data: {
      id: `FS-${Date.now()}`, patient: source.patient, modalities: source.modalities,
      fusionScore: Math.min(0.99, Math.round((source.fusionScore + 0.05) * 100) / 100),
      findings: source.findings + 1, aiAlerts: source.aiAlerts, status: 'complete', date: nowIso().slice(0, 10),
    } }, { status: 201 })
  }),
]

// ─────────────────────────────────────────────────────────────────────────
// 4) AI Diagnosis generic model routes (仅支持 4 模型, 其他 400)
// ─────────────────────────────────────────────────────────────────────────

const AI_MODELS = ['lung-cad', 'breast-cad', 'fracture-cad', 'cardiac-ai']

const aiResult = (id: string, model: string, patientName: string, modality: string, status: string) => ({
  id: `RES-${model}-${id}`,
  studyId: `EX00${id}`,
  patientName,
  modality,
  status,
  modelVersion: `${model}-v1.0`,
  createdAt: nowIso(),
  model,
})

const aiDiagnosisGenericHandlers = [
  http.get(`${API_BASE}/ai-diagnosis/:model/results`, ({ params }) => {
    const model = String(params.model)
    if (!AI_MODELS.includes(model)) return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: `不支持的 AI 模型: ${model}` } }, { status: 400 })
    return HttpResponse.json({ success: true, data: [
      aiResult('1', model, '张伟', 'CT', 'auto'),
      aiResult('2', model, '李娜', 'MR', 'reviewed'),
      aiResult('3', model, '王强', 'CT', 'confirmed'),
    ] })
  }),
  http.get(`${API_BASE}/ai-diagnosis/:model/results/:id`, ({ params }) => {
    const model = String(params.model)
    if (!AI_MODELS.includes(model)) return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: `不支持的 AI 模型: ${model}` } }, { status: 400 })
    return HttpResponse.json({ success: true, data: aiResult(String(params.id), model, '张伟', 'CT', 'auto') })
  }),
  http.post(`${API_BASE}/ai-diagnosis/:model/results/:id/review`, async ({ params, request }) => {
    const model = String(params.model)
    if (!AI_MODELS.includes(model)) return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: `不支持的 AI 模型: ${model}` } }, { status: 400 })
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ success: true, data: { ...aiResult(String(params.id), model, '张伟', 'CT', String(body.status ?? 'confirmed')), comment: body.comment ?? null } })
  }),
]

// ─────────────────────────────────────────────────────────────────────────
// 5) DICOMweb study/series JSON metadata
// ─────────────────────────────────────────────────────────────────────────

const dicomWebParityHandlers = [
  http.get(`${API_BASE}/dicom-web/studies/:study/series/:series`, ({ params }) => HttpResponse.json({
    '0020000E': { vr: 'UI', Value: [String(params.series)] },
    '00080060': { vr: 'CS', Value: ['CT'] },
    '00201209': { vr: 'IS', Value: [1] },
    '00201208': { vr: 'IS', Value: [1] },
  })),
  http.get(`${API_BASE}/dicom-web/studies/:study`, ({ params }) => HttpResponse.json({
    '0020000D': { vr: 'UI', Value: [String(params.study)] },
    '00100010': { vr: 'PN', Value: [{ Alphabetic: 'ZHANG^WEI' }] },
    '00080061': { vr: 'CS', Value: ['CT'] },
    '00201206': { vr: 'IS', Value: [1] },
  })),
]

// ─────────────────────────────────────────────────────────────────────────
// 6) Ortho specialty
// ─────────────────────────────────────────────────────────────────────────

const ORTHO_STUDIES = [
  { id: 'OX001', name: '张伟', age: 65, gender: 'M', joint: 'knee', modality: 'XR', klGrade: 'III', oaScore: 7.5, fracture: false, date: '2026-07-15' },
  { id: 'OX002', name: '李芳', age: 52, gender: 'F', joint: 'hip', modality: 'XR', klGrade: 'II', oaScore: 4.2, fracture: false, date: '2026-07-14' },
  { id: 'OX003', name: '王明', age: 70, gender: 'M', joint: 'lumbar', modality: 'MRI', klGrade: 'IV', oaScore: 9.1, fracture: true, date: '2026-07-13' },
  { id: 'OX004', name: '赵丽', age: 34, gender: 'F', joint: 'knee', modality: 'MRI', klGrade: '0', oaScore: 0, fracture: false, date: '2026-07-12' },
  { id: 'OX005', name: '陈浩', age: 58, gender: 'M', joint: 'shoulder', modality: 'CT', klGrade: 'I', oaScore: 2.0, fracture: true, date: '2026-07-11' },
]

const orthoSpecialtyHandlers = [
  http.get(`${API_BASE}/ortho-specialty/studies`, async () => {
    await delay(60)
    return HttpResponse.json({ success: true, data: ORTHO_STUDIES })
  }),
  http.post(`${API_BASE}/ortho-specialty/studies`, async ({ request }) => {
    await delay(80)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ success: true, data: { id: `OX${String(ORTHO_STUDIES.length + 1).padStart(3, '0')}`, ...body } }, { status: 201 })
  }),
]

// ─────────────────────────────────────────────────────────────────────────
// 7) RDSR pediatric
// ─────────────────────────────────────────────────────────────────────────

const PEDIATRIC_DOSE = [
  { id: 'P001', patientId: 'RAD-P010', patientName: '患者F', age: 8, ageGroup: '5-10岁', gender: '女', examDate: '2026-05-01', modality: 'CT', examItem: '头部CT', doseValue: 420, doseUnit: 'mGy·cm', doseReductionFactor: 0.6, alertLevel: 'normal', device: 'CT-1' },
  { id: 'P002', patientId: 'RAD-P011', patientName: '患者G', age: 5, ageGroup: '0-5岁', gender: '男', examDate: '2026-05-01', modality: 'CT', examItem: '胸部CT', doseValue: 280, doseUnit: 'mGy·cm', doseReductionFactor: 0.4, alertLevel: 'normal', device: 'CT-2' },
  { id: 'P003', patientId: 'RAD-P015', patientName: '患者H', age: 12, ageGroup: '10-15岁', gender: '女', examDate: '2026-04-30', modality: 'CT', examItem: '腹部CT', doseValue: 320, doseUnit: 'mGy·cm', doseReductionFactor: 0.7, alertLevel: 'normal', device: 'CT-1' },
  { id: 'P004', patientId: 'RAD-P025', patientName: '患者I', age: 3, ageGroup: '0-5岁', gender: '男', examDate: '2026-04-30', modality: 'CT', examItem: '腹部CT', doseValue: 350, doseUnit: 'mGy·cm', doseReductionFactor: 0.4, alertLevel: 'normal', device: 'CT-2' },
  { id: 'P005', patientId: 'RAD-P026', patientName: '患者J', age: 7, ageGroup: '5-10岁', gender: '女', examDate: '2026-04-29', modality: 'CT', examItem: '头部CT', doseValue: 480, doseUnit: 'mGy·cm', doseReductionFactor: 0.6, alertLevel: 'warning', device: 'CT-1' },
  { id: 'P006', patientId: 'RAD-P027', patientName: '患者K', age: 14, ageGroup: '10-15岁', gender: '男', examDate: '2026-04-29', modality: 'CT', examItem: '胸部CT', doseValue: 380, doseUnit: 'mGy·cm', doseReductionFactor: 0.7, alertLevel: 'normal', device: 'CT-2' },
]

const rdsrParityHandlers = [
  http.get(`${API_BASE}/rdsr/pediatric`, async () => {
    await delay(60)
    return HttpResponse.json({ success: true, data: PEDIATRIC_DOSE })
  }),
]

// ─────────────────────────────────────────────────────────────────────────
// 8) Devices today stats (含 totalDevices, 兼容既有 total 断言)
// ─────────────────────────────────────────────────────────────────────────

const deviceStatsHandlers = [
  http.get(`${API_BASE}/devices/stats/today`, async () => {
    await delay(40)
    const totalDevices = 12
    return HttpResponse.json({ success: true, data: { totalDevices, total: totalDevices, inUse: 5, idle: 4, maintenance: 2 } })
  }),
]

export const w3BackendParityHandlers = [
  ...dentalImagingHandlers,
  ...eyePacsHandlers,
  ...aiFusionWorkspaceHandlers,
  ...aiDiagnosisGenericHandlers,
  ...dicomWebParityHandlers,
  ...orthoSpecialtyHandlers,
  ...rdsrParityHandlers,
  ...deviceStatsHandlers,
]
