// [G005 W7-Exec] 检查执行专业深化 MSW handlers — 对齐 backend dicom-dimse MWL SCP / MPPS 关联 / 协议 / 序列 QC / 剂量回写
// 页面: /tech/workbench (执行 Tab) / /worklist 详情 / /tech/mwl (MWL 管理)
// 全部确定性内存数据 (DB-less-safe), 无随机延迟。
import { http, HttpResponse } from 'msw'

const API = '/api/v1'

const pad = (n: number, len = 2) => String(n).padStart(len, '0')
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const dayAt = (offset: number, hour: number, minute: number) => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offset)
  d.setHours(hour, minute, 0, 0)
  return d
}

interface ExposureParams { kVp?: number; mAs?: number; aec?: boolean; rotationTime?: number; pitch?: number; thickness?: number; reconstruction?: string }
interface ProtocolRecord {
  id: string
  code: string
  name: string
  modality: string
  bodyPart: string
  description?: string
  contrast: boolean
  seriesCount: number
  expectedImages: number
  exposureParams: ExposureParams
  scanRange?: Record<string, unknown>
  contrastProtocolId?: string
  source: string
  createdAt: string
  updatedAt: string
}

const nowIso = () => new Date().toISOString()

const PROTOCOLS: ProtocolRecord[] = [
  { id: 'PRT-0001', code: 'CT_CHEST_ENH', name: '胸部 CT 增强', modality: 'CT', bodyPart: 'CHEST', description: '胸部增强三期扫描', contrast: true, seriesCount: 2, expectedImages: 180, exposureParams: { kVp: 120, mAs: 210, aec: true, rotationTime: 0.5, pitch: 1.2, thickness: 1.25 }, scanRange: { from: 1, to: 60, length: 300, orientation: 'axial' }, contrastProtocolId: 'CP-IOHEXOL-350', source: 'seed', createdAt: nowIso(), updatedAt: nowIso() },
  { id: 'PRT-0002', code: 'CT_ABDOMEN_3PHASE', name: '腹部 CT 三期增强', modality: 'CT', bodyPart: 'ABDOMEN', description: '平扫+动脉+门脉期', contrast: true, seriesCount: 3, expectedImages: 260, exposureParams: { kVp: 120, mAs: 240, aec: true, rotationTime: 0.5, pitch: 1.0, thickness: 1.25 }, scanRange: { from: 40, to: 110, length: 350, orientation: 'axial' }, contrastProtocolId: 'CP-IODIXANOL-320', source: 'seed', createdAt: nowIso(), updatedAt: nowIso() },
  { id: 'PRT-0003', code: 'CT_HEAD_PLAIN', name: '颅脑 CT 平扫', modality: 'CT', bodyPart: 'HEAD', description: '颅脑平扫', contrast: false, seriesCount: 1, expectedImages: 40, exposureParams: { kVp: 120, mAs: 180, aec: true, rotationTime: 0.5, pitch: 1.0, thickness: 5 }, scanRange: { from: 5, to: 35, length: 160, orientation: 'axial' }, source: 'seed', createdAt: nowIso(), updatedAt: nowIso() },
  { id: 'PRT-0004', code: 'MR_BRAIN_PLAIN', name: '颅脑 MR 平扫', modality: 'MR', bodyPart: 'BRAIN', description: 'T1/T2/DWI/FLAIR', contrast: false, seriesCount: 4, expectedImages: 96, exposureParams: { thickness: 5, reconstruction: 'T2-FLAIR' }, scanRange: { orientation: 'axial' }, source: 'seed', createdAt: nowIso(), updatedAt: nowIso() },
  { id: 'PRT-0005', code: 'MR_SPINE_ENH', name: '腰椎 MR 增强', modality: 'MR', bodyPart: 'SPINE', description: '腰椎增强', contrast: true, seriesCount: 3, expectedImages: 72, exposureParams: { thickness: 4, reconstruction: 'T1-SPACE' }, scanRange: { orientation: 'sagittal' }, contrastProtocolId: 'CP-GADOBUTROL', source: 'seed', createdAt: nowIso(), updatedAt: nowIso() },
  { id: 'PRT-0006', code: 'DR_CHEST_PA_LAT', name: '胸部正侧位 DR', modality: 'DR', bodyPart: 'CHEST', description: '正侧位', contrast: false, seriesCount: 2, expectedImages: 2, exposureParams: { kVp: 125, mAs: 3.2, aec: true }, scanRange: { orientation: 'PA/LAT' }, source: 'seed', createdAt: nowIso(), updatedAt: nowIso() },
  { id: 'PRT-0007', code: 'MG_BILATERAL', name: '乳腺钼靶双体位', modality: 'MG', bodyPart: 'BREAST', description: 'CC+MLO 双体位', contrast: false, seriesCount: 4, expectedImages: 4, exposureParams: { kVp: 30, mAs: 45, aec: true }, scanRange: { orientation: 'CC/MLO' }, source: 'seed', createdAt: nowIso(), updatedAt: nowIso() },
]
let protocolSeq = PROTOCOLS.length

