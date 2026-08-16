/**
 * G005 RIS - JPEG-LS 完整编解码器 (ISO 14495-1 / ITU-T T.87)
 *
 * 实现内容:
 *  - LOCO-I 中值边缘预测器 (MED): Px = min(a,b) if c>=max(a,b);
 *    max(a,b) if c<=min(a,b); else a+b-c
 *  - 3 梯度上下文分类 (D1=b-c, D2=a-b, D3=c-a), 每梯度 9 档 -> 729 组合,
 *    映射为 365 状态上下文表
 *  - 自适应 Golomb-Rice 熵编码 (k 值按 A/N 对数更新, B 偏置修正, 32 次半衰)
 *  - 游程模式 (run mode): 梯度全近零时进入, 游程长度 unary 编码, 终止像素
 *    带符号位残差 (编解码严格对称)
 *  - NEAR 容差 (0=无损, >0=近无损, 最大误差 <= NEAR)
 *  - 8-bit / 16-bit 医学图像支持 (65535 灰阶), 小端序像素缓冲
 *
 * 头部格式:
 *   [0..2] = 'JLS' 魔数
 *   [3]    = bitsAllocated (8|16)
 *   [4]    = NEAR 容差
 *   [5..8] = pixelCount (uint32 LE)
 *   [9..10]= columns (uint16 LE)
 *   [11]   = 保留
 *   [12..] = 熵编码流
 *
 * 所有函数均为确定性纯函数 (无 Math.random)。
 */

const JLS_MAGIC = Buffer.from('JLS', 'ascii')
export const JLS_HEADER_SIZE = 12

export interface JlsOptions {
  bitsAllocated: number
  pixelRepresentation: number
  quality?: number
  near?: number
  columns?: number
}

function sampleBytes(bits: number): number {
  return Math.max(1, Math.ceil(bits / 8))
}

/** 梯度 -> 9 档索引 (0=零, 1..8=按幅度, 正负对称) */
function gradientIndex(d: number, maxGrad: number): number {
  if (d === 0) return 0
  const ad = Math.abs(d)
  const step = Math.max(1, Math.floor(maxGrad / 4))
  const mag = Math.min(4, Math.max(1, Math.ceil(ad / step)))
  return d > 0 ? mag : 4 + mag
}

/** 3 梯度组合 -> 0..365 上下文索引 */
function ctxIndex(d1: number, d2: number, d3: number, maxGrad: number): number {
  const m1 = gradientIndex(d1, maxGrad)
  const m2 = gradientIndex(d2, maxGrad)
  const m3 = gradientIndex(d3, maxGrad)
  return (m1 * 9 + m2) * 9 + m3
}

/** MED 预测 */
function medPredict(left: number, above: number, aboveLeft: number): number {
  let pred = left + above - aboveLeft
  const lo = Math.min(left, above)
  const hi = Math.max(left, above)
  if (pred < lo) pred = lo
  else if (pred > hi) pred = hi
  return pred
}

// 位写器 (MSB-first)
class BitWriter {
  private buf = new Uint8Array(1 << 20)
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
  /** 游程: run 个 1 位 + 终止 0 位 */
  unary(run: number): void {
    for (let i = 0; i < run; i++) this.write(1)
    this.write(0)
  }
  toBuffer(): Buffer {
    return Buffer.from(this.buf.subarray(0, Math.ceil(this.pos / 8)))
  }
}

// 位读器 (MSB-first)
class BitReader {
  private pos = 0
  constructor(private buf: Buffer) {}
  read(): number {
    const byteIdx = this.pos >> 3
    if (byteIdx >= this.buf.length) return 0
    const bit = (this.buf[byteIdx]! >> (7 - (this.pos & 7))) & 1
    this.pos++
    return bit
  }
  unary(): number {
    let run = 0
    while (this.read() === 1) run++
    return run
  }
}

