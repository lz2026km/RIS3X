/**
 * Phase 1.2+1.3: 3D 后处理页共享的真实体数据工具
 * - 选择真实 series / 触发 reconstruct
 * - base64 Int16 / RGBA 解码
 * - WWL 灰度映射
 */
import { volumeApi, type VolumeSeriesDto } from '../../services/api/volumeApi'

export interface RealVolumeSetup {
  mode: 'real' | 'synthetic'
  jobId: string | null
  dims: { x: number; y: number; z: number } | null
  series: VolumeSeriesDto | null
}

export function queryParam(name: string): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(name)
}

/**
 * 初始化真实体数据:
 * - ?source=synthetic 强制合成模式
 * - 默认尝试 ?seriesUID 指定 / 首个 CT 序列; 无真实数据或失败时回退合成
 */
export async function setupRealVolume(opts?: { seriesUid?: string | null; modality?: string }): Promise<RealVolumeSetup> {
  const sourceParam = queryParam('source')
  if (sourceParam === 'synthetic') {
    return { mode: 'synthetic', jobId: null, dims: null, series: null }
  }
  try {
    const listRes = await volumeApi.series()
    if (!listRes.success || listRes.data.length === 0) return { mode: 'synthetic', jobId: null, dims: null, series: null }
    const uid = opts?.seriesUid ?? queryParam('seriesUID')
    const prefer = opts?.modality ?? queryParam('modality') ?? 'CT'
    let pick: VolumeSeriesDto | undefined = uid ? listRes.data.find((s) => s.seriesInstanceUid === uid) : undefined
    if (!pick) pick = listRes.data.find((s) => s.modality === prefer) ?? listRes.data[0]
    if (!pick) return { mode: 'synthetic', jobId: null, dims: null, series: null }
    const rec = await volumeApi.reconstruct(pick.seriesInstanceUid)
    if (!rec.success || rec.data.source !== 'real') return { mode: 'synthetic', jobId: null, dims: null, series: null }
    return { mode: 'real', jobId: rec.data.jobId, dims: rec.data.volume, series: pick }
  } catch {
    return { mode: 'synthetic', jobId: null, dims: null, series: null }
  }
}

/** 解码 LE Int16 base64 像素 */
export function decodeInt16Base64(b64: string): Int16Array {
  const bin = atob(b64)
  const buf = new ArrayBuffer(bin.length)
  const u8 = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  return new Int16Array(buf)
}

/** 解码 RGBA base64 */
export function decodeRgbaBase64(b64: string): Uint8ClampedArray {
  const bin = atob(b64)
  const out = new Uint8ClampedArray(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Int16 (已 rescale, 如 HU) + WWL → 灰度 ImageData */
export function applyWWL(data: Int16Array, width: number, height: number, ww: number, wl: number): ImageData {
  const img = document.createElement('canvas')
  img.width = width
  img.height = height
  const ctx = img.getContext('2d')!
  const imgData = ctx.createImageData(width, height)
  const half = ww / 2
  const min = wl - half
  const range = ww || 1
  for (let i = 0; i < width * height; i++) {
    const v = ((data[i] ?? -1000) - min) / range * 255
    const g = Math.max(0, Math.min(255, Math.round(v)))
    imgData.data[i * 4] = g
    imgData.data[i * 4 + 1] = g
    imgData.data[i * 4 + 2] = g
    imgData.data[i * 4 + 3] = 255
  }
  return imgData
}

export function drawImageDataCentered(ctx: CanvasRenderingContext2D, imgData: ImageData, w: number, h: number, maxScale = 1) {
  ctx.clearRect(0, 0, w, h)
  const scale = Math.min(w / imgData.width, h / imgData.height, maxScale)
  const ox = (w - imgData.width * scale) / 2
  const oy = (h - imgData.height * scale) / 2
  const tmp = document.createElement('canvas')
  tmp.width = imgData.width
  tmp.height = imgData.height
  const tmpCtx = tmp.getContext('2d')
  if (!tmpCtx) return
  tmpCtx.putImageData(imgData, 0, 0)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(tmp, ox, oy, imgData.width * scale, imgData.height * scale)
}
