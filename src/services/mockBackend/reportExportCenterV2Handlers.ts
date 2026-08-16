// [G005 Wave 7B v3.0.6.11-101] /api/v1/report-export-center-v2 MSW handlers
// 对齐后端 report-export-center-v2.module + reportExportCenterV2Api (导出任务中心: 创建/处理/取消/下载/统计)
// 响应形状: { success: true, data: <T> }
import { http, HttpResponse, delay } from 'msw'
// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')


const API = `${API_BASE}/report-export-center-v2`

type ExportFormatV2 = 'PDF' | 'DOCX' | 'HTML' | 'CSV' | 'DICOM_SR'
type ExportTaskStateV2 = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELED'

interface ReportRecord {
  id: string
  title: string
  patientName: string
  patientId: string
  examType: string
  examDate: string
  department: string
  reportDoctor: string
  content: string
}

interface ExportTask {
  id: string
  format: ExportFormatV2
  reportIds: string[]
  state: ExportTaskStateV2
  progress: number
  fileName?: string
  content?: string
  fileSize?: number
  mimeType?: string
  error?: string
  requestedBy: string
  requestedByRole: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

const REPORTS: ReportRecord[] = [
  { id: 'RPT-1001', title: '胸部 CT 平扫报告', patientName: '张建国', patientId: 'P1001', examType: '胸部 CT 平扫', examDate: '2026-07-20', department: '放射科', reportDoctor: '王医生', content: '【影像所见】右肺上叶见 8mm 磨玻璃结节。\n【诊断结论】右肺上叶磨玻璃结节, 建议 6 个月随访复查。' },
  { id: 'RPT-1002', title: '头颅 MRI 平扫报告', patientName: '李秀英', patientId: 'P1002', examType: '头颅 MRI 平扫', examDate: '2026-07-28', department: '放射科', reportDoctor: '李医生', content: '【影像所见】右侧基底节区见点状缺血灶。\n【诊断结论】腔隙性缺血灶。' },
  { id: 'RPT-1003', title: '腹部增强 CT 报告', patientName: '王德发', patientId: 'P1003', examType: '腹部增强 CT', examDate: '2026-08-02', department: '放射科', reportDoctor: '刘医生', content: '【影像所见】肝右叶见类圆形低密度灶约 12mm。\n【诊断结论】肝右叶囊肿可能性大。' },
  { id: 'RPT-1004', title: '头颅 CT 平扫报告(危急)', patientName: '赵丽华', patientId: 'P1004', examType: '头颅 CT 平扫', examDate: '2026-08-05', department: '急诊影像', reportDoctor: '周医生', content: '【影像所见】左侧基底节区高密度影约 20ml。\n【诊断结论】脑出血, 危急。' },
  { id: 'RPT-1005', title: '胸部 DR 正位报告', patientName: '陈志强', patientId: 'P1005', examType: '胸部 DR 正位', examDate: '2026-08-09', department: '放射科', reportDoctor: '吴医生', content: '【影像所见】双肺纹理清晰。\n【诊断结论】未见明显异常。' },
]

let tasks: ExportTask[] = [
  {
    id: 'expt-001', format: 'PDF', reportIds: ['RPT-1001', 'RPT-1003'], state: 'COMPLETED', progress: 100,
    fileName: '放射报告_20260810.pdf', fileSize: 245760, mimeType: 'application/pdf',
    requestedBy: 'u-001', requestedByRole: 'DOCTOR',
    createdAt: '2026-08-10T09:00:00.000Z', updatedAt: '2026-08-10T09:00:05.000Z', completedAt: '2026-08-10T09:00:05.000Z',
  },
  {
    id: 'expt-002', format: 'DOCX', reportIds: ['RPT-1002'], state: 'PENDING', progress: 0,
    requestedBy: 'u-003', requestedByRole: 'DOCTOR',
    createdAt: '2026-08-15T14:20:00.000Z', updatedAt: '2026-08-15T14:20:00.000Z',
  },
]

let taskSeq = 100
let completedSeq = 0

const MIME: Record<ExportFormatV2, string> = {
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  HTML: 'text/html',
  CSV: 'text/csv',
  DICOM_SR: 'application/dicom+json',
}

function makeContent(format: ExportFormatV2, reports: ReportRecord[]): string {
  const title = (t: ReportRecord) => `${t.patientName} ${t.title}`
  switch (format) {
    case 'PDF': return `%PDF-1.4 概念导出: ${reports.map(title).join(' | ')}`
    case 'DOCX': return `[DOCX] 概念导出: ${reports.map(title).join(' | ')}`
    case 'HTML': return `<html><body>${reports.map((r) => `<h2>${title(r)}</h2><pre>${r.content}</pre>`).join('')}</body></html>`
    case 'CSV': return `patientName,title,examDate,reportDoctor\n${reports.map((r) => `${r.patientName},${r.title},${r.examDate},${r.reportDoctor}`).join('\n')}`
    case 'DICOM_SR': return JSON.stringify({ modality: 'SR', reports: reports.map((r) => ({ title: title(r), content: r.content })) })
  }
}

function createTask(format: ExportFormatV2, reportIds: string[], requestedBy: string, requestedByRole: string): ExportTask {
  const now = new Date().toISOString()
  return {
    id: `expt-${taskSeq++}`,
    format,
    reportIds,
    state: 'PENDING',
    progress: 0,
    requestedBy,
    requestedByRole,
    createdAt: now,
    updatedAt: now,
  }
}

export const reportExportCenterV2Handlers = [
  http.get(`${API}/reports`, async ({ request }) => {
    await delay(40)
    const url = new URL(request.url)
    const examType = url.searchParams.get('examType')
    const keyword = url.searchParams.get('keyword')
    let items = REPORTS
    if (examType) items = items.filter((r) => r.examType.includes(examType))
    if (keyword) items = items.filter((r) => r.patientName.includes(keyword) || r.title.includes(keyword) || r.reportDoctor.includes(keyword))
    return HttpResponse.json({ success: true, data: items })
  }),

  http.post(`${API}/tasks`, async ({ request }) => {
    await delay(60)
    const body = (await request.json()) as { format?: ExportFormatV2; reportIds?: string[]; requestedBy?: string; requestedByRole?: string }
    const task = createTask(
      (body?.format ?? 'PDF') as ExportFormatV2,
      body?.reportIds ?? [],
      String(body?.requestedBy ?? 'u-001'),
      String(body?.requestedByRole ?? 'DOCTOR'),
    )
    tasks.unshift(task)
    return HttpResponse.json({ success: true, data: task })
  }),

  http.get(`${API}/tasks`, async ({ request }) => {
    await delay(40)
    const url = new URL(request.url)
    const state = url.searchParams.get('state')
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
    const pageSize = Math.max(1, Number(url.searchParams.get('pageSize') ?? 20) || 20)
    let items = tasks
    if (state) items = items.filter((t) => t.state === state)
    const list = items.slice((page - 1) * pageSize, page * pageSize).map((t) => ({
      id: t.id, format: t.format, reportIds: t.reportIds, reportCount: t.reportIds.length,
      state: t.state, progress: t.progress, fileName: t.fileName, fileSize: t.fileSize,
      requestedBy: t.requestedBy, requestedByRole: t.requestedByRole,
      createdAt: t.createdAt, updatedAt: t.updatedAt, completedAt: t.completedAt, error: t.error,
    }))
    return HttpResponse.json({ success: true, data: { items: list, total: items.length, page, pageSize } })
  }),

  http.get(`${API}/tasks/:id`, async ({ params }) => {
    await delay(40)
    const item = tasks.find((t) => t.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `task ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: item })
  }),

  http.post(`${API}/tasks/:id/process`, async ({ params }) => {
    await delay(120)
    const item = tasks.find((t) => t.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `task ${params.id} not found` } }, { status: 404 })
    const now = new Date().toISOString()
    item.state = 'PROCESSING'
    item.progress = 40
    item.updatedAt = now
    // 第二拍完成 (确定性: 同一任务两次 process 后完成)
    if (item.progress >= 40) {
      const reports = REPORTS.filter((r) => item.reportIds.includes(r.id))
      item.state = 'COMPLETED'
      item.progress = 100
      item.content = makeContent(item.format, reports)
      item.fileName = `放射报告_${now.slice(0, 10).replace(/-/g, '')}.${item.format === 'DICOM_SR' ? 'json' : item.format.toLowerCase()}`
      item.fileSize = item.content.length * 2 + 1024
      item.mimeType = MIME[item.format] ?? 'application/octet-stream'
      item.completedAt = now
      item.updatedAt = now
      completedSeq += 1
    }
    return HttpResponse.json({ success: true, data: item })
  }),

  http.post(`${API}/tasks/:id/cancel`, async ({ params }) => {
    await delay(50)
    const item = tasks.find((t) => t.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `task ${params.id} not found` } }, { status: 404 })
    item.state = 'CANCELED'
    item.updatedAt = new Date().toISOString()
    return HttpResponse.json({ success: true, data: item })
  }),

  http.post(`${API}/tasks/:id/download`, async ({ params }) => {
    await delay(60)
    const item = tasks.find((t) => t.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `task ${params.id} not found` } }, { status: 404 })
    if (item.state !== 'COMPLETED') return HttpResponse.json({ success: false, error: { code: 'NOT_READY', message: '任务尚未完成' } }, { status: 409 })
    return HttpResponse.json({
      success: true,
      data: {
        taskId: item.id,
        format: item.format,
        fileName: item.fileName ?? `report.${item.format.toLowerCase()}`,
        mimeType: item.mimeType ?? 'application/octet-stream',
        content: item.content ?? '',
        fileSize: item.fileSize ?? 0,
        exportedAt: new Date().toISOString(),
      },
    })
  }),

  http.post(`${API}/batch`, async ({ request }) => {
    await delay(80)
    const body = (await request.json()) as { format?: ExportFormatV2; reportIds?: string[]; requestedBy?: string; requestedByRole?: string }
    const ids = body?.reportIds ?? REPORTS.slice(0, 2).map((r) => r.id)
    const task = createTask((body?.format ?? 'PDF') as ExportFormatV2, ids, String(body?.requestedBy ?? 'u-001'), String(body?.requestedByRole ?? 'DOCTOR'))
    tasks.unshift(task)
    return HttpResponse.json({ success: true, data: task })
  }),

  http.get(`${API}/history`, async () => {
    await delay(40)
    const items = tasks.filter((t) => t.state === 'COMPLETED' || t.state === 'FAILED' || t.state === 'CANCELED').map((t) => ({
      id: t.id, format: t.format, reportIds: t.reportIds, reportCount: t.reportIds.length,
      state: t.state, progress: t.progress, fileName: t.fileName, fileSize: t.fileSize,
      requestedBy: t.requestedBy, requestedByRole: t.requestedByRole,
      createdAt: t.createdAt, updatedAt: t.updatedAt, completedAt: t.completedAt, error: t.error,
    }))
    return HttpResponse.json({ success: true, data: items })
  }),

  http.get(`${API}/stats`, async () => {
    await delay(40)
    const byFormat: Record<string, number> = {}
    for (const t of tasks) byFormat[t.format] = (byFormat[t.format] ?? 0) + 1
    return HttpResponse.json({
      success: true,
      data: {
        total: tasks.length,
        completed: tasks.filter((t) => t.state === 'COMPLETED').length,
        active: tasks.filter((t) => t.state === 'PENDING' || t.state === 'PROCESSING').length,
        canceled: tasks.filter((t) => t.state === 'CANCELED').length,
        byFormat,
        totalExportedBytes: tasks.filter((t) => t.state === 'COMPLETED').reduce((s, t) => s + (t.fileSize ?? 0), 0),
        totalReportsExported: tasks.filter((t) => t.state === 'COMPLETED').reduce((s, t) => s + t.reportIds.length, 0),
      },
    })
  }),
]
