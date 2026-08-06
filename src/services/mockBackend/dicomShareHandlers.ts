/**
 * G005 v3.0.6.11-75 W3-1 - DICOM 跨科室共享 MSW handlers
 * 对齐 shareApi (/dicom-share/*): 共享记录 + 创建 + 链接 + 统计
 */
import { http, HttpResponse, delay } from 'msw'
import { v4 as uuidv4 } from 'uuid'

const API_BASE = '/api/v1'

export interface ShareRecord {
  id: string
  studyId: string
  patientName: string
  fromDept: string
  toDept: string
  status: 'sent' | 'received' | 'pending' | 'expired' | 'failed'
  protocol: 'dicom-tls' | 'wado'
  password: string
  expiresAt: string
  sizeMb: number
  url?: string
  createdAt: string
}

const delayMs = (min = 60, max = 180) => Math.floor(Math.random() * (max - min) + min)

let shares: ShareRecord[] = [
  { id: 'SHR-1001', studyId: 'CBCT-20260725-01', patientName: '张伟', fromDept: '放射科', toDept: '口腔科', status: 'sent', protocol: 'dicom-tls', password: '', expiresAt: '2026-08-25', sizeMb: 145, createdAt: '2026-07-25 14:30' },
  { id: 'SHR-1002', studyId: 'CT-20260724-03', patientName: '李娜', fromDept: '放射科', toDept: '口腔外科', status: 'received', protocol: 'dicom-tls', password: '', expiresAt: '2026-08-24', sizeMb: 210, createdAt: '2026-07-24 10:15' },
  { id: 'SHR-1003', studyId: 'OCT-20260723-07', patientName: '王芳', fromDept: '放射科', toDept: '眼科', status: 'pending', protocol: 'wado', password: '8862', expiresAt: '2026-08-23', sizeMb: 85, createdAt: '2026-07-23 16:00' },
  { id: 'SHR-1004', studyId: 'MR-20260722-02', patientName: '赵敏', fromDept: '放射科', toDept: '骨科', status: 'expired', protocol: 'dicom-tls', password: '', expiresAt: '2026-07-22', sizeMb: 320, createdAt: '2026-07-15 09:00' },
]

function buildStats(list: ShareRecord[]) {
  return {
    total: list.length,
    todayCount: list.filter((s) => s.createdAt.startsWith(new Date().toISOString().slice(0, 10))).length,
    pendingCount: list.filter((s) => s.status === 'pending').length,
    receivedCount: list.filter((s) => s.status === 'received').length,
    totalSizeMb: Number(list.reduce((sum, s) => sum + s.sizeMb, 0).toFixed(1)),
  }
}

export const dicomShareHandlers = [
  http.get(`${API_BASE}/dicom-share/shares`, async () => {
    await delay(delayMs())
    return HttpResponse.json({ success: true, data: [...shares], meta: { total: shares.length } })
  }),

  http.get(`${API_BASE}/dicom-share/shares/:id`, async ({ params }) => {
    await delay(delayMs(30, 80))
    const found = shares.find((s) => s.id === params.id)
    if (!found) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Share not found' } }, { status: 404 })
    return HttpResponse.json({ success: true, data: found })
  }),

  http.post(`${API_BASE}/dicom-share/shares`, async ({ request }) => {
    await delay(delayMs())
    const body = (await request.json()) as {
      studyId: string
      patientName?: string
      toDept: string
      protocol: 'dicom-tls' | 'wado'
      password?: string
      expiresAt?: string
      sizeMb?: number
    }
    const record: ShareRecord = {
      id: `SHR-${String(1000 + shares.length + 1)}`,
      studyId: body.studyId ?? 'UNKNOWN',
      patientName: body.patientName ?? '未知',
      fromDept: '放射科',
      toDept: body.toDept ?? '',
      status: 'pending',
      protocol: body.protocol ?? 'dicom-tls',
      password: body.password ?? '',
      expiresAt: body.expiresAt ?? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      sizeMb: body.sizeMb ?? 0,
      url: `/dicom-share/link/${uuidv4()}`,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
    }
    shares = [record, ...shares]
    return HttpResponse.json({ success: true, data: record }, { status: 201 })
  }),

  http.delete(`${API_BASE}/dicom-share/shares/:id`, async ({ params }) => {
    await delay(delayMs())
    shares = shares.filter((s) => s.id !== params.id)
    return HttpResponse.json({ success: true, data: { id: params.id, deleted: true } })
  }),

  http.post(`${API_BASE}/dicom-share/shares/:id/copy-link`, async ({ params }) => {
    await delay(delayMs(30, 80))
    const found = shares.find((s) => s.id === params.id)
    if (!found) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Share not found' } }, { status: 404 })
    return HttpResponse.json({
      success: true,
      data: { id: found.id, url: found.url ?? `${window.location.origin}/share/${found.id}`, password: found.password },
    })
  }),

  http.get(`${API_BASE}/dicom-share/stats`, async () => {
    await delay(delayMs(30, 80))
    return HttpResponse.json({ success: true, data: buildStats(shares) })
  }),
]

export const __dicomShareTestReset = () => {
  shares = shares.slice(0, 4)
}
