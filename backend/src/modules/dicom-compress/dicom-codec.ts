/**
 * G005 RIS - DICOM 真实压缩编解码器 (纯 Node 实现 + OpenJPEG WASM, 确定性输出)
 *
 * 对标全厂商 JPEG2000 / HTJ2K 传输语法:
 *  - JPEG2000 (1.2.840.10008.1.2.4.90): OpenJPEG WASM 真编解码 (jpeg2000.ts),
 *    产生 DICOM 同款裸 J2K codestream, 无损 (quality=100)。source = 'real'。
 *  - RLE (1.2.840.10008.1.2.5): DICOM PS3.5 A.4.2 风格游程编码, 无损。
 *    16-bit 像素按 MSB 平面在前拆分为多个字节平面, 每平面独立游程编码,
 *    64 字节段偏移表头 (16 x uint32 LE)。source = 'rle-approx'。
 *  - Predictive (1.2.840.10008.1.2.4.91/.81/.50): LOCO-I 中值边缘预测器
 *    (JPEG-LS 核心预测) + Golomb-Rice 熵编码 (HTJ2K Fast-Block 风格),
 *    无损 (quality=100) / 有损 (quality<100, 死区量化器, step 随 quality 缩放)。
 *    属于 JPEG-LS 风格近似编码, source = 'rle-approx'。
 *
 * 所有函数均为确定性纯函数: 相同输入 => 相同输出 (无 Math.random)。
 */

import { jpeg2000Encode, jpeg2000Decode } from './jpeg2000'

export interface ParsedDicom {
  rows: number
  columns: number
  bitsAllocated: number
  pixelRepresentation: number
  samplesPerPixel: number
  pixelData: Buffer
  transferSyntax: string
  modality: string
  sopClassUid: string
  instanceNumber: number
  fileSize: number
}

export type CodecKind = 'rle' | 'predictive' | 'jpeg2000'

/**
 * 编码结果来源标注:
 *  - real      : OpenJPEG WASM 真 JPEG2000 码流
 *  - rle-approx: RLE / LOCO-I 真实字节流编码 (JPEG-LS 风格近似)
 *  - estimated : 查表估算回退 (文件不可达时)
 */
export type CodecSource = 'real' | 'rle-approx' | 'estimated'

export interface CodecMeta {
  kind: CodecKind
  lossless: boolean
  quality: number
  bitsAllocated: number
  pixelRepresentation: number
  rows: number
  columns: number
  pixelCount: number
  samplesPerPixel: number
  source: CodecSource
}

const LONG_VR = new Set(['OB', 'OD', 'OF', 'OL', 'OW', 'SQ', 'UC', 'UN', 'UR', 'UT'])

// ────────────────────────────────────────────────────────────────────────────
// DICOM Part 10 解析 (Explicit VR LE / Implicit VR LE)
// ────────────────────────────────────────────────────────────────────────────

export function parseDicomPart10(buf: Buffer): ParsedDicom {
  if (buf.length < 132 || buf.toString('ascii', 128, 132) !== 'DICM') {
    throw new Error('Not a DICOM Part 10 file (missing DICM magic)')
  }
  const out: ParsedDicom = {
    rows: 0,
    columns: 0,
    bitsAllocated: 8,
    pixelRepresentation: 0,
    samplesPerPixel: 1,
    pixelData: Buffer.alloc(0),
    transferSyntax: '1.2.840.10008.1.2',
    modality: '',
    sopClassUid: '',
    instanceNumber: 0,
    fileSize: buf.length,
  }
  let offset = 132
  const readStr = (v: Buffer): string => v.toString('ascii').replace(/\0/g, '').trim()
  while (offset + 8 <= buf.length) {
    const group = buf.readUInt16LE(offset)
    const elem = buf.readUInt16LE(offset + 2)
    if (group === 0xfffe) break
    let length = 0
    let dataStart = 0
    const c = buf[offset + 4]
    if (c >= 0x41 && c <= 0x7a) {
      const vr = buf.toString('ascii', offset + 4, offset + 6)
      if (LONG_VR.has(vr)) {
        length = buf.readUInt32LE(offset + 8)
        dataStart = offset + 12
      } else {
        length = buf.readUInt16LE(offset + 6)
        dataStart = offset + 8
      }
    } else {
      length = buf.readUInt32LE(offset + 4)
      dataStart = offset + 8
    }
    if (length === 0xffffffff) {
      offset += 8
      continue
    }
    if (dataStart + length > buf.length) break
    const value = buf.subarray(dataStart, dataStart + length)
    if (group === 0x0002 && elem === 0x0010) {
      out.transferSyntax = readStr(value) || out.transferSyntax
    } else if (group === 0x0008 && elem === 0x0060) {
      out.modality = readStr(value)
    } else if (group === 0x0008 && elem === 0x0016) {
      out.sopClassUid = readStr(value)
    } else if (group === 0x0020 && elem === 0x0013) {
      out.instanceNumber = Number(readStr(value)) || 0
    } else if (group === 0x0028) {
      if (elem === 0x0002) out.samplesPerPixel = value.readUInt16LE(0)
      else if (elem === 0x0010) out.rows = value.readUInt16LE(0)
      else if (elem === 0x0011) out.columns = value.readUInt16LE(0)
      else if (elem === 0x0100) out.bitsAllocated = value.readUInt16LE(0)
      else if (elem === 0x0103) out.pixelRepresentation = value.readUInt16LE(0)
    } else if (group === 0x7fe0 && elem === 0x0010) {
      out.pixelData = Buffer.from(value)
    }
    offset = dataStart + length
    if (length % 2 !== 0) offset++
  }
  if (out.rows === 0 || out.columns === 0 || out.pixelData.length === 0) {
    throw new Error('Missing Rows/Columns/PixelData')
  }
  return out
}

