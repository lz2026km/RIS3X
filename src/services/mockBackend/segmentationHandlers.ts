// [v3.0.6.11-62] /api/v1/volume/segment* MSW handlers — 确定性 3D 分割与定量 mock
// 与 backend volume.controller + segmentation.service 对齐:
//   POST /volume/segment                 → 分割结果 (统计 + 简化掩码)
//   POST /volume/segment/:segId/quantify → HU 直方图
//   GET  /volume/segmentations/:seriesUID → 历史 (RadiomicsFeature)
//   POST /volume/segmentations/:id/approve → 医生确认
import { http, HttpResponse, delay } from 'msw'

const API = '/api/v1/volume'

const HEAD_UID = '1.2.826.0.1.3680043.8.498.20260718120000.001'
const CHEST_UID = '1.2.826.0.1.3680043.8.498.20260718130000.002'

type Target = 'nodule' | 'bone' | 'liver' | 'lung'

interface Stats {
  volumeCm3: number
  meanHu: number
  maxHu: number
  minHu: number
  voxelCount: number
  surfaceAreaCm2: number
  density: number
  bbox: { x: number; y: number; z: number; w: number; h: number; d: number }
  dims: { width: number; height: number; depth: number }
}

/** 固定确定性统计: 按 series + target 查表, 未命中回退通用默认 */
function statsFor(seriesUID: string, target: Target): Stats {
  const generic: Stats = {
    volumeCm3: 2.84, meanHu: 36.5, maxHu: 96, minHu: -18, voxelCount: 6842,
    surfaceAreaCm2: 12.4, density: 36.5,
    bbox: { x: 220, y: 210, z: 8, w: 72, h: 66, d: 6 },
    dims: { width: 512, height: 512, depth: 20 },
  }
  if (seriesUID === HEAD_UID) {
    if (target === 'bone') {
      return { volumeCm3: 116.14, meanHu: 828.4, maxHu: 1130, minHu: 521, voxelCount: 929120, surfaceAreaCm2: 1462.8, density: 828.4, bbox: { x: 80, y: 51, z: 0, w: 352, h: 410, d: 20 }, dims: { width: 512, height: 512, depth: 20 } }
    }
    return { ...generic, volumeCm3: 2871.5, meanHu: 33.6, maxHu: 42, minHu: 26, voxelCount: 2297220, surfaceAreaCm2: 5210.3, density: 33.6, bbox: { x: 105, y: 105, z: 0, w: 302, h: 302, d: 20 }, dims: { width: 512, height: 512, depth: 20 } }
  }
  if (seriesUID === CHEST_UID) {
    if (target === 'lung') {
      return { volumeCm3: 1283.2, meanHu: -812.6, maxHu: -736, minHu: -860, voxelCount: 1311020, surfaceAreaCm2: 3841.6, density: -812.6, bbox: { x: 160, y: 210, z: 0, w: 192, h: 176, d: 15 }, dims: { width: 512, height: 512, depth: 15 } }
    }
    if (target === 'bone') {
      return { volumeCm3: 96.8, meanHu: 612.4, maxHu: 840, minHu: 460, voxelCount: 98900, surfaceAreaCm2: 1212.5, density: 612.4, bbox: { x: 200, y: 120, z: 0, w: 90, h: 200, d: 15 }, dims: { width: 512, height: 512, depth: 15 } }
    }
    return { ...generic, volumeCm3: 3.62, meanHu: 42.1, maxHu: 88, minHu: 5, voxelCount: 8804, surfaceAreaCm2: 18.9, density: 42.1, bbox: { x: 214, y: 218, z: 4, w: 84, h: 76, d: 7 }, dims: { width: 512, height: 512, depth: 15 } }
  }
  return generic
}

/** 确定性 bit 打包 2D 掩码: 圆形 ROI (seed 由 seriesUID+target 哈希) */
function circleMask(width: number, height: number, radius: number, cx: number, cy: number): string {
  const bytes = Math.ceil((width * height) / 8)
  const buf = new Uint8Array(bytes)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius * radius) {
        const i = y * width + x
        buf[i >> 3] = buf[i >> 3]! | (0x80 >> (i & 7))
      }
    }
  }
  let bin = ''
  for (const b of buf) bin += String.fromCharCode(b)
  return btoa(bin)
}

