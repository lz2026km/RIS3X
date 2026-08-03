/**
 * v3.0.6.11-60: VNA 厂商中立归档 MSW handlers
 * 与后端 backend/src/modules/vna/ 对齐 (/api/v1/vna/*)
 * 内存对象存储 + WORM 锁定语义 + 上传模拟
 */
import { http, HttpResponse, delay } from 'msw'

const API_BASE = '/api/v1'

interface MockVnaObject {
  id: string
  patientId: string | null
  studyUid: string | null
  objectType: 'document' | 'image'
  name: string
  description: string
  mimeType: string
  size: number
  storagePath: string | null
  wormLocked: boolean
  createdAt: string
  storageSource: 'database' | 'memory'
  content?: string
}

interface MockStudy {
  studyUid: string
  patientId: string | null
  modality: string
  studyDescription: string
  instanceCount: number
  seriesCount: number
  createdAt: string
  storageSource: 'database' | 'memory'
}

let seq = 1000

const daysAgo = (n: number, hour = 9) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, 15, 0, 0)
  return d.toISOString()
}

let objects: MockVnaObject[] = [
  { id: 'vna-seed-1', patientId: 'P00001', studyUid: '1.2.840.10008.5.1.4.1.1.2.1001', objectType: 'document', name: '增强扫描知情同意书.pdf', description: 'CT 增强检查知情同意 (2026-07-28)', mimeType: 'application/pdf', size: 245760, storagePath: '/vna-storage/vna-seed-1.pdf', wormLocked: true, createdAt: daysAgo(6, 10), storageSource: 'database' },
  { id: 'vna-seed-2', patientId: 'P00001', studyUid: '1.2.840.10008.5.1.4.1.1.2.1001', objectType: 'image', name: 'CT 定位像预览.png', description: '胸部 CT 定位像', mimeType: 'image/png', size: 153600, storagePath: '/vna-storage/vna-seed-2.png', wormLocked: false, createdAt: daysAgo(5, 14), storageSource: 'database' },
  { id: 'vna-seed-3', patientId: 'P00002', studyUid: null, objectType: 'document', name: 'MRI 检查申请单.pdf', description: '外院 MRI 申请单扫描件', mimeType: 'application/pdf', size: 81920, storagePath: '/vna-storage/vna-seed-3.pdf', wormLocked: false, createdAt: daysAgo(3, 11), storageSource: 'database' },
  { id: 'vna-seed-4', patientId: 'P00003', studyUid: '1.2.840.10008.5.1.4.1.1.4.2201', objectType: 'image', name: 'DR 胸片正位.png', description: 'DR 胸部正位', mimeType: 'image/png', size: 204800, storagePath: '/vna-storage/vna-seed-4.png', wormLocked: false, createdAt: daysAgo(2, 9), storageSource: 'database' },
  { id: 'vna-seed-5', patientId: 'P00003', studyUid: null, objectType: 'document', name: '碘对比剂不良反应记录.txt', description: '碘对比剂使用记录与不良反应随访', mimeType: 'text/plain', size: 4096, storagePath: '/vna-storage/vna-seed-5.txt', wormLocked: true, createdAt: daysAgo(1, 16), storageSource: 'database' },
  { id: 'vna-seed-6', patientId: 'P00001', studyUid: null, objectType: 'document', name: '影像科会诊意见.docx', description: '多学科会诊 (MDT) 意见', mimeType: 'application/octet-stream', size: 32768, storagePath: '/vna-storage/vna-seed-6.docx', wormLocked: false, createdAt: daysAgo(0, 8), storageSource: 'database' },
]

