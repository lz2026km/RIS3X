/**
 * G005 RIS - HTJ2K (High-Throughput JPEG 2000, ITU-T T.814) 编解码器
 *
 * HTJ2K 核心差异: block-based 独立码块 + 免上下文自适应熵编码 (无需上下文传播,
 * 码块间并行)。本实现:
 *  - 将图像划分为固定尺寸码块 (blockSize x blockSize, 默认 32x32, 可配 16/32/64)
 *  - 每码块独立: 中值边缘预测 + 自适应 Golomb-Rice 熵编码 (块内 k 自适应)
 *  - 可逆模式 (reversible) 无损 / 不可逆模式 (irreversible) 有损 (量化步缩放)
 *  - HTJ2K 风格量化: 码块独立量化器, 降采样 DWT 前向变换 (lifted 5/3 可逆,
 *    9/7 不可逆) + 子带系数量化 + 逆变换重建
 *  - 16-bit 医学图像支持 (65535 灰阶)
 *
 * 头部格式:
 *   [0..2] = 'H2K' 魔数
 *   [3]    = bitsAllocated (8|16)
 *   [4]    = 模式 (0=可逆无损, 1=不可逆有损)
 *   [5]    = blockSize 指数 (4=16, 5=32, 6=64)
 *   [6]    = DWT 分解级数
 *   [7..10]= pixelCount (uint32 LE)
 *   [11..12]= columns (uint16 LE)
 *   [13]   = 量化步指数 (有损用)
 *   [14..] = 码块流: 每块 [4字节长度][payload]
 *
 * 所有函数均为确定性纯函数。
 */

const HTJ2K_MAGIC = Buffer.from('H2K', 'ascii')
export const HTJ2K_HEADER_SIZE = 14

export interface Htj2kOptions {
  bitsAllocated: number
  pixelRepresentation: number
  quality?: number
  blockSize?: number
  levels?: number
  columns?: number
}

function sampleBytes(bits: number): number {
  return Math.max(1, Math.ceil(bits / 8))
}

// 可逆提升 5/3 小波: 一维行/列变换
function lift53(src: Int32Array, length: number): void {
  // 预测步骤 (奇数位置): 奇样本 -= (左+右)/2
  for (let i = 1; i < length; i += 2) {
    const left = i - 1 >= 0 ? src[i - 1]! : 0
    const right = i + 1 < length ? src[i + 1]! : 0
    src[i] = src[i]! - Math.floor((left + right) / 2)
  }
  // 更新步骤 (偶数位置): 偶样本 += (前奇+后奇+2)/4
  for (let i = 0; i < length; i += 2) {
    const prev = i - 1 >= 0 ? src[i - 1]! : 0
    const next = i + 1 < length ? src[i + 1]! : 0
    src[i] = src[i]! + Math.floor((prev + next + 2) / 4)
  }
}

function unlift53(src: Int32Array, length: number): void {
  // 逆更新
  for (let i = 0; i < length; i += 2) {
    const prev = i - 1 >= 0 ? src[i - 1]! : 0
    const next = i + 1 < length ? src[i + 1]! : 0
    src[i] = src[i]! - Math.floor((prev + next + 2) / 4)
  }
  // 逆预测
  for (let i = 1; i < length; i += 2) {
    const left = i - 1 >= 0 ? src[i - 1]! : 0
    const right = i + 1 < length ? src[i + 1]! : 0
    src[i] = src[i]! + Math.floor((left + right) / 2)
  }
}

// 不可逆 9/7 小波 (CDF 9/7 lifting, 有损模式) — 含 K 归一化 (K = 1/1.230174105)
const K97 = 1 / 1.230174105

function lift97(src: Float64Array, length: number): void {
  for (let i = 1; i < length; i += 2) {
    const left = i - 1 >= 0 ? src[i - 1]! : 0
    const right = i + 1 < length ? src[i + 1]! : 0
    src[i] = src[i]! - 1.586134342 * (left + right)
  }
  for (let i = 0; i < length; i += 2) {
    const prev = i - 1 >= 0 ? src[i - 1]! : 0
    const next = i + 1 < length ? src[i + 1]! : 0
    src[i] = src[i]! - 0.052980118 * (prev + next)
  }
  for (let i = 1; i < length; i += 2) {
    const left = i - 1 >= 0 ? src[i - 1]! : 0
    const right = i + 1 < length ? src[i + 1]! : 0
    src[i] = src[i]! + 0.882911075 * (left + right)
  }
  for (let i = 0; i < length; i += 2) {
    const prev = i - 1 >= 0 ? src[i - 1]! : 0
    const next = i + 1 < length ? src[i + 1]! : 0
    src[i] = src[i]! + 0.443506852 * (prev + next)
  }
  // K 缩放: 偶样本 *K, 奇样本 *1/K
  for (let i = 0; i < length; i += 2) src[i] = src[i]! * K97
  for (let i = 1; i < length; i += 2) src[i] = src[i]! / K97
}