/** 确定性哈希 → 0..1 (用于中心偏移) */
function hash01(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % 1000 / 1000
}

const STATS_CACHE: Record<string, Stats> = {}
const HISTORY: Record<string, any[]> = {}
const APPROVED = new Set<string>()
// [W2-C] 手动标注管理 (SegmentationPage: 参数化创建 / 列表 / 删除)
const MANUAL_SEGMENTATIONS: Record<string, any[]> = {}

const delayMs = (min = 40, max = 120) => Math.floor(Math.random() * (max - min) + min)

export const segmentationHandlers = [
  http.post(`${API}/segment`, async ({ request }) => {
    await delay(delayMs(120, 260))
    const body = (await request.json()) as { seriesUID?: string; target?: Target }
    const seriesUID = body?.seriesUID ?? ''
    const target: Target = body?.target ?? 'nodule'
    const stats = statsFor(seriesUID, target)
    const statsKey = `${seriesUID}|${target}`
    STATS_CACHE[statsKey] = stats

    const segId = `seg-${Date.now().toString(36)}-${target}`
    const now = new Date().toISOString()
    const { dims } = stats
    const { width: W, height: H, depth: D } = dims

    // 简化掩码: 每 8 层一张轴向二值图
    const maskSlices: Array<{ plane: 'axial'; index: number; width: number; height: number; dataBase64: string }> = []
    const cx = stats.bbox.x + Math.round(stats.bbox.w / 2)
    const cy = stats.bbox.y + Math.round(stats.bbox.h / 2)
    const radius = Math.max(4, Math.round(Math.min(stats.bbox.w, stats.bbox.h) * 0.35))
    for (let z = 0; z < D; z += 8) {
      maskSlices.push({ plane: 'axial', index: z, width: W, height: H, dataBase64: circleMask(W, H, radius, cx, cy) })
    }

    const centerZ = stats.bbox.z + Math.round(stats.bbox.d / 2)
    const offset = hash01(`${seriesUID}:${target}`)
    const centerSlices = [
      { plane: 'axial' as const, index: centerZ, width: W, height: H, dataBase64: circleMask(W, H, radius, cx, cy) },
      { plane: 'sagittal' as const, index: cx, width: H, height: 48, dataBase64: circleMask(H, 48, 14, Math.round(H * 0.5), 24) },
      { plane: 'coronal' as const, index: cy, width: W, height: 48, dataBase64: circleMask(W, 48, 14, Math.round(W * 0.5 + offset * 30), 24) },
    ]

    const data = {
      segId,
      seriesUID,
      target,
      source: 'real',
      jobId: `vol-${Date.now()}`,
      volumeCm3: stats.volumeCm3,
      meanHu: stats.meanHu,
      maxHu: stats.maxHu,
      minHu: stats.minHu,
      voxelCount: stats.voxelCount,
      bbox: stats.bbox,
      surfaceAreaCm2: stats.surfaceAreaCm2,
      density: stats.density,
      createdAt: now,
      maskSlices,
      centerSlices,
    }

    const list = HISTORY[seriesUID] ?? []
    list.unshift({
      id: segId,
      seriesUID,
      target,
      source: 'real',
      approved: false,
      createdAt: now,
      volumeCm3: stats.volumeCm3,
      meanHu: stats.meanHu,
      maxHu: stats.maxHu,
      minHu: stats.minHu,
      voxelCount: stats.voxelCount,
      surfaceAreaCm2: stats.surfaceAreaCm2,
      features: [
        { category: target, name: 'volume', value: stats.volumeCm3, unit: 'cm3' },
        { category: target, name: 'meanHu', value: stats.meanHu, unit: 'HU' },
        { category: target, name: 'maxHu', value: stats.maxHu, unit: 'HU' },
        { category: target, name: 'minHu', value: stats.minHu, unit: 'HU' },
        { category: target, name: 'voxelCount', value: stats.voxelCount, unit: 'vox' },
        { category: target, name: 'surfaceArea', value: stats.surfaceAreaCm2, unit: 'cm2' },
        { category: target, name: 'density', value: stats.density, unit: 'HU' },
      ],
    })
    HISTORY[seriesUID] = list

    return HttpResponse.json({ success: true, data })
  }),

  http.post(`${API}/segment/:segId/quantify`, async ({ params }) => {
    await delay(delayMs())
    const segId = String(params.segId)
    const stats = Object.values(STATS_CACHE)[0]
    const lo = stats ? stats.minHu - 30 : -1030
    const hi = stats ? stats.maxHu + 30 : 1130
    const span = hi - lo
    const bins = Array.from({ length: 24 }, (_, i) => {
      const rangeMin = lo + (span * i) / 24
      const rangeMax = lo + (span * (i + 1)) / 24
      const center = (rangeMin + rangeMax) / 2
      const count = stats ? Math.max(2, Math.round(stats.voxelCount * Math.exp(-((center - stats.meanHu) ** 2) / (2 * (span / 6) ** 2)) / 8)) : 0
      return { rangeMin: +rangeMin.toFixed(1), rangeMax: +rangeMax.toFixed(1), count }
    })
    return HttpResponse.json({
      success: true,
      data: { segId, seriesUID: 'series', target: 'nodule', binCount: 24, bins },
    })
  }),

  http.get(`${API}/segmentations/:seriesUID`, async ({ params }) => {
    await delay(delayMs())
    const seriesUID = String(params.seriesUID)
    return HttpResponse.json({ success: true, data: HISTORY[seriesUID] ?? [] })
  }),

  http.post(`${API}/segmentations/:id/approve`, async ({ params }) => {
    await delay(delayMs(30, 80))
    const id = String(params.id)
    APPROVED.add(id)
    for (const list of Object.values(HISTORY)) {
      const item = list.find((it) => it.id === id)
      if (item) item.approved = true
    }
    return HttpResponse.json({ success: true, data: { id, approved: true } })
  }),

  // ── [W2-C] 手动标注管理 (SegmentationPage: 参数化创建 / 列表 / 删除) ──

  http.get(`${API}/:studyUid/segmentations`, async ({ params }) => {
    await delay(delayMs())
    const studyUid = String(params.studyUid)
    return HttpResponse.json({ success: true, data: MANUAL_SEGMENTATIONS[studyUid] ?? [] })
  }),

  http.post(`${API}/:studyUid/segmentations`, async ({ params, request }) => {
    await delay(delayMs(60, 160))
    const studyUid = String(params.studyUid)
    const body = (await request.json()) as { label?: string; color?: string; voxelIndices?: number[] }
    const voxelCount = Math.max(0, body?.voxelIndices?.length ?? 0)
    const item = {
      id: `man-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      seriesUid: studyUid,
      label: body?.label ?? '手动标注',
      color: body?.color ?? '#ff4d4f',
      volume: +(voxelCount * 0.00245).toFixed(4),
      voxelCount,
      createdBy: 'current-user',
      createdAt: new Date().toISOString(),
    }
    const list = MANUAL_SEGMENTATIONS[studyUid] ?? []
    list.unshift(item)
    MANUAL_SEGMENTATIONS[studyUid] = list
    return HttpResponse.json({ success: true, data: item }, { status: 201 })
  }),

  http.delete(`${API}/segmentations/:id`, async ({ params }) => {
    await delay(delayMs(30, 90))
    const id = String(params.id)
    let deleted = false
    for (const key of Object.keys(MANUAL_SEGMENTATIONS)) {
      const list = MANUAL_SEGMENTATIONS[key] ?? []
      const idx = list.findIndex((it) => it.id === id)
      if (idx !== -1) {
        list.splice(idx, 1)
        deleted = true
      }
    }
    if (!deleted) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `手动标注 ${id} 不存在` } }, { status: 404 })
    }
    return HttpResponse.json({ success: true, data: { id, deleted: true } })
  }),
]