const studies: MockStudy[] = [
  { studyUid: '1.2.840.10008.5.1.4.1.1.2.1001', patientId: 'P00001', modality: 'CT', studyDescription: '胸部 CT 平扫+增强', instanceCount: 312, seriesCount: 6, createdAt: daysAgo(5, 13), storageSource: 'database' },
  { studyUid: '1.2.840.10008.5.1.4.1.1.4.2201', patientId: 'P00003', modality: 'DR', studyDescription: '胸部正侧位', instanceCount: 2, seriesCount: 2, createdAt: daysAgo(2, 9), storageSource: 'database' },
  { studyUid: '1.2.840.10008.5.1.4.1.1.4.3111', patientId: 'P00002', modality: 'MR', studyDescription: '头颅 MRI 平扫', instanceCount: 486, seriesCount: 5, createdAt: daysAgo(8, 10), storageSource: 'database' },
  { studyUid: '1.2.840.10008.5.1.4.1.1.7.4090', patientId: 'P00004', modality: 'US', studyDescription: '腹部超声', instanceCount: 24, seriesCount: 3, createdAt: daysAgo(1, 15), storageSource: 'database' },
]

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

const objDto = (o: MockVnaObject) => {
  const { content, ...dto } = o
  void content
  return dto
}

const notFound = (id: string) =>
  HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `VNA object ${id} not found` } }, { status: 404 })