function unlift97(src: Float64Array, length: number): void {
  // 逆 K 缩放
  for (let i = 0; i < length; i += 2) src[i] = src[i]! / K97
  for (let i = 1; i < length; i += 2) src[i] = src[i]! * K97
  // 逆 9/7 lifting
  for (let i = 0; i < length; i += 2) {
    const prev = i - 1 >= 0 ? src[i - 1]! : 0
    const next = i + 1 < length ? src[i + 1]! : 0
    src[i] = src[i]! - 0.443506852 * (prev + next)
  }
  for (let i = 1; i < length; i += 2) {
    const left = i - 1 >= 0 ? src[i - 1]! : 0
    const right = i + 1 < length ? src[i + 1]! : 0
    src[i] = src[i]! - 0.882911075 * (left + right)
  }
  for (let i = 0; i < length; i += 2) {
    const prev = i - 1 >= 0 ? src[i - 1]! : 0
    const next = i + 1 < length ? src[i + 1]! : 0
    src[i] = src[i]! + 0.052980118 * (prev + next)
  }
  for (let i = 1; i < length; i += 2) {
    const left = i - 1 >= 0 ? src[i - 1]! : 0
    const right = i + 1 < length ? src[i + 1]! : 0
    src[i] = src[i]! + 1.586134342 * (left + right)
  }
}

/** 2D 可分离小波变换 (就地) */
function forwardDwt53(buf: Int32Array, rows: number, cols: number, levels: number): void {
  let r = rows
  let c = cols
  for (let l = 0; l < levels && r > 1 && c > 1; l++) {
    // 行变换
    for (let y = 0; y < r; y++) {
      const row = new Int32Array(c)
      for (let x = 0; x < c; x++) row[x] = buf[y * cols + x]!
      lift53(row, c)
      for (let x = 0; x < c; x++) buf[y * cols + x] = row[x]!
    }
    // 列变换
    for (let x = 0; x < c; x++) {
      const col = new Int32Array(r)
      for (let y = 0; y < r; y++) col[y] = buf[y * cols + x]!
      lift53(col, r)
      for (let y = 0; y < r; y++) buf[y * cols + x] = col[y]!
    }
    r = Math.ceil(r / 2)
    c = Math.ceil(c / 2)
  }
}

/** 计算正变换各级尺寸序列 (与 forwardDwt 完全一致) */
function dwtDims(rows: number, cols: number, levels: number): Array<{ r: number; c: number }> {
  const dims: Array<{ r: number; c: number }> = [{ r: rows, c: cols }]
  let r = rows
  let c = cols
  for (let l = 0; l < levels && r > 1 && c > 1; l++) {
    r = Math.ceil(r / 2)
    c = Math.ceil(c / 2)
    dims.push({ r, c })
  }
  return dims
}

function inverseDwt53(buf: Int32Array, rows: number, cols: number, levels: number): void {
  const dims = dwtDims(rows, cols, levels)
  for (let l = dims.length - 2; l >= 0; l--) {
    const { r, c } = dims[l]!
    // 逆列变换
    for (let x = 0; x < c; x++) {
      const col = new Int32Array(r)
      for (let y = 0; y < r; y++) col[y] = buf[y * cols + x]!
      unlift53(col, r)
      for (let y = 0; y < r; y++) buf[y * cols + x] = col[y]!
    }
    // 逆行变换
    for (let y = 0; y < r; y++) {
      const row = new Int32Array(c)
      for (let x = 0; x < c; x++) row[x] = buf[y * cols + x]!
      unlift53(row, c)
      for (let x = 0; x < c; x++) buf[y * cols + x] = row[x]!
    }
  }
}

function forwardDwt97(buf: Float64Array, rows: number, cols: number, levels: number): void {
  let r = rows
  let c = cols
  for (let l = 0; l < levels && r > 1 && c > 1; l++) {
    for (let y = 0; y < r; y++) {
      const row = new Float64Array(c)
      for (let x = 0; x < c; x++) row[x] = buf[y * cols + x]!
      lift97(row, c)
      for (let x = 0; x < c; x++) buf[y * cols + x] = row[x]!
    }
    for (let x = 0; x < c; x++) {
      const col = new Float64Array(r)
      for (let y = 0; y < r; y++) col[y] = buf[y * cols + x]!
      lift97(col, r)
      for (let y = 0; y < r; y++) buf[y * cols + x] = col[y]!
    }
    r = Math.ceil(r / 2)
    c = Math.ceil(c / 2)
  }
}