// ────────────────────────────────────────────────────────────────────────────
// RLE 游程编码 (DICOM RLE 语义)
//  段标记 m: m>=0x80 => 重复 (m&0x7f) 次下一字节 (2..127); m<0x80 => 跟随 m 个字面字节 (1..127)
// ────────────────────────────────────────────────────────────────────────────

function rlePlane(plane: Buffer): Buffer {
  const out: number[] = []
  const n = plane.length
  let i = 0
  while (i < n) {
    let run = 1
    while (i + run < n && run < 127 && plane[i + run] === plane[i]) run++
    if (run >= 2) {
      out.push(0x80 | run, plane[i])
      i += run
    } else {
      let end = Math.min(i + 127, n)
      let j = i + 1
      while (j < end && !(plane[j] === plane[j - 1])) j++
      end = j
      out.push(end - i)
      for (let k = i; k < end; k++) out.push(plane[k])
      i = end
    }
  }
  return Buffer.from(out)
}

function rleUnplane(packed: Buffer): Buffer {
  const out: number[] = []
  let i = 0
  const n = packed.length
  while (i < n) {
    const m = packed[i]!
    i++
    if (m >= 0x80) {
      const count = m & 0x7f
      const byte = i < n ? packed[i]! : 0
      for (let k = 0; k < count; k++) out.push(byte)
      i++
    } else {
      const lit = Math.min(m, n - i)
      for (let k = 0; k < lit; k++) out.push(packed[i++]!)
    }
  }
  return Buffer.from(out)
}

export function rleEncode(pixelData: Buffer, bitsAllocated: number): Buffer {
  const bytesPerSample = Math.max(1, Math.ceil(bitsAllocated / 8))
  const planeCount = bytesPerSample
  const samples = Math.floor(pixelData.length / planeCount)
  const planes: Buffer[] = []
  if (planeCount === 1) {
    planes.push(pixelData)
  } else {
    // DICOM RLE: 最高位字节平面在前 ([MSB, ..., LSB])
    const raw: Buffer[] = []
    for (let p = 0; p < planeCount; p++) raw.push(Buffer.alloc(samples))
    for (let s = 0; s < samples; s++) {
      for (let p = 0; p < planeCount; p++) {
        raw[planeCount - 1 - p]![s] = pixelData[s * planeCount + p]!
      }
    }
    planes.push(...raw)
  }
  const segments = planes.map(p => rlePlane(p))
  const header = Buffer.alloc(64)
  let cursor = 64
  for (let i = 0; i < segments.length; i++) {
    if (i < 14) header.writeUInt32LE(cursor, i * 4)
    cursor += segments[i].length
  }
  const body = Buffer.concat(segments)
  header.writeUInt32LE(body.length, 60)
  const pad = body.length % 2 !== 0 ? Buffer.from([0]) : Buffer.alloc(0)
  return Buffer.concat([header, body, pad])
}

export function rleDecode(packed: Buffer, outSizeBytes: number): Buffer {
  if (packed.length < 64) throw new Error('RLE payload too short')
  const bodyLength = packed.readUInt32LE(60)
  const offsets: number[] = []
  for (let i = 0; i < 14; i++) {
    const off = packed.readUInt32LE(i * 4)
    if (off >= 64 && off < packed.length) offsets.push(off)
  }
  if (offsets.length === 0) offsets.push(64)
  const bodyEnd = bodyLength > 0 && 64 + bodyLength <= packed.length ? 64 + bodyLength : packed.length
  const bounds = [...offsets, bodyEnd]
  const planes: Buffer[] = []
  for (let s = 0; s < bounds.length - 1; s++) {
    const start = bounds[s]!
    const end = bounds[s + 1]!
    if (start >= end) continue
    planes.push(rleUnplane(packed.subarray(start, end)))
  }
  if (planes.length === 0) throw new Error('RLE payload has no segments')
  const planeCount = planes.length
  const out = Buffer.alloc(outSizeBytes)
  const samples = Math.floor(outSizeBytes / planeCount)
  for (let s = 0; s < samples; s++) {
    for (let p = 0; p < planeCount; p++) {
      const plane = planes[planeCount - 1 - p]!
      if (s < plane.length) {
        out[s * planeCount + p] = plane[s]!
      }
    }
  }
  return out
}