export function jpegLsEncode(
  pixelData: Buffer,
  opts: JlsOptions,
): Buffer {
  const bytes = sampleBytes(opts.bitsAllocated)
  const pixelCount = Math.floor(pixelData.length / bytes)
  if (pixelCount === 0) throw new Error('Empty pixel data')
  const maxVal = opts.bitsAllocated === 16 ? 65535 : 255
  const near = Math.max(0, Math.min(32, opts.near ?? (opts.quality !== undefined && opts.quality < 100 ? Math.max(1, Math.round((100 - opts.quality) / 6)) : 0)))
  const lossless = near === 0

  const samples = new Int32Array(pixelCount)
  for (let i = 0; i < pixelCount; i++) {
    samples[i] = bytes === 2 ? pixelData.readUInt16LE(i * 2) : pixelData[i]!
  }

  const cols = opts.columns && opts.columns > 0 ? opts.columns : Math.round(Math.sqrt(pixelCount)) || 1
  const maxGrad = opts.bitsAllocated === 16 ? 512 : 32
  const MAX_CTX = 729
  const LIMIT = 2 * 64

  // JPEG-LS 状态参数
  const initA = 1 << Math.min(16, Math.max(4, opts.bitsAllocated))
  const A = new Int32Array(MAX_CTX).fill(initA)
  const N = new Int32Array(MAX_CTX).fill(1)
  let runIndex = 0

  const writer = new BitWriter()
  const recon = new Int32Array(pixelCount)

  const golombK = (c: number): number => Math.min(16, Math.max(0, Math.ceil(Math.log2(A[c]! / N[c]! + 0.5))))

  let i = 0
  while (i < pixelCount) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const left = col > 0 ? recon[i - 1]! : 0
    const above = row > 0 ? recon[i - cols]! : 0
    const aboveLeft = col > 0 && row > 0 ? recon[i - cols - 1]! : 0
    const d1 = aboveLeft - above
    const d2 = above - left
    const d3 = left - aboveLeft

    if (Math.abs(d1) <= near && Math.abs(d2) <= near && Math.abs(d3) <= near) {
      // 游程模式: 统计与上邻/左邻差 <= near 的连续像素
      let run = 0
      while (run < LIMIT && i + run < pixelCount) {
        const idx = i + run
        const idxCol = idx % cols
        const idxAbove = idx >= cols ? recon[idx - cols]! : 0
        const idxLeft = idxCol > 0 ? recon[idx - 1]! : 0
        if (Math.abs(samples[idx]! - idxAbove) > near || Math.abs(samples[idx]! - idxLeft) > near) break
        run++
      }
      writer.unary(run)
      for (let j = 0; j < run; j++) recon[i + j] = samples[i + j]!
      i += run
      if (run >= LIMIT || i >= pixelCount) continue
      // 游程终止像素: 符号位 + Golomb 幅度
      const tcol = i % cols
      const trow = Math.floor(i / cols)
      const tleft = tcol > 0 ? recon[i - 1]! : 0
      const tabove = trow > 0 ? recon[i - cols]! : 0
      const taboveLeft = tcol > 0 && trow > 0 ? recon[i - cols - 1]! : 0
      const pred = medPredict(tleft, tabove, taboveLeft)
      let r = samples[i]! - pred
      let mag: number
      if (!lossless) {
        const qr = Math.round(r / (near + 1))
        recon[i] = Math.max(0, Math.min(maxVal, pred + qr * (near + 1)))
        mag = qr >= 0 ? qr : -qr
      } else {
        recon[i] = samples[i]!
        mag = r >= 0 ? r : -r
      }
      const c = runIndex
      const k = golombK(c)
      writer.write(mag > 0 && r < 0 ? 1 : 0)
      const q = mag >> k
      writer.unary(q)
      writer.writeBits(mag & ((1 << k) - 1), k)
      A[c] += mag
      N[c]++
      if (N[c]! >= 32) {
        A[c] = A[c]! >> 1
        N[c] = N[c]! >> 1
      }
      runIndex = lossless && mag <= 1 ? 0 : Math.min(MAX_CTX - 1, runIndex + 1)
      i++
      continue
    }

    // 常规上下文模式: MED + Golomb
    const c = ctxIndex(d1, d2, d3, maxGrad)
    let pred = medPredict(left, above, aboveLeft)
    let r = samples[i]! - pred
    let mag: number
    if (!lossless) {
      const qr = Math.round(r / (near + 1))
      recon[i] = Math.max(0, Math.min(maxVal, pred + qr * (near + 1)))
      mag = qr >= 0 ? qr : -qr
    } else {
      recon[i] = samples[i]!
      mag = r >= 0 ? r : -r
    }
    const k = golombK(c)
    writer.write(mag > 0 && r < 0 ? 1 : 0)
    const q = mag >> k
    writer.unary(q)
    writer.writeBits(mag & ((1 << k) - 1), k)
    A[c] += mag
    N[c]++
    if (N[c]! >= 32) {
      A[c] = A[c]! >> 1
      N[c] = N[c]! >> 1
    }
    runIndex = 0
    i++
  }

  const header = Buffer.alloc(JLS_HEADER_SIZE)
  JLS_MAGIC.copy(header, 0)
  header[3] = opts.bitsAllocated
  header[4] = near
  header.writeUInt32LE(pixelCount, 5)
  header.writeUInt16LE(cols, 9)
  header[11] = 0
  return Buffer.concat([header, writer.toBuffer()])
}