interface SeriesRecord { id: string; examId: string; seriesNumber: number; seriesInstanceUid: string; description: string; modality: string; imageCount: number; acquiredAt: string; exposureParams?: ExposureParams; source: string }
interface SeriesQcRecord { id: string; examId: string; seriesNumber: number; quality: 'PASS' | 'REJECT'; reason?: string; score?: number; scoredBy?: string; scoredAt: string; retakeCount: number; source: string }
interface DoseRecord { id: string; examId: string; studyUid: string; modality: string; bodyPart: string; ctdiVol: number; dlp: number; ssde?: number; source: string; recordedAt: string; updatedAt: string }
interface ExecState { protocolId?: string; seriesCount?: number; expectedImages?: number; exposureParams?: ExposureParams; scanRange?: Record<string, unknown>; contrastProtocolId?: string; updatedAt?: string }

const examExecStates = new Map<string, ExecState>()
const examSeries = new Map<string, SeriesRecord[]>()
const examSeriesQc = new Map<string, SeriesQcRecord[]>()
const examDoses = new Map<string, DoseRecord>()
const mppsStore = new Map<string, Record<string, unknown>>()
let seriesSeq = 0
let qcSeq = 0

const findProtocol = (id?: string) => PROTOCOLS.find((p) => p.id === id)

const defaultSeries = (examId: string): SeriesRecord[] => {
  const state = examExecStates.get(examId)
  const expectedImages = state?.expectedImages ?? 180
  const first = Math.round(expectedImages * 0.55)
  const second = Math.max(0, expectedImages - first)
  return [
    { id: `SER-${pad(++seriesSeq, 5)}`, examId, seriesNumber: 1, seriesInstanceUid: `1.2.840.10008.${examId}.series.1`, description: '平扫/定位', modality: 'CT', imageCount: first, acquiredAt: nowIso(), source: 'memory' },
    { id: `SER-${pad(++seriesSeq, 5)}`, examId, seriesNumber: 2, seriesInstanceUid: `1.2.840.10008.${examId}.series.2`, description: '增强/薄层', modality: 'CT', imageCount: second, acquiredAt: nowIso(), source: 'memory' },
  ]
}

const ensureState = (examId: string): ExecState => {
  let state = examExecStates.get(examId)
  if (!state) {
    const protocol = PROTOCOLS[0]!
    state = {
      protocolId: protocol.id,
      seriesCount: protocol.seriesCount,
      expectedImages: protocol.expectedImages,
      exposureParams: protocol.exposureParams,
      scanRange: protocol.scanRange,
      contrastProtocolId: protocol.contrastProtocolId,
      updatedAt: nowIso(),
    }
    examExecStates.set(examId, state)
  }
  let series = examSeries.get(examId)
  if (!series) {
    series = defaultSeries(examId)
    examSeries.set(examId, series)
  }
  return state
}

const buildValidation = (examId: string) => {
  const state = examExecStates.get(examId)
  const series = examSeries.get(examId) ?? []
  const expectedImages = state?.expectedImages ?? 0
  const expectedSeries = state?.seriesCount ?? 0
  const capturedImages = series.reduce((s, x) => s + (x.imageCount ?? 0), 0)
  const capturedSeries = series.length
  const imageCountMismatch = expectedImages > 0 && capturedImages !== expectedImages
  const matches = expectedImages > 0 && capturedImages === expectedImages
  const message = imageCountMismatch
    ? `图像数不一致: 期望 ${expectedImages}, 实际 ${capturedImages} (差异 ${capturedImages - expectedImages})`
    : expectedImages === 0 && capturedImages === 0
      ? '未配置协议/未采集序列'
      : '协议期望值与已采集序列一致'
  return { expectedImages, capturedImages, capturedSeries, expectedSeries, matches, imageCountMismatch, delta: capturedImages - expectedImages, message }
}

