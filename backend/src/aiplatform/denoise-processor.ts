/**
 * [G005 v3.0.6.11-90 Wave 4B (G-10)] DL 降噪确定性处理器
 * 无真实模型时的确定性去噪管线:
 *   - PNG 8-bit (gray/RGB/RGBA/palette) 解码 (node:zlib, 无第三方图像库)
 *   - 3x3 中值滤波 (strength >= 50 时二次滤波)
 *   - PSNR / 全局 SSIM 指标计算
 *   - 灰度/三通道 PNG 重编码
 *   - imageBase64 缺失或解码失败时: 种子化合成帧 (幻影 + 噪声) 确定性回退
 */
import * as zlib from 'node:zlib'

export interface DecodedImage {
  width: number
  height: number
  channels: 1 | 3 | 4
  data: Buffer
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export function decodePng(buf: Buffer): DecodedImage | null {
  if (!buf || buf.length < 33 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) return null
  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = -1
  let palette: Buffer | null = null
  const idat: Buffer[] = []
  let seenIhdr = false
  while (offset + 12 <= buf.length) {
    const len = buf.readUInt32BE(offset)
    const type = buf.toString('ascii', offset + 4, offset + 8)
    const start = offset + 8
    if (type === 'IHDR') {
      if (!seenIhdr && len === 13) {
        width = buf.readUInt32BE(start)
        height = buf.readUInt32BE(start + 4)
        bitDepth = buf[start + 8]
        colorType = buf[start + 9]
        const compression = buf[start + 10]
        const filter = buf[start + 11]
        const interlace = buf[start + 12]
        if (compression !== 0 || filter !== 0 || interlace !== 0) return null
        seenIhdr = true
      }
    } else if (type === 'PLTE') {
      palette = Buffer.from(buf.subarray(start, start + len))
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(buf.subarray(start, start + len)))
    } else if (type === 'IEND') {
      break
    }
    offset = start + len + 4
  }
  if (!seenIhdr || bitDepth !== 8 || idat.length === 0) return null
  let channels: 1 | 3 | 4
  if (colorType === 0) channels = 1
  else if (colorType === 2) channels = 3
  else if (colorType === 6) channels = 4
  else if (colorType === 3) channels = 3 // palette → RGB 展开
  else return null
  let raw: Buffer
  try {
    raw = zlib.inflateSync(Buffer.concat(idat))
  } catch {
    return null
  }
  const bpp = colorType === 3 ? 1 : channels
  const stride = width * bpp
  if (raw.length < (stride + 1) * height) return null
  const out = Buffer.alloc(width * height * channels)
  const prev = Buffer.alloc(stride)
  const cur = Buffer.alloc(stride)
  let src = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[src++]
    if (filter > 4) return null
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0
      const b = prev[x]
      const c = x >= bpp ? prev[x - bpp] : 0
      let v = raw[src + x]
      switch (filter) {
        case 0: break
        case 1: v = (v + a) & 0xff; break
        case 2: v = (v + b) & 0xff; break
        case 3: v = (v + ((a + b) >> 1)) & 0xff; break
        case 4: {
          const p = a + b - c
          const pa = Math.abs(p - a)
          const pb = Math.abs(p - b)
          const pc = Math.abs(p - c)
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
          v = (v + pr) & 0xff
          break
        }
      }
      cur[x] = v
    }
    src += stride
    for (let x = 0; x < width; x++) {
      const dst = (y * width + x) * channels
      if (colorType === 3 && palette) {
        const idx = cur[x] * 3
        out[dst] = palette[idx] ?? 0
        out[dst + 1] = palette[idx + 1] ?? 0
        out[dst + 2] = palette[idx + 2] ?? 0
      } else if (colorType === 0) {
        out[dst] = cur[x]
      } else if (colorType === 2 || colorType === 6) {
        for (let c = 0; c < channels; c++) out[dst + c] = cur[x * channels + c]
      }
    }
    prev.set(cur)
  }
  return { width, height, channels: colorType === 3 ? 3 : (channels as 1 | 3 | 4), data: out }
}

// ─────────────────────────────── PNG 编码 ───────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(...bufs: Buffer[]): number {
  let c = 0xffffffff
  for (const buf of bufs) {
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(t, data))
  return Buffer.concat([len, t, data, crc])
}