export const vnaHandlers = [
  // 归档对象列表 (type/patientId/search 过滤)
  http.get(`${API_BASE}/vna/objects`, async ({ request }) => {
    await delay(120)
    const url = new URL(request.url)
    const type = url.searchParams.get('type')
    const patientId = url.searchParams.get('patientId')
    const search = url.searchParams.get('search')?.toLowerCase()
    let rows = clone(objects)
    if (type === 'document' || type === 'image') rows = rows.filter((o) => o.objectType === type)
    if (patientId) rows = rows.filter((o) => o.patientId === patientId)
    if (search) {
      rows = rows.filter((o) =>
        o.name.toLowerCase().includes(search) ||
        o.description.toLowerCase().includes(search) ||
        (o.studyUid ?? '').toLowerCase().includes(search),
      )
    }
    rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    return HttpResponse.json({ success: true, data: rows.map(objDto) })
  }),

  // 创建归档对象 (multipart 或 JSON)
  http.post(`${API_BASE}/vna/objects`, async ({ request }) => {
    await delay(200)
    const contentType = request.headers.get('content-type') ?? ''
    let patientId: string | null = null
    let studyUid: string | null = null
    let objectType: 'document' | 'image' = 'document'
    let name = ''
    let description = ''
    let mimeType = 'application/octet-stream'
    let size = 0

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      patientId = String(form.get('patientId') ?? '').trim() || null
      studyUid = String(form.get('studyUid') ?? '').trim() || null
      objectType = form.get('objectType') === 'image' ? 'image' : 'document'
      name = String(form.get('name') ?? '').trim()
      description = String(form.get('description') ?? '').trim()
      const file = form.get('file')
      if (file instanceof File) {
        name = name || file.name
        mimeType = file.type || 'application/octet-stream'
        size = file.size
      }
    } else {
      const body = (await request.json()) as Record<string, unknown>
      patientId = String(body.patientId ?? '').trim() || null
      studyUid = String(body.studyUid ?? '').trim() || null
      objectType = body.objectType === 'image' ? 'image' : 'document'
      name = String(body.name ?? '').trim()
      description = String(body.description ?? '').trim()
      mimeType = String(body.mimeType ?? 'application/octet-stream')
      size = Number(body.size ?? 0) || 0
    }
    if (!name) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION', message: 'name 必填' } }, { status: 400 })
    }

    const created: MockVnaObject = {
      id: `vna-${++seq}`,
      patientId,
      studyUid,
      objectType,
      name,
      description,
      mimeType,
      size,
      storagePath: `/vna-storage/${name}`,
      wormLocked: false,
      createdAt: new Date().toISOString(),
      storageSource: 'database',
      content: `${name}\n\n演示内容: ${description || '无描述'}\n上传于 ${new Date().toLocaleString()}`,
    }
    objects = [created, ...objects]
    return HttpResponse.json({ success: true, data: objDto(created) }, { status: 201 })
  }),

  // 对象详情 (元数据)
  http.get(`${API_BASE}/vna/objects/:id`, async ({ params }) => {
    await delay(80)
    const o = objects.find((x) => x.id === params.id)
    if (!o) return notFound(String(params.id))
    return HttpResponse.json({ success: true, data: objDto(o) })
  }),

  // 下载/预览内容 (生成二进制 blob)
  http.get(`${API_BASE}/vna/objects/:id/download`, async ({ params }) => {
    await delay(120)
    const o = objects.find((x) => x.id === params.id)
    if (!o) return notFound(String(params.id))
    const text = o.content ?? `${o.name}\n\nG005 VNA 归档对象演示内容\n类型: ${o.objectType}\n大小: ${o.size} 字节\n归档时间: ${o.createdAt}\nWORM 锁定: ${o.wormLocked ? '是' : '否'}`
    const mime = o.mimeType.startsWith('image/')
      ? 'image/png'
      : o.mimeType.includes('pdf')
        ? 'application/pdf'
        : 'text/plain; charset=utf-8'
    const buffer = o.mimeType.includes('image/')
      ? new Uint8Array(64).map((_, i) => i * 4) // 伪图像字节
      : new TextEncoder().encode(text)
    return new HttpResponse(buffer, {
      headers: { 'Content-Type': mime, 'Content-Disposition': `attachment; filename="${encodeURIComponent(o.name)}"` },
    })
  }),

  // 删除 (WORM 锁定 → 403)
  http.delete(`${API_BASE}/vna/objects/:id`, async ({ params }) => {
    await delay(120)
    const o = objects.find((x) => x.id === params.id)
    if (!o) return notFound(String(params.id))
    if (o.wormLocked) {
      return HttpResponse.json(
        { success: false, error: { code: 'WORM_LOCKED', message: `VNA object ${params.id} is WORM-locked, deletion is forbidden` } },
        { status: 403 },
      )
    }
    objects = objects.filter((x) => x.id !== params.id)
    return HttpResponse.json({ success: true, data: { deleted: true } })
  }),

  // WORM 锁定 (一次性不可逆, 幂等)
  http.post(`${API_BASE}/vna/objects/:id/worm-lock`, async ({ params }) => {
    await delay(150)
    const o = objects.find((x) => x.id === params.id)
    if (!o) return notFound(String(params.id))
    o.wormLocked = true
    return HttpResponse.json({ success: true, data: objDto(o) })
  }),

  // 患者归档视图 (DICOM 检查 + 非 DICOM 对象)
  http.get(`${API_BASE}/vna/patients/:patientId`, async ({ params }) => {
    await delay(150)
    const patientId = String(params.patientId)
    const patientObjects = clone(objects).filter((o) => o.patientId === patientId)
    const patientStudies = clone(studies).filter((s) => s.patientId === patientId)
    return HttpResponse.json({
      success: true,
      data: {
        patientId,
        studies: patientStudies,
        objects: patientObjects.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
        totalSizeBytes: patientObjects.reduce((s, o) => s + o.size, 0) +
          patientStudies.reduce((s, st) => s + st.instanceCount * 512000, 0),
      },
    })
  }),

  // 归档统计
  http.get(`${API_BASE}/vna/stats`, async () => {
    await delay(100)
    return HttpResponse.json({
      success: true,
      data: {
        totalObjects: objects.length,
        totalSizeBytes: objects.reduce((s, o) => s + o.size, 0),
        dicomCount: studies.reduce((s, st) => s + st.instanceCount, 0),
        nonDicomCount: objects.length,
        wormLockedCount: objects.filter((o) => o.wormLocked).length,
        studyCount: studies.length,
        storageSource: 'database',
      },
    })
  }),

  // DICOM 检查归档列表
  http.get(`${API_BASE}/vna/studies`, async () => {
    await delay(100)
    const rows = clone(studies).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    return HttpResponse.json({ success: true, data: rows })
  }),
]