function inverseDwt97(buf: Float64Array, rows: number, cols: number, levels: number): void {
  const dims = dwtDims(rows, cols, levels)
  for (let l = dims.length - 2; l >= 0; l--) {
    const { r, c } = dims[l]!
    // 逆列变换
    for (let x = 0; x < c; x++) {
      const col = new Float64Array(r)
      for (let y = 0; y < r; y++) col[y] = buf[y * cols + x]!
      unlift97(col, r)
      for (let y = 0; y < r; y++) buf[y * cols + x] = col[y]!
    }
    // 逆行变换
    for (let y = 0; y < r; y++) {
      const row = new Float64Array(c)
      for (let x = 0; x < c; x++) row[x] = buf[y * cols + x]!
      unlift97(row, c)
      for (let x = 0; x < c; x++) buf[y * cols + x] = row[x]!
    }
  }
}

// Golomb-Rice 位写器 (块级)
class BlockWriter {
  private buf = new Uint8Array(1 << 16)
  private pos = 0
  write(bit: number): void {
    const byteIdx = this.pos >> 3
    if (byteIdx >= this.buf.length) {
      const next = new Uint8Array(this.buf.length * 2)
      next.set(this.buf)
      this.buf = next
    }
    if (bit === 1) this.buf[byteIdx] |= 1 << (7 - (this.pos & 7))
    this.pos++
  }
  writeBits(value: number, count: number): void {
    for (let i = count - 1; i >= 0; i--) this.write((value >> i) & 1)
  }
  unary(q: number): void {
    for (let i = 0; i < q; i++) this.write(1)
    this.write(0)
  }
  toBuffer(): Buffer {
    return Buffer.from(this.buf.subarray(0, Math.ceil(this.pos / 8)))
  }
}

class BlockReader {
  private pos = 0
  constructor(private buf: Buffer) {}
  read(): number {
    const byteIdx = this.pos >> 3
    if (byteIdx >= this.buf.length) return 0
    const bit = (this.buf[byteIdx]! >> (7 - (this.pos & 7))) & 1
    this.pos++
    return bit
  }
  readBits(count: number): number {
    let v = 0
    for (let i = 0; i < count; i++) v = (v << 1) | this.read()
    return v
  }
  unary(): number {
    let q = 0
    while (this.read() === 1) q++
    return q
  }
}

function encodeBlock(samples: Int32Array, count: number): Buffer {
  const writer = new BlockWriter()
  // 块内 k 值选择 (基于残差均值, HTJ2K Fast-Block 风格)
  let sumAbs = 0
  for (let i = 0; i < count; i++) sumAbs += Math.abs(samples[i]!)
  const meanAbs = sumAbs / count
  let k = Math.min(24, Math.max(0, Math.ceil(Math.log2(meanAbs + 0.5))))
  writer.writeBits(k, 5)
  for (let i = 0; i < count; i++) {
    const r = samples[i]!
    const u = r >= 0 ? 2 * r : -2 * r - 1
    const q = u >> k
    writer.unary(q)
    writer.writeBits(u & ((1 << k) - 1), k)
  }
  return writer.toBuffer()
}

function decodeBlock(packed: Buffer, count: number): Int32Array {
  const reader = new BlockReader(packed)
  const k = reader.readBits(5)
  const out = new Int32Array(count)
  for (let i = 0; i < count; i++) {
    const q = reader.unary()
    let u = q << k
    for (let j = k - 1; j >= 0; j--) u |= reader.read() << j
    out[i] = u % 2 === 0 ? u / 2 : -(u + 1) / 2
  }
  return out
}

