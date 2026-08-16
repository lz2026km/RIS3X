// [G005 Wave 3A v3.0.6.11-101] /api/v1/volume-v2 MSW handlers
// 对齐后端 volume-v2.module + volumeV2Api (POST /volume-v2/*):
//   mpr-linked / cpr / vr / cut — 确定性合成输出 (source: 'synthetic')
// 响应形状: { success: true, data: <T> }
import { http, HttpResponse, delay } from 'msw'
// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')


const API = `${API_BASE}/volume-v2`

const NOW = '2026-08-16T08:00:00.000Z'

/** 确定性伪随机 0..1 (FNV-1a 哈希 → 1024 网格) */
function hash01(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

/** 确定性 base64 像素载荷: 均匀灰度渐变 (与 key 绑定偏移) */
function pixelDataBase64(width: number, height: number, key: string): string {
  const shift = Math.round(hash01(key) * 40)
  const buf = new Uint8Array(width * height)
  for (let i = 0; i < buf.length; i++) {
    buf[i] = ((i % 255) + shift) % 256
  }
  let bin = ''
  const chunk = 8192
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode(...buf.subarray(i, i + chunk))
  }
  return btoa(bin)
}

function jobId(kind: string, seriesUID: string): string {
  return `v2-${kind}-${Math.floor(hash01(`${seriesUID}|${NOW}|${kind}`) * 9000) + 1000}`
}