const buildExecution = (examId: string) => {
  ensureState(examId)
  const state = examExecStates.get(examId)
  const series = [...(examSeries.get(examId) ?? [])].sort((a, b) => a.seriesNumber - b.seriesNumber)
  const seriesQc = [...(examSeriesQc.get(examId) ?? [])].sort((a, b) => String(b.scoredAt).localeCompare(String(a.scoredAt)))
  const rejected = seriesQc.filter((q) => q.quality === 'REJECT').length
  return {
    examId,
    accessionNumber: undefined,
    protocol: findProtocol(state?.protocolId) ?? null,
    state: { examId, ...state, source: 'memory' },
    series,
    validation: buildValidation(examId),
    seriesQc,
    qcSummary: { total: seriesQc.length, passed: seriesQc.length - rejected, rejected },
    dose: examDoses.get(examId) ?? null,
    retakeCount: seriesQc.some((q) => q.quality === 'REJECT') ? 1 : 0,
  }
}

// ---- MWL seeds (derived from Exam/Appointment seed shape) ----
const MWL_SEED = [
  { accession: 'AC-EXEC-001', patientName: '张明远', patientId: 'P000001', modality: 'CT', bodyPart: 'CHEST', station: 'CT_SCANNER_01', offset: 0, hour: 9, minute: 0, contrast: true, contrastAgent: 'Iohexol 350', priority: 'ROUTINE', state: 'SCHEDULED', procedure: '胸部 CT 增强' },
  { accession: 'AC-EXEC-002', patientName: '李静', patientId: 'P000002', modality: 'MR', bodyPart: 'BRAIN', station: 'MR_SCANNER_02', offset: 0, hour: 10, minute: 15, contrast: false, priority: 'ROUTINE', state: 'ARRIVED', procedure: '颅脑 MR 平扫' },
  { accession: 'AC-EXEC-003', patientName: '王建国', patientId: 'P000003', modality: 'CT', bodyPart: 'ABDOMEN', station: 'CT_SCANNER_01', offset: 0, hour: 11, minute: 0, contrast: true, contrastAgent: 'Iodixanol 320', priority: 'URGENT', state: 'IN_PROGRESS', procedure: '腹部 CT 三期增强' },
  { accession: 'AC-EXEC-004', patientName: '赵敏', patientId: 'P000004', modality: 'DR', bodyPart: 'CHEST', station: 'DR_ROOM_01', offset: 0, hour: 13, minute: 30, contrast: false, priority: 'ROUTINE', state: 'SCHEDULED', procedure: '胸部正侧位 DR' },
  { accession: 'AC-EXEC-005', patientName: '陈晓东', patientId: 'P000005', modality: 'US', bodyPart: 'ABDOMEN', station: 'US_UNIT_01', offset: 0, hour: 14, minute: 0, contrast: false, priority: 'ROUTINE', state: 'SCHEDULED', procedure: '腹部超声' },
  { accession: 'AC-EXEC-006', patientName: '刘芳', patientId: 'P000006', modality: 'MG', bodyPart: 'BREAST', station: 'MG_UNIT_01', offset: 0, hour: 15, minute: 0, contrast: false, priority: 'ROUTINE', state: 'SCHEDULED', procedure: '乳腺钼靶双体位' },
  { accession: 'AC-EXEC-007', patientName: '孙伟', patientId: 'P000007', modality: 'CT', bodyPart: 'HEAD', station: 'CT_SCANNER_01', offset: 1, hour: 8, minute: 30, contrast: false, priority: 'STAT', state: 'SCHEDULED', procedure: '颅脑 CT 平扫' },
  { accession: 'AC-EXEC-008', patientName: '周婷', patientId: 'P000008', modality: 'MR', bodyPart: 'SPINE', station: 'MR_SCANNER_02', offset: 1, hour: 9, minute: 45, contrast: true, contrastAgent: 'Gadobutrol', priority: 'ROUTINE', state: 'SCHEDULED', procedure: '腰椎 MR 增强' },
].map((r, index) => {
  const dt = dayAt(r.offset, r.hour, r.minute)
  return {
    id: `MWL-${pad(index + 1, 4)}`,
    accessionNumber: r.accession,
    patientName: r.patientName,
    patientId: r.patientId,
    modality: r.modality,
    bodyPart: r.bodyPart,
    studyInstanceUid: `1.2.840.114350.1.1.${dateKey(dt).replace(/-/g, '')}.${pad(index + 1, 3)}`,
    seriesInstanceUid: `1.2.840.114350.1.1.${dateKey(dt).replace(/-/g, '')}.${pad(index + 1, 3)}.1`,
    requestedProcedureId: `RP-${r.accession}`,
    requestedProcedureDescription: r.procedure,
    scheduledStationAeTitle: r.station,
    scheduledDate: dateKey(dt),
    scheduledTime: `${pad(r.hour)}:${pad(r.minute)}:00`,
    contrast: r.contrast,
    contrastAgent: r.contrastAgent,
    priority: r.priority,
    state: r.state,
    mppsStatus: (mppsStore.get(r.accession) as { status?: string } | undefined)?.status,
    source: 'seed',
  }
})