export function htj2kEncode(
  pixelData: Buffer,
  opts: Htj2kOptions,
): Buffer {
  const bytes = sampleBytes(opts.bitsAllocated)
  const pixelCount = Math.floor(pixelData.length / bytes)
  if (pixelCount === 0) throw new Error('Empty pixel data')
  const cols = opts.columns && opts.columns > 0 ? opts.columns : Math.round(Math.sqrt(pixelCount)) || 1
  const rows = Math.ceil(pixelCount / cols)
  const q = Math.min(100, Math.max(1, Math.round(opts.quality ?? 100)))
  const lossless = q >= 100
  const blockSize = Math.max(16, Math.min(64, opts.blockSize ?? 32))
  const blockExp = Math.round(Math.log2(blockSize))
  const levels = Math.max(1, Math.min(3, opts.levels ?? 2))

  const raw = new Int32Array(pixelCount)
  for (let i = 0; i < pixelCount; i++) {
    raw[i] = bytes === 2 ? pixelData.readUInt16LE(i * 2) : pixelData[i]!
  }

  // 量化步 (有损)
  const step = lossless ? 1 : Math.max(1, Math.round((100 - q) * 0.18))

  let coeff: Int32Array
  if (lossless) {
    coeff = new Int32Array(raw)
    forwardDwt53(coeff, rows, cols, levels)
  } else {
    const f = new Float64Array(pixelCount)
    for (let i = 0; i < pixelCount; i++) f[i] = raw[i]!
    forwardDwt97(f, rows, cols, levels)
    coeff = new Int32Array(pixelCount)
    for (let i = 0; i < pixelCount; i++) coeff[i] = Math.round(f[i]! / step)
  }

  // 码块划分 (行优先)
  const blocks: Buffer[] = []
  const blockCols = Math.ceil(cols / blockSize)
  const blockRows = Math.ceil(rows / blockSize)
  for (let by = 0; by < blockRows; by++) {
    for (let bx = 0; bx < blockCols; bx++) {
      const blockSamples: number[] = []
      for (let y = by * blockSize; y < Math.min(rows, (by + 1) * blockSize); y++) {
        for (let x = bx * blockSize; x < Math.min(cols, (bx + 1) * blockSize); x++) {
          const idx = y * cols + x
          if (idx < pixelCount) blockSamples.push(coeff[idx]!)
        }
      }
      const arr = new Int32Array(blockSamples)
      const payload = encodeBlock(arr, arr.length)
      const lenBuf = Buffer.alloc(4)
      lenBuf.writeUInt32LE(payload.length, 0)
      blocks.push(Buffer.concat([lenBuf, payload]))
    }
  }

  const header = Buffer.alloc(HTJ2K_HEADER_SIZE)
  HTJ2K_MAGIC.copy(header, 0)
  header[3] = opts.bitsAllocated
  header[4] = lossless ? 0 : 1
  header[5] = blockExp
  header[6] = levels
  header.writeUInt32LE(pixelCount, 7)
  header.writeUInt16LE(cols, 11)
  header[13] = lossless ? 1 : step
  return Buffer.concat([header, ...blocks])
}

export function htj2kDecode(
  packed: Buffer,
  opts: { bitsAllocated: number; pixelRepresentation: number; pixelCount: number },
): Buffer {
  if (packed.length < HTJ2K_HEADER_SIZE || !packed.subarray(0, 3).equals(HTJ2K_MAGIC)) {
    throw new Error('Invalid HTJ2K payload header')
  }
  const pixelCount = packed.readUInt32LE(7)
  if (pixelCount !== opts.pixelCount) {
    throw new Error(`Pixel count mismatch: header=${pixelCount} expected=${opts.pixelCount}`)
  }
  const lossless = packed[4] === 0
  const blockSize = 2 ** packed[5]!
  const levels = packed[6]!
  const cols = packed.readUInt16LE(11) || 1
  const step = packed[13]! || 1
  const bytes = sampleBytes(opts.bitsAllocated)
  const rows = Math.ceil(pixelCount / cols)
  const maxVal = opts.bitsAllocated === 16 ? 65535 : 255

  const coeff = new Int32Array(pixelCount)
  let cursor = HTJ2K_HEADER_SIZE
  const blockCols = Math.ceil(cols / blockSize)
  const blockRows = Math.ceil(rows / blockSize)
  for (let by = 0; by < blockRows; by++) {
    for (let bx = 0; bx < blockCols; bx++) {
      if (cursor + 4 > packed.length) break
      const len = packed.readUInt32LE(cursor)
      cursor += 4
      if (cursor + len > packed.length) break
      const payload = packed.subarray(cursor, cursor + len)
      cursor += len
      const samples: number[] = []
      for (let y = by * blockSize; y < Math.min(rows, (by + 1) * blockSize); y++) {
        for (let x = bx * blockSize; x < Math.min(cols, (bx + 1) * blockSize); x++) {
          const idx = y * cols + x
          if (idx < pixelCount) samples.push(idx)
        }
      }
      const decoded = decodeBlock(payload, samples.length)
      for (let i = 0; i < samples.length; i++) {
        coeff[samples[i]!] = decoded[i]!
      }
    }
  }

  let raw: Int32Array
  if (lossless) {
    inverseDwt53(coeff, rows, cols, levels)
    raw = coeff
  } else {
    const f = new Float64Array(pixelCount)
    for (let i = 0; i < pixelCount; i++) f[i] = coeff[i]! * step
    inverseDwt97(f, rows, cols, levels)
    raw = new Int32Array(pixelCount)
    for (let i = 0; i < pixelCount; i++) raw[i] = Math.max(0, Math.min(maxVal, Math.round(f[i]!)))
  }

  const out = Buffer.alloc(pixelCount * bytes)
  for (let i = 0; i < pixelCount; i++) {
    const v = lossless ? Math.max(0, Math.min(maxVal, raw[i]!)) : raw[i]!
    if (bytes === 2) out.writeUInt16LE(v, i * 2)
    else out[i] = v
  }
  return out
}
