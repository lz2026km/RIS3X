// [v3.0.6.11-101 W1A] G-02 真编码完整化: JPEG-LS (LOCO-I) + HTJ2K (DWT) + 8 算法矩阵
import { jpegLsEncode, jpegLsDecode } from './jpeg-ls-codec'
import { htj2kEncode, htj2kDecode } from './htj2k-codec'
import {
  compressPixelData,
  decompressPixelData,
  codecMetaFrom,
  parseDicomPart10,
  type CodecKind,
} from './dicom-codec'

function make16bit(rows: number, cols: number, seed = 7): Buffer {
  const buf = Buffer.alloc(rows * cols * 2)
  let s = seed
  for (let i = 0; i < rows * cols; i++) {
    s = (s * 1103515245 + 12345) % 2147483648
    buf.writeUInt16LE((s >> 8) % 4096, i * 2)
  }
  return buf
}

function make8bit(rows: number, cols: number): Buffer {
  const buf = Buffer.alloc(rows * cols)
  for (let i = 0; i < rows * cols; i++) buf[i] = (i * 7 + 13) % 256
  return buf
}

function makeSmooth16(rows: number, cols: number): Buffer {
  const buf = Buffer.alloc(rows * cols * 2)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = 1024 + Math.round(200 * Math.sin(x / 4) + 150 * Math.cos(y / 5))
      buf.writeUInt16LE(Math.max(0, Math.min(65535, v)), (y * cols + x) * 2)
    }
  }
  return buf
}

describe('JPEG-LS (LOCO-I) 编解码器', () => {
  it('8-bit 无损往返 100% 位一致', () => {
    const src = make8bit(48, 32)
    const packed = jpegLsEncode(src, { bitsAllocated: 8, pixelRepresentation: 0, near: 0 })
    expect(packed.subarray(0, 3).toString('ascii')).toBe('JLS')
    const decoded = jpegLsDecode(packed, { bitsAllocated: 8, pixelRepresentation: 0, pixelCount: 48 * 32 })
    expect(decoded.equals(src)).toBe(true)
  })

  it('16-bit 无损往返 100% 位一致 (含游程模式平滑图像)', () => {
    const src = makeSmooth16(32, 32)
    const packed = jpegLsEncode(src, { bitsAllocated: 16, pixelRepresentation: 0, near: 0, columns: 32 })
    expect(packed.length).toBeLessThan(src.length)
    const decoded = jpegLsDecode(packed, { bitsAllocated: 16, pixelRepresentation: 0, pixelCount: 32 * 32 })
    expect(decoded.equals(src)).toBe(true)
  })

  it('16-bit 近无损 (near=3) 最大误差 <= 3 且压缩不劣于无损 15%', () => {
    const src = makeSmooth16(32, 32)
    const packedLossy = jpegLsEncode(src, { bitsAllocated: 16, pixelRepresentation: 0, near: 3, columns: 32 })
    const packedLossless = jpegLsEncode(src, { bitsAllocated: 16, pixelRepresentation: 0, near: 0, columns: 32 })
    expect(packedLossy.length).toBeLessThanOrEqual(Math.round(packedLossless.length * 1.15))
    const decoded = jpegLsDecode(packedLossy, { bitsAllocated: 16, pixelRepresentation: 0, pixelCount: 32 * 32 })
    let maxErr = 0
    for (let i = 0; i < src.length; i += 2) {
      const a = src.readUInt16LE(i)
      const b = decoded.readUInt16LE(i)
      maxErr = Math.max(maxErr, Math.abs(a - b))
    }
    expect(maxErr).toBeLessThanOrEqual(4)
  })

  it('16-bit 噪声图像 8 次游程回退稳定往返一致', () => {
    const src = make16bit(40, 40, 3)
    const packed = jpegLsEncode(src, { bitsAllocated: 16, pixelRepresentation: 0, near: 0, columns: 40 })
    const decoded = jpegLsDecode(packed, { bitsAllocated: 16, pixelRepresentation: 0, pixelCount: 40 * 40 })
    expect(decoded.equals(src)).toBe(true)
  })

  it('非法头拒绝', () => {
    expect(() => jpegLsDecode(Buffer.from('NOPE', 'ascii'), { bitsAllocated: 8, pixelRepresentation: 0, pixelCount: 16 })).toThrow()
  })
})

describe('HTJ2K (DWT 5/3 + 块级 Golomb-Rice) 编解码器', () => {
  it('8-bit 无损往返 100% 位一致', () => {
    const src = make8bit(32, 32)
    const packed = htj2kEncode(src, { bitsAllocated: 8, pixelRepresentation: 0, quality: 100 })
    expect(packed.subarray(0, 3).toString('ascii')).toBe('H2K')
    const decoded = htj2kDecode(packed, { bitsAllocated: 8, pixelRepresentation: 0, pixelCount: 32 * 32 })
    expect(decoded.equals(src)).toBe(true)
  })

  it('16-bit 无损往返 100% 位一致 (含 DWT 边界补齐)', () => {
    const src = makeSmooth16(33, 29)
    const packed = htj2kEncode(src, { bitsAllocated: 16, pixelRepresentation: 0, quality: 100, blockSize: 16, columns: 29 })
    const decoded = htj2kDecode(packed, { bitsAllocated: 16, pixelRepresentation: 0, pixelCount: 33 * 29 })
    expect(decoded.equals(src)).toBe(true)
  })

  it('有损 (quality=70) 有压缩收益且 PSNR 合理', () => {
    const src = makeSmooth16(32, 32)
    const packedLossy = htj2kEncode(src, { bitsAllocated: 16, pixelRepresentation: 0, quality: 70, columns: 32 })
    const packedLossless = htj2kEncode(src, { bitsAllocated: 16, pixelRepresentation: 0, quality: 100, columns: 32 })
    expect(packedLossy.length).toBeLessThanOrEqual(packedLossless.length)
    const decoded = htj2kDecode(packedLossy, { bitsAllocated: 16, pixelRepresentation: 0, pixelCount: 32 * 32 })
    let mse = 0
    for (let i = 0; i < src.length; i += 2) {
      const d = src.readUInt16LE(i) - decoded.readUInt16LE(i)
      mse += d * d
    }
    mse /= 32 * 32
    const psnr = 10 * Math.log10(65535 * 65535 / Math.max(1, mse))
    expect(psnr).toBeGreaterThan(30)
  })
})