// ────────────────────────────────────────────────────────────────────────────
// Predictive: LOCO-I 中值边缘预测 + Golomb-Rice 熵编码
//  头部: [0..2]='GR1' [3]=bitsAllocated [4]=quality [5..6]=step(LE) [7]=k [8..11]=pixelCount(LE)
// ────────────────────────────────────────────────────────────────────────────

const MAGIC = Buffer.from('GR1', 'ascii')
const HEADER_SIZE = 12

function qualityToStep(quality: number): number {
  const q = Math.min(100, Math.max(1, Math.round(quality)))
  if (q >= 100) return 1
  return Math.max(1, Math.round((100 - q) * 0.6))
}

function sampleBytes(bitsAllocated: number): number {
  return Math.max(1, Math.ceil(bitsAllocated / 8))
}

export function predictiveEncode(
  pixelData: Buffer,
  opts: { bitsAllocated: number; pixelRepresentation: number; quality: number },
): Buffer {
  const bytes = sampleBytes(opts.bitsAllocated)
  const pixelCount = Math.floor(pixelData.length / bytes)
  if (pixelCount === 0) throw new Error('Empty pixel data')
  const samples = new Int32Array(pixelCount)
  for (let i = 0; i < pixelCount; i++) {
    samples[i] = bytes === 2 ? pixelData.readUInt16LE(i * 2) : pixelData[i]!
  }
  const cols = Math.round(Math.sqrt(pixelCount)) || 1
  const step = qualityToStep(opts.quality)
  const lossless = step === 1

  const recon = new Int32Array(pixelCount)
  const residuals = new Int32Array(pixelCount)
  let sumAbs = 0
  let maxQ = 0
  for (let i = 0; i < pixelCount; i++) {
    const col = i % cols
    const left = col > 0 ? recon[i - 1]! : 0
    const above = i >= cols ? recon[i - cols]! : 0
    const aboveLeft = col > 0 && i >= cols ? recon[i - cols - 1]! : 0
    let pred = left + above - aboveLeft
    const lo = Math.min(left, above)
    const hi = Math.max(left, above)
    if (pred < lo) pred = lo
    else if (pred > hi) pred = hi
    const x = samples[i]!
    let r: number
    if (lossless) {
      r = x - pred
      recon[i] = x
    } else {
      const qr = Math.round((x - pred) / step)
      r = qr
      recon[i] = pred + qr * step
    }
    residuals[i] = r
    sumAbs += Math.abs(r)
    const u = r >= 0 ? 2 * r : -2 * r - 1
    if (u > maxQ) maxQ = u
  }
  const meanAbs = sumAbs / pixelCount
  const k = Math.min(24, Math.max(0, Math.ceil(Math.log2(meanAbs + 0.5))))

  let totalBits = 0
  for (let i = 0; i < pixelCount; i++) {
    const r = residuals[i]!
    const u = r >= 0 ? 2 * r : -2 * r - 1
    totalBits += (u >> k) + 1 + k
  }
  const bitBuf = new Uint8Array(Math.max(16, Math.ceil(totalBits / 8)))
  let bitPos = 0
  const writeBit = (bit: number): void => {
    const byteIdx = bitPos >> 3
    const bitOffset = 7 - (bitPos & 7)
    if (bit === 1) bitBuf[byteIdx] |= 1 << bitOffset
    bitPos++
  }
  for (let i = 0; i < pixelCount; i++) {
    const r = residuals[i]!
    const u = r >= 0 ? 2 * r : -2 * r - 1
    const q = u >> k
    for (let j = 0; j < q; j++) writeBit(1)
    writeBit(0)
    for (let j = k - 1; j >= 0; j--) writeBit((u >> j) & 1)
  }
  const bitBytes = Math.ceil(bitPos / 8)
  const stream = Buffer.from(bitBuf.subarray(0, bitBytes))

  const header = Buffer.alloc(HEADER_SIZE)
  MAGIC.copy(header, 0)
  header[3] = opts.bitsAllocated
  header[4] = Math.min(100, Math.max(1, Math.round(opts.quality)))
  header.writeUInt16LE(step, 5)
  header[7] = k
  header.writeUInt32LE(pixelCount, 8)
  return Buffer.concat([header, stream])
}