const listWorklistItems = (query: Record<string, string | undefined>) => {
  let items = MWL_SEED
  if (query.modality) items = items.filter((i) => i.modality === query.modality)
  if (query.patientName) items = items.filter((i) => i.patientName.includes(query.patientName!))
  if (query.patientId) items = items.filter((i) => i.patientId === query.patientId)
  if (query.accessionNumber) items = items.filter((i) => i.accessionNumber === query.accessionNumber)
  if (query.stationAE) items = items.filter((i) => i.scheduledStationAeTitle === query.stationAE)
  if (query.date) items = items.filter((i) => i.scheduledDate === query.date)
  if (query.dateFrom) items = items.filter((i) => i.scheduledDate >= query.dateFrom!)
  if (query.dateTo) items = items.filter((i) => i.scheduledDate <= query.dateTo!)
  const states = new Map<string, string>()
  for (const m of mppsStore.values()) {
    const acc = String(m.accessionNumber ?? '')
    if (acc) states.set(acc, String(m.status))
  }
  return items.map((i) => {
    const mppsStatus = states.get(i.accessionNumber) as 'IN_PROGRESS' | 'COMPLETED' | 'DISCONTINUED' | undefined
    return { ...i, mppsStatus, state: mppsStatus ?? i.state }
  })
}