/** 仅支持 8-bit 灰度 (channels=1) / RGB (channels=3), filter=None, 无 interlace */
export function encodePng(width: number, height: number, data: Uint8Array, channels: 1 | 3): Buffer {
  const stride = width * channels
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    Buffer.from(data.subarray(y * stride, (y + 1) * stride)).copy(raw, y * (stride + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = channels === 1 ? 0 : 2
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const idat = zlib.deflateSync(raw, { level: 6 })
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ─────────────────────────────── 滤波算法 ───────────────────────────────

/** 3x3 中值滤波 (逐通道, 边缘钳制), 通道间独立 */
export function medianFilter(data: Uint8Array, width: number, height: number, channels: number): Uint8Array {
  const out = new Uint8Array(data.length)
  const window = new Array<number>(9)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < channels; c++) {
        let k = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = Math.min(width - 1, Math.max(0, x + dx))
            const ny = Math.min(height - 1, Math.max(0, y + dy))
            window[k++] = data[(ny * width + nx) * channels + c]
          }
        }
        window.sort((a, b) => a - b)
        out[(y * width + x) * channels + c] = window[4]!
      }
    }
  }
  return out
}

// ─────────────────────────────── 质量指标 ───────────────────────────────

export function psnr(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length)
  if (n === 0) return 0
  let mse = 0
  for (let i = 0; i < n; i++) {
    const d = a[i]! - b[i]!
    mse += d * d
  }
  mse /= n
  return mse === 0 ? 100 : 10 * Math.log10((255 * 255) / mse)
}

function toLuma(data: Uint8Array): number[] {
  const n = Math.floor(data.length / 4) * 4
  const out = new Array<number>(n / 4)
  for (let i = 0, j = 0; i < n; i += 4, j++) out[j] = data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114
  return out
}

/** 全局单窗口 SSIM (亮度-对比度-结构, C1/C2 标准常量) */
export function ssim(a: Uint8Array, b: Uint8Array): number {
  const la = toLuma(a)
  const lb = toLuma(b)
  const n = Math.min(la.length, lb.length)
  if (n === 0) return 0
  let ma = 0
  let mb = 0
  for (let i = 0; i < n; i++) {
    ma += la[i]!
    mb += lb[i]!
  }
  ma /= n
  mb /= n
  let va = 0
  let vb = 0
  let cov = 0
  for (let i = 0; i < n; i++) {
    const da = la[i]! - ma
    const db = lb[i]! - mb
    va += da * da
    vb += db * db
    cov += da * db
  }
  va /= n
  vb /= n
  cov /= n
  const c1 = (0.01 * 255) ** 2
  const c2 = (0.03 * 255) ** 2
  return ((2 * ma * mb + c1) * (2 * cov + c2)) / ((ma * ma + mb * mb + c1) * (va + vb + c2))
}

// ─────────────────────────────── 确定性合成帧 ───────────────────────────────

/** FNV-1a 32-bit 字符串哈希 (种子) */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** mulberry32 种子化 PRNG */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const SYNTHETIC_SIZE = 256

/** 合成幻影切片 + 按强度加噪 (与前端演示算法同构, 完全确定性; 相位随种子变化) */
export function syntheticFrame(seed: number, noiseLevel: number): { noisy: Uint8Array; clean: Uint8Array } {
  const rand = mulberry32(seed)
  const phase = (seed % 628) / 100
  const size = SYNTHETIC_SIZE
  const clean = new Uint8Array(size * size)
  const noisy = new Uint8Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = x - size / 2
      const cy = y - size / 2
      const d = Math.sqrt(cx * cx + cy * cy)
      const a = Math.atan2(cy, cx)
      const v = 200 + 150 * Math.sin(d * 0.03 + phase) + 50 * Math.cos(a * 3 + phase)
      clean[y * size + x] = Math.max(0, Math.min(255, Math.round(v)))
      const n = (rand() - 0.5) * noiseLevel * 2
      noisy[y * size + x] = Math.max(0, Math.min(255, Math.round(v + n)))
    }
  }
  return { noisy, clean }
}