export function predictiveDecode(
  packed: Buffer,
  opts: { bitsAllocated: number; pixelRepresentation: number; quality: number; pixelCount: number },
): Buffer {
  if (packed.length < HEADER_SIZE || !packed.subarray(0, 3).equals(MAGIC)) {
    throw new Error('Invalid predictive payload header')
  }
  const pixelCount = packed.readUInt32LE(8)
  if (pixelCount !== opts.pixelCount) {
    throw new Error(`Pixel count mismatch: header=${pixelCount} expected=${opts.pixelCount}`)
  }
  const step = packed.readUInt16LE(5)
  const k = packed[7]!
  const bytes = sampleBytes(opts.bitsAllocated)
  const cols = Math.round(Math.sqrt(pixelCount)) || 1

  const recon = new Int32Array(pixelCount)
  let bitPos = HEADER_SIZE * 8
  const totalBits = packed.length * 8
  const readBit = (): number => {
    const byteIdx = bitPos >> 3
    if (byteIdx >= packed.length) return 0
    const bit = (packed[byteIdx]! >> (7 - (bitPos & 7))) & 1
    bitPos++
    return bit
  }
  for (let i = 0; i < pixelCount; i++) {
    const col = i % cols
    const left = col > 0 ? recon[i - 1]! : 0
    const above = i >= cols ? recon[i - cols]! : 0
    const aboveLeft = col > 0 && i >= cols ? recon[i - cols - 1]! : 0
    let pred = left + above - aboveLeft
    const lo = Math.min(left, above)
    const hi = Math.max(left, above)
    if (pred < lo) pred = lo
    else if (pred > hi) pred = hi
    let q = 0
    while (bitPos < totalBits && readBit() === 1) q++
    let u = 0
    for (let j = k - 1; j >= 0; j--) u = (u << 1) | readBit()
    const mapped = (q << k) | u
    const r = mapped % 2 === 0 ? mapped / 2 : -(mapped + 1) / 2
    const x = pred + r * step
    recon[i] = Math.max(0, Math.min(65535, x))
  }

  const out = Buffer.alloc(pixelCount * bytes)
  for (let i = 0; i < pixelCount; i++) {
    if (bytes === 2) out.writeUInt16LE(recon[i]!, i * 2)
    else out[i] = recon[i]!
  }
  return out
}

// ────────────────────────────────────────────────────────────────────────────
// 高层入口: 按传输语法压缩/解压 (确定性; jpeg2000 走 OpenJPEG WASM)
// ────────────────────────────────────────────────────────────────────────────

export async function compressPixelData(
  pixelData: Buffer,
  meta: Pick<ParsedDicom, 'bitsAllocated' | 'pixelRepresentation' | 'rows' | 'columns' | 'samplesPerPixel'>,
  codec: { kind: CodecKind; quality: number },
): Promise<Buffer> {
  if (codec.kind === 'rle') {
    return rleEncode(pixelData, meta.bitsAllocated)
  }
  if (codec.kind === 'jpeg2000') {
    return jpeg2000Encode(pixelData, {
      rows: meta.rows,
      columns: meta.columns,
      bitsAllocated: meta.bitsAllocated,
      pixelRepresentation: meta.pixelRepresentation,
      samplesPerPixel: meta.samplesPerPixel,
    })
  }
  return predictiveEncode(pixelData, {
    bitsAllocated: meta.bitsAllocated,
    pixelRepresentation: meta.pixelRepresentation,
    quality: codec.quality,
  })
}

export async function decompressPixelData(packed: Buffer, meta: CodecMeta): Promise<Buffer> {
  if (meta.kind === 'rle') {
    return rleDecode(packed, meta.pixelCount * sampleBytes(meta.bitsAllocated))
  }
  if (meta.kind === 'jpeg2000') {
    return jpeg2000Decode(packed, {
      rows: meta.rows,
      columns: meta.columns,
      bitsAllocated: meta.bitsAllocated,
      pixelCount: meta.pixelCount,
    })
  }
  return predictiveDecode(packed, {
    bitsAllocated: meta.bitsAllocated,
    pixelRepresentation: meta.pixelRepresentation,
    quality: meta.quality,
    pixelCount: meta.pixelCount,
  })
}

export function codecMetaFrom(
  parsed: ParsedDicom,
  codec: { kind: CodecKind; lossless: boolean; quality: number },
): CodecMeta {
  return {
    kind: codec.kind,
    lossless: codec.lossless,
    quality: codec.quality,
    bitsAllocated: parsed.bitsAllocated,
    pixelRepresentation: parsed.pixelRepresentation,
    rows: parsed.rows,
    columns: parsed.columns,
    pixelCount: Math.floor(parsed.pixelData.length / sampleBytes(parsed.bitsAllocated)),
    samplesPerPixel: parsed.samplesPerPixel,
    source: codec.kind === 'jpeg2000' ? 'real' : 'rle-approx',
  }
}