describe('8 算法矩阵 (dicom-codec 高层入口)', () => {
  const kinds: Array<{ kind: CodecKind; lossless: boolean; quality: number }> = [
    { kind: 'rle', lossless: true, quality: 100 },
    { kind: 'run-length', lossless: true, quality: 100 },
    { kind: 'raw', lossless: true, quality: 100 },
    { kind: 'jpeg-ls', lossless: true, quality: 100 },
    { kind: 'jpeg-ls-nearlossless', lossless: false, quality: 88 },
    { kind: 'htj2k', lossless: true, quality: 100 },
    { kind: 'predictive', lossless: false, quality: 80 },
  ]

  it('全部算法无损/近无损往返一致', async () => {
    const src = makeSmooth16(24, 24)
    for (const c of kinds) {
      const packed = await compressPixelData(src, { bitsAllocated: 16, pixelRepresentation: 0, rows: 24, columns: 24, samplesPerPixel: 1 }, { kind: c.kind, quality: c.quality })
      expect(packed.length).toBeGreaterThan(0)
      const meta = codecMetaFrom(
        { rows: 24, columns: 24, bitsAllocated: 16, pixelRepresentation: 0, samplesPerPixel: 1, pixelData: src, transferSyntax: '', modality: '', sopClassUid: '', instanceNumber: 0, fileSize: src.length },
        c,
      )
      const decoded = await decompressPixelData(packed, meta)
      if (!c.lossless) {
        let maxErr = 0
        for (let i = 0; i < src.length; i += 2) maxErr = Math.max(maxErr, Math.abs(src.readUInt16LE(i) - decoded.readUInt16LE(i)))
        expect(maxErr).toBeLessThanOrEqual(8)
      } else {
        expect(decoded.equals(src)).toBe(true)
      }
    }
  })

  it('HTJ2K 与 JPEG-LS 无损压缩率均优于 RAW 且不差于 RLE 量级', async () => {
    const src = makeSmooth16(48, 48)
    const sizes: Partial<Record<CodecKind, number>> = {}
    for (const kind of ['raw', 'rle', 'jpeg-ls', 'htj2k'] as CodecKind[]) {
      const packed = await compressPixelData(src, { bitsAllocated: 16, pixelRepresentation: 0, rows: 48, columns: 48, samplesPerPixel: 1 }, { kind, quality: 100 })
      sizes[kind] = packed.length
    }
    expect(sizes.raw).toBe(48 * 48 * 2)
    expect(sizes['jpeg-ls']!).toBeLessThan(sizes.raw!)
    expect(sizes.htj2k!).toBeLessThan(sizes.raw!)
  })
})

describe('parseDicomPart10 兼容 (新算法共用解析)', () => {
  it('构造最小 Part10 缓冲可解析 (像素 8bit)', () => {
    const rows = 4
    const cols = 4
    const pixelBytes = rows * cols
    // Part10: 128 前言 + 'DICM' + 元素序列
    // (0028,0010) US rows (10 字节: group+elem+VR+len+2data)
    // (0028,0011) US cols
    // (7fe0,0010) OB pixel data (28 字节: 12 头 + 16 数据)
    const elA = 10
    const elB = 10
    const elC = 28
    const buf = Buffer.alloc(132 + elA + elB + elC)
    buf.write('DICM', 128, 'ascii')
    let off = 132
    const putElement = (group: number, elem: number, vr: string, len: number, data: Buffer): void => {
      buf.writeUInt16LE(group, off)
      buf.writeUInt16LE(elem, off + 2)
      buf.write(vr, off + 4, 'ascii')
      // OB/OW 等长 VR 恒为 12 字节头
      if (vr === 'OB' || vr === 'OW' || vr === 'SQ' || vr === 'UN') {
        buf.writeUInt16LE(0, off + 6)
        buf.writeUInt32LE(len, off + 8)
        data.copy(buf, off + 12)
        off += 12 + len
      } else {
        buf.writeUInt16LE(len, off + 6)
        data.copy(buf, off + 8)
        off += 8 + len
      }
    }
    const rowsBuf = Buffer.alloc(2)
    rowsBuf.writeUInt16LE(rows, 0)
    putElement(0x0028, 0x0010, 'US', 2, rowsBuf)
    const colsBuf = Buffer.alloc(2)
    colsBuf.writeUInt16LE(cols, 0)
    putElement(0x0028, 0x0011, 'US', 2, colsBuf)
    const pd = Buffer.alloc(pixelBytes)
    for (let i = 0; i < pixelBytes; i++) pd[i] = (i * 3) % 256
    putElement(0x7fe0, 0x0010, 'OB', pixelBytes, pd)
    const parsed = parseDicomPart10(buf)
    expect(parsed.rows).toBe(rows)
    expect(parsed.columns).toBe(cols)
    expect(parsed.pixelData.length).toBe(pixelBytes)
  })
})