export const volumeV2Handlers = [
  // ── 三平面联动切片 + 相交线 ──
  http.post(`${API}/mpr-linked`, async ({ request }) => {
    await delay(50)
    const body = (await request.json()) as { jobId?: string; seriesUID?: string; position?: { x?: number; y?: number; z?: number } }
    const seriesUID = body?.seriesUID ?? 'unknown'
    const pos = body?.position ?? { x: 0, y: 0, z: 0 }
    const cx = Math.round((hash01(`${seriesUID}|mpr|h`) * 0.8 + 0.1) * 512)
    const cy = Math.round((hash01(`${seriesUID}|mpr|v`) * 0.8 + 0.1) * 512)
    const width = 256
    const height = 256
    return HttpResponse.json({
      success: true,
      data: {
        jobId: jobId('mpr', seriesUID),
        source: 'synthetic' as const,
        dims: { x: 512, y: 512, z: 20 },
        position: { x: pos.x ?? 256, y: pos.y ?? 256, z: pos.z ?? 10 },
        lines: {
          axial: { h: cy, v: cx },
          coronal: { h: cy, v: cx },
          sagittal: { h: cy, v: cx },
        },
        planes: (['axial', 'coronal', 'sagittal'] as const).map((plane) => ({
          plane,
          sliceIndex: 10,
          totalSlices: 20,
          width,
          height,
          windowWidth: 400,
          windowLevel: 60,
          crosshair: { h: cy, v: cx },
          pixelData: {
            dataBase64: pixelDataBase64(width, height, `${seriesUID}|${plane}`),
            bitsAllocated: 8,
            signed: false,
            width,
            height,
          },
        })),
      },
    })
  }),

  // ── 曲面重建 ──
  http.post(`${API}/cpr`, async ({ request }) => {
    await delay(50)
    const body = (await request.json()) as { seriesUID?: string; points?: Array<{ x?: number; y?: number; z?: number }>; spacing?: number; crossWidth?: number }
    const seriesUID = body?.seriesUID ?? 'unknown'
    const points = (body?.points ?? []).map((p, i) => ({
      x: p.x ?? 256 + i * 8,
      y: p.y ?? 256 + i * 3,
      z: p.z ?? 10 + Math.round(Math.sin(i * 0.7) * 3),
    }))
    const count = Math.max(2, points.length)
    const width = 256
    const height = 256
    const spacing = body?.spacing ?? 1.5
    return HttpResponse.json({
      success: true,
      data: {
        jobId: jobId('cpr', seriesUID),
        source: 'synthetic' as const,
        points,
        spacing,
        crossWidth: body?.crossWidth ?? 5,
        totalLengthVoxels: count * 10,
        totalLengthMm: Math.round(count * 10 * spacing * 10) / 10,
        sampleCount: count,
        straightened: {
          width,
          height,
          windowWidth: 400,
          windowLevel: 60,
          pixelData: {
            dataBase64: pixelDataBase64(width, height, `${seriesUID}|cpr`),
            bitsAllocated: 8,
            signed: false,
            width,
            height,
          },
        },
        projections: {
          axial: points.map((p) => ({ x: p.x, y: p.y })),
          coronal: points.map((p) => ({ x: p.x, z: p.z })),
          sagittal: points.map((p) => ({ y: p.y, z: p.z })),
        },
        dims: { x: 512, y: 512, z: 20 },
      },
    })
  }),

  // ── 光线投射体绘制 ──
  http.post(`${API}/vr`, async ({ request }) => {
    await delay(60)
    const body = (await request.json()) as { seriesUID?: string; yaw?: number; pitch?: number; preset?: 'bone' | 'softTissue' | 'vessel'; step?: number; size?: number }
    const seriesUID = body?.seriesUID ?? 'unknown'
    const preset = body?.preset ?? 'bone'
    const yaw = body?.yaw ?? 30
    const pitch = body?.pitch ?? -15
    const size = Math.min(512, Math.max(64, body?.size ?? 256))
    const width = size
    const height = size
    const lut: Record<string, Array<{ hu: number; r: number; g: number; b: number; a: number }>> = {
      bone: [
        { hu: -1024, r: 0, g: 0, b: 0, a: 0 },
        { hu: 120, r: 230, g: 210, b: 180, a: 40 },
        { hu: 300, r: 255, g: 250, b: 235, a: 220 },
        { hu: 3071, r: 255, g: 255, b: 255, a: 255 },
      ],
      softTissue: [
        { hu: -1024, r: 0, g: 0, b: 0, a: 0 },
        { hu: -100, r: 160, g: 90, b: 90, a: 30 },
        { hu: 60, r: 235, g: 150, b: 130, a: 200 },
        { hu: 3071, r: 255, g: 255, b: 255, a: 255 },
      ],
      vessel: [
        { hu: -1024, r: 0, g: 0, b: 0, a: 0 },
        { hu: 40, r: 200, g: 60, b: 60, a: 60 },
        { hu: 180, r: 255, g: 120, b: 120, a: 240 },
        { hu: 3071, r: 255, g: 255, b: 255, a: 255 },
      ],
    }
    return HttpResponse.json({
      success: true,
      data: {
        jobId: jobId('vr', seriesUID),
        source: 'synthetic' as const,
        width,
        height,
        yaw,
        pitch,
        preset,
        sampleStep: body?.step ?? 2,
        stepCount: 160,
        transferFunction: { lutSize: 4, entries: lut[preset] ?? lut.bone },
        pixelData: {
          dataBase64: pixelDataBase64(width, height, `${seriesUID}|vr`),
          channels: 4,
        },
      },
    })
  }),

  // ── 任意切面裁剪 ──
  http.post(`${API}/cut`, async ({ request }) => {
    await delay(50)
    const body = (await request.json()) as { seriesUID?: string; normal?: { x?: number; y?: number; z?: number }; offset?: number }
    const seriesUID = body?.seriesUID ?? 'unknown'
    const normal = body?.normal ?? { x: 0, y: 0, z: 1 }
    const offset = body?.offset ?? 0
    const width = 256
    const height = 256
    const voxelsTotal = 512 * 512 * 20
    const keptRatio = Math.round((0.5 + hash01(`${seriesUID}|cut`) * 0.45) * 10000) / 10000
    const voxelsKept = Math.round(voxelsTotal * keptRatio)
    return HttpResponse.json({
      success: true,
      data: {
        jobId: jobId('cut', seriesUID),
        source: 'synthetic' as const,
        normal: { x: normal.x ?? 0, y: normal.y ?? 0, z: normal.z ?? 1 },
        offset,
        width,
        height,
        sectionImage: {
          dataBase64: pixelDataBase64(width, height, `${seriesUID}|cut`),
          bitsAllocated: 8,
          signed: false,
          width,
          height,
        },
        stats: {
          voxelsKept,
          voxelsTotal,
          keptRatio,
          clippedRatio: Math.round((1 - keptRatio) * 10000) / 10000,
        },
        planeInfo: {
          center: { x: 256, y: 256, z: 10 },
          basisU: { x: 1, y: 0, z: 0 },
          basisV: { x: 0, y: 1, z: 0 },
        },
      },
    })
  }),
]