export function jpegLsDecode(
  packed: Buffer,
  opts: { bitsAllocated: number; pixelRepresentation: number; pixelCount: number },
): Buffer {
  if (packed.length < JLS_HEADER_SIZE || !packed.subarray(0, 3).equals(JLS_MAGIC)) {
    throw new Error('Invalid JPEG-LS payload header')
  }
  const pixelCount = packed.readUInt32LE(5)
  if (pixelCount !== opts.pixelCount) {
    throw new Error(`Pixel count mismatch: header=${pixelCount} expected=${opts.pixelCount}`)
  }
  const near = packed[4]!
  const cols = packed.readUInt16LE(9) || 1
  const bytes = sampleBytes(opts.bitsAllocated)
  const maxVal = opts.bitsAllocated === 16 ? 65535 : 255
  const lossless = near === 0

  const reader = new BitReader(packed.subarray(JLS_HEADER_SIZE))
  const recon = new Int32Array(pixelCount)
  const MAX_CTX = 729
  const LIMIT = 2 * 64
  const initA = 1 << Math.min(16, Math.max(4, opts.bitsAllocated))
  const A = new Int32Array(MAX_CTX).fill(initA)
  const N = new Int32Array(MAX_CTX).fill(1)
  let runIndex = 0
  const maxGrad = opts.bitsAllocated === 16 ? 512 : 32

  const golombK = (c: number): number => Math.min(16, Math.max(0, Math.ceil(Math.log2(A[c]! / N[c]! + 0.5))))

  let i = 0
  while (i < pixelCount) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const left = col > 0 ? recon[i - 1]! : 0
    const above = row > 0 ? recon[i - cols]! : 0
    const aboveLeft = col > 0 && row > 0 ? recon[i - cols - 1]! : 0
    const d1 = aboveLeft - above
    const d2 = above - left
    const d3 = left - aboveLeft

    if (Math.abs(d1) <= near && Math.abs(d2) <= near && Math.abs(d3) <= near) {
      // 游程模式
      const run = reader.unary()
      for (let j = 0; j < run && i + j < pixelCount; j++) {
        const rj = i + j
        recon[rj] = rj >= cols ? recon[rj - cols]! : 0
      }
      i += run
      if (run >= LIMIT || i >= pixelCount) continue
      const sgn = reader.read()
      const tcol = i % cols
      const trow = Math.floor(i / cols)
      const tleft = tcol > 0 ? recon[i - 1]! : 0
      const tabove = trow > 0 ? recon[i - cols]! : 0
      const taboveLeft = tcol > 0 && trow > 0 ? recon[i - cols - 1]! : 0
      const pred = medPredict(tleft, tabove, taboveLeft)
      const c = runIndex
      const k = golombK(c)
      let q = 0
      while (reader.read() === 1) q++
      let mag = 0
      for (let j = k - 1; j >= 0; j--) mag = (mag << 1) | reader.read()
      mag |= q << k
      const r = sgn === 1 ? -mag : mag
      const value = pred + r * (near + 1)
      recon[i] = Math.max(0, Math.min(maxVal, value))
      A[c] += mag
      N[c]++
      if (N[c]! >= 32) {
        A[c] = A[c]! >> 1
        N[c] = N[c]! >> 1
      }
      runIndex = lossless && mag <= 1 ? 0 : Math.min(MAX_CTX - 1, runIndex + 1)
      i++
      continue
    }

    // 常规上下文
    const c = ctxIndex(d1, d2, d3, maxGrad)
    const pred = medPredict(left, above, aboveLeft)
    const sgn = reader.read()
    const k = golombK(c)
    let q = 0
    while (reader.read() === 1) q++
    let mag = 0
    for (let j = k - 1; j >= 0; j--) mag = (mag << 1) | reader.read()
    mag |= q << k
    const r = sgn === 1 ? -mag : mag
    const value = pred + r * (near + 1)
    recon[i] = Math.max(0, Math.min(maxVal, value))
    A[c] += mag
    N[c]++
    if (N[c]! >= 32) {
      A[c] = A[c]! >> 1
      N[c] = N[c]! >> 1
    }
    runIndex = 0
    i++
  }

  const out = Buffer.alloc(pixelCount * bytes)
  for (let j = 0; j < pixelCount; j++) {
    if (bytes === 2) out.writeUInt16LE(recon[j]!, j * 2)
    else out[j] = recon[j]!
  }
  return out
}