export const w7ExecHandlers = [
  // ═══ MWL C-FIND SCP ═══
  http.get(`${API}/dicom-dimse/mwl/worklist-items`, ({ request }) => {
    const url = new URL(request.url)
    const q = Object.fromEntries(url.searchParams.entries()) as Record<string, string | undefined>
    const items = listWorklistItems(q)
    return HttpResponse.json({ success: true, data: { items, total: items.length, source: 'seed' } })
  }),

  http.post(`${API}/dicom-dimse/mwl/query`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, string | undefined>
    const items = listWorklistItems(body)
    const dataset = items.map((i) => ({
      patientName: i.patientName,
      patientId: i.patientId,
      accessionNumber: i.accessionNumber,
      modality: i.modality,
      bodyPartExamined: i.bodyPart,
      priority: i.priority,
      contrast: i.contrast,
      studyInstanceUid: i.studyInstanceUid,
      scheduledProcedureStepSequence: [
        {
          scheduledProcedureStepId: i.id,
          scheduledStationAeTitle: i.scheduledStationAeTitle,
          scheduledProcedureStepStartDate: i.scheduledDate.replace(/-/g, ''),
          scheduledProcedureStepStartTime: i.scheduledTime.replace(/:/g, ''),
          modality: i.modality,
          requestedProcedureId: i.requestedProcedureId,
          requestedProcedureDescription: i.requestedProcedureDescription,
        },
      ],
    }))
    return HttpResponse.json({
      success: true,
      data: { queryRetrieveLevel: 'WORKLIST', sopClassUid: '1.2.840.10008.5.1.4.31', matches: items.length, source: 'seed', items, dataset },
    })
  }),

  // ═══ MPPS accession (增强, 覆盖基础 dicomDimseHandlers) ═══
  http.post(`${API}/dicom-dimse/mpps`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const studyUid = String(body.studyUid ?? '')
    const existing = mppsStore.get(studyUid)
    const now = nowIso()
    const record = {
      studyUid,
      status: (body.status as string) ?? 'IN_PROGRESS',
      accessionNumber: body.accessionNumber ?? existing?.accessionNumber,
      requestedProcedureId: body.requestedProcedureId ?? existing?.requestedProcedureId,
      examId: body.examId ?? existing?.examId,
      patientName: existing?.patientName,
      patientId: existing?.patientId,
      modality: existing?.modality,
      startedAt: existing?.startedAt ?? now,
      completedAt: body.status === 'COMPLETED' || body.status === 'DISCONTINUED' ? now : existing?.completedAt,
      performedSteps: body.performedSteps ?? existing?.performedSteps ?? [],
      updatedAt: now,
      source: 'mpps',
    }
    mppsStore.set(studyUid, record)
    return HttpResponse.json({ success: true, data: record })
  }),

  http.get(`${API}/exam/:accessionNumber/mpps`, ({ params }) => {
    const accessionNumber = String(params.accessionNumber)
    const items = [...mppsStore.values()].filter((m) => {
      const acc = String(m.accessionNumber ?? '')
      return acc === accessionNumber || String(m.requestedProcedureId ?? '') === `RP-${accessionNumber}`
    })
    const mwlState = (() => {
      const fromMpps = items[0]?.status as string | undefined
      if (fromMpps === 'COMPLETED') return 'COMPLETED'
      if (fromMpps === 'IN_PROGRESS') return 'IN_PROGRESS'
      if (fromMpps === 'DISCONTINUED') return 'DISCONTINUED'
      const seed = MWL_SEED.find((i) => i.accessionNumber === accessionNumber)
      return seed?.state
    })()
    return HttpResponse.json({
      success: true,
      data: { accessionNumber, examId: (items[0]?.examId as string) ?? null, total: items.length, mwlState, items },
    })
  }),

  // ═══ 协议 ═══
  http.get(`${API}/protocols`, ({ request }) => {
    const url = new URL(request.url)
    const modality = url.searchParams.get('modality')
    const bodyPart = url.searchParams.get('bodyPart')
    let items = [...PROTOCOLS]
    if (modality) items = items.filter((p) => p.modality === modality)
    if (bodyPart) items = items.filter((p) => p.bodyPart === bodyPart)
    return HttpResponse.json({ success: true, data: { items, total: items.length } })
  }),

  http.post(`${API}/protocols`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const id = `PRT-${pad(++protocolSeq, 4)}`
    const record: ProtocolRecord = {
      id,
      code: String(body.code ?? `CUSTOM_${id}`),
      name: String(body.name ?? '自定义协议'),
      modality: String(body.modality ?? 'CT'),
      bodyPart: String(body.bodyPart ?? 'UNKNOWN'),
      description: body.description ? String(body.description) : undefined,
      contrast: body.contrast === true,
      seriesCount: Number(body.seriesCount ?? 1),
      expectedImages: Number(body.expectedImages ?? 1),
      exposureParams: (body.exposureParams as ExposureParams) ?? {},
      scanRange: (body.scanRange as Record<string, unknown>) ?? undefined,
      contrastProtocolId: body.contrastProtocolId ? String(body.contrastProtocolId) : undefined,
      source: 'memory',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    PROTOCOLS.push(record)
    return HttpResponse.json({ success: true, data: record })
  }),

  http.get(`${API}/protocols/:id`, ({ params }) => {
    const protocol = findProtocol(String(params.id))
    if (!protocol) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `Protocol ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: protocol })
  }),

  // ═══ 检查执行聚合 ═══
  http.get(`${API}/exam/:id/execution`, ({ params }) => HttpResponse.json({ success: true, data: buildExecution(String(params.id)) })),
  http.get(`${API}/exam/:id/protocol`, ({ params }) => HttpResponse.json({ success: true, data: buildExecution(String(params.id)) })),

  http.put(`${API}/exam/:id/protocol`, async ({ params, request }) => {
    const examId = String(params.id)
    ensureState(examId)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const current = examExecStates.get(examId)!
    const protocol = findProtocol(body.protocolId as string | undefined)
    const next: ExecState = {
      protocolId: (body.protocolId as string) ?? current.protocolId,
      seriesCount: Number(body.seriesCount ?? protocol?.seriesCount ?? current.seriesCount ?? 1),
      expectedImages: Number(body.expectedImages ?? protocol?.expectedImages ?? current.expectedImages ?? 1),
      exposureParams: (body.exposureParams as ExposureParams) ?? protocol?.exposureParams ?? current.exposureParams,
      scanRange: (body.scanRange as Record<string, unknown>) ?? protocol?.scanRange ?? current.scanRange,
      contrastProtocolId: (body.contrastProtocolId as string) ?? protocol?.contrastProtocolId ?? current.contrastProtocolId,
      updatedAt: nowIso(),
    }
    examExecStates.set(examId, next)
    return HttpResponse.json({ success: true, data: { examId, ...next, source: 'memory' } })
  }),

  // ═══ 序列 ═══
  http.get(`${API}/exam/:id/series`, ({ params }) => {
    const examId = String(params.id)
    ensureState(examId)
    const items = [...(examSeries.get(examId) ?? [])].sort((a, b) => a.seriesNumber - b.seriesNumber)
    return HttpResponse.json({ success: true, data: { items, total: items.length } })
  }),

  http.post(`${API}/exam/:id/series`, async ({ params, request }) => {
    const examId = String(params.id)
    ensureState(examId)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const record: SeriesRecord = {
      id: `SER-${pad(++seriesSeq, 5)}`,
      examId,
      seriesNumber: Number(body.seriesNumber ?? 1),
      seriesInstanceUid: String(body.seriesInstanceUid ?? `1.2.840.10008.${examId}.series.${body.seriesNumber ?? 1}`),
      description: String(body.description ?? `Series ${body.seriesNumber ?? 1}`),
      modality: String(body.modality ?? 'OT'),
      imageCount: Number(body.imageCount ?? 0),
      acquiredAt: String(body.acquiredAt ?? nowIso()),
      exposureParams: (body.exposureParams as ExposureParams) ?? undefined,
      source: 'memory',
    }
    const existing = examSeries.get(examId) ?? []
    examSeries.set(examId, existing.filter((s) => s.seriesNumber !== record.seriesNumber).concat(record))
    return HttpResponse.json({ success: true, data: record })
  }),

  // ═══ 序列级 QC ═══
  http.get(`${API}/exam/:id/series-qc`, ({ params }) => {
    const examId = String(params.id)
    const items = [...(examSeriesQc.get(examId) ?? [])].sort((a, b) => String(b.scoredAt).localeCompare(String(a.scoredAt)))
    return HttpResponse.json({ success: true, data: { items, total: items.length } })
  }),

  http.post(`${API}/exam/:id/series-qc`, async ({ params, request }) => {
    const examId = String(params.id)
    ensureState(examId)
    const body = (await request.json().catch(() => ({}))) as { items?: Array<{ seriesNumber: number; quality: 'PASS' | 'REJECT'; reason?: string; score?: number }>; scoredBy?: string }
    const scoredAt = nowIso()
    const rows = body.items ?? []
    const rejected = rows.filter((r) => r.quality === 'REJECT').length
    const records: SeriesQcRecord[] = rows.map((r) => ({
      id: `SQC-${pad(++qcSeq, 5)}`,
      examId,
      seriesNumber: r.seriesNumber,
      quality: r.quality,
      reason: r.reason,
      score: r.score,
      scoredBy: body.scoredBy,
      scoredAt,
      retakeCount: rejected > 0 ? 1 : 0,
      source: 'memory',
    }))
    examSeriesQc.set(examId, records.concat(examSeriesQc.get(examId) ?? []).slice(0, 500))
    return HttpResponse.json({
      success: true,
      data: { records, retakeTriggered: rejected > 0, retakeCount: rejected > 0 ? 1 : 0, validation: buildValidation(examId) },
    })
  }),

  // ═══ 剂量回写 ═══
  http.get(`${API}/exam/:id/dose`, ({ params }) => HttpResponse.json({ success: true, data: examDoses.get(String(params.id)) ?? null })),

  http.post(`${API}/exam/:id/dose`, async ({ params, request }) => {
    const examId = String(params.id)
    const body = (await request.json().catch(() => ({}))) as Record<string, any>
    const rdsr = body.rdsr as Record<string, any> | undefined
    const record: DoseRecord = {
      id: `DOSE-${examId}`,
      examId,
      studyUid: String(body.studyUid ?? rdsr?.studyUid ?? `1.2.840.10008.${examId}`),
      modality: String(body.modality ?? 'CT'),
      bodyPart: String(body.bodyPart ?? rdsr?.bodyPart ?? 'CHEST'),
      ctdiVol: Number(body.ctdivol ?? body.ctdiVol ?? rdsr?.ctdivol ?? 0),
      dlp: Number(body.dlp ?? rdsr?.dlp ?? 0),
      ssde: body.ssde ?? rdsr?.ssde,
      source: String(body.source ?? (rdsr ? 'RDSR' : 'MANUAL')),
      recordedAt: nowIso(),
      updatedAt: nowIso(),
    }
    examDoses.set(examId, record)
    return HttpResponse.json({ success: true, data: record })
  }),
]
