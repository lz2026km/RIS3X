import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  parseDicomPart10,
  rleEncode,
  rleDecode,
  predictiveEncode,
  predictiveDecode,
  compressPixelData,
  decompressPixelData,
  codecMetaFrom,
} from '../src/modules/dicom-compress/dicom-codec'

const SAMPLE = path.resolve(__dirname, '../dicom-samples/CT_CHEST/CT_CHEST_001.dcm')

function makeGradient16(rows: number, cols: number): Buffer {
  const buf = Buffer.alloc(rows * cols * 2)
  for (let i = 0; i < rows * cols; i++) {
    const x = i % cols
    const y = Math.floor(i / cols)
    const v = 1000 + ((x * 7 + y * 3) % 4096)
    buf.writeUInt16LE(v, i * 2)
  }
  return buf
}

function makeRunHeavy16(rows: number, cols: number): Buffer {
  const buf = Buffer.alloc(rows * cols * 2)
  for (let i = 0; i < rows * cols; i++) {
    buf.writeUInt16LE(500 + (i % 17 === 0 ? 1 : 0) * 3000, i * 2)
  }
  return buf
}

describe('DicomCodec', () => {
  it('parseDicomPart10 extracts real pixel data from sample file', () => {
    const buf = fs.readFileSync(SAMPLE)
    const parsed = parseDicomPart10(buf)
    expect(parsed.rows).toBe(512)
    expect(parsed.columns).toBe(512)
    expect(parsed.bitsAllocated).toBe(16)
    expect(parsed.pixelData.length).toBe(512 * 512 * 2)
    expect(parsed.modality).toBe('CT')
    expect(parsed.fileSize).toBe(buf.length)
  })

  it('parseDicomPart10 rejects non-DICOM buffers', () => {
    expect(() => parseDicomPart10(Buffer.alloc(64))).toThrow(/DICOM Part 10/)
  })

  it('RLE: lossless round-trip identical and ratio > 1 on run-heavy data', () => {
    const px = makeRunHeavy16(64, 64)
    const packed = rleEncode(px, 16)
    const out = rleDecode(packed, px.length)
    expect(out.equals(px)).toBe(true)
    expect(packed.length).toBeLessThan(px.length)
  })

  it('RLE: round-trip on real CT pixel data', () => {
    const parsed = parseDicomPart10(fs.readFileSync(SAMPLE))
    const packed = rleEncode(parsed.pixelData, 16)
    const out = rleDecode(packed, parsed.pixelData.length)
    expect(out.equals(parsed.pixelData)).toBe(true)
    expect(packed.length).toBeLessThan(parsed.pixelData.length)
  })

  it('Predictive lossless: round-trip identical, ratio > 1', () => {
    const px = makeGradient16(128, 128)
    const packed = predictiveEncode(px, { bitsAllocated: 16, pixelRepresentation: 0, quality: 100 })
    const out = predictiveDecode(packed, { bitsAllocated: 16, pixelRepresentation: 0, quality: 100, pixelCount: px.length / 2 })
    expect(out.equals(px)).toBe(true)
    expect(packed.length).toBeLessThan(px.length)
  })

  it('Predictive lossless: round-trip on real CT pixel data', () => {
    const parsed = parseDicomPart10(fs.readFileSync(SAMPLE))
    const packed = predictiveEncode(parsed.pixelData, { bitsAllocated: 16, pixelRepresentation: 0, quality: 100 })
    const out = predictiveDecode(packed, { bitsAllocated: 16, pixelRepresentation: 0, quality: 100, pixelCount: parsed.pixelData.length / 2 })
    expect(out.equals(parsed.pixelData)).toBe(true)
    expect(packed.length).toBeLessThan(parsed.pixelData.length)
    expect(parsed.pixelData.length / packed.length).toBeGreaterThan(2)
  })

  it('Predictive lossy: deterministic, smaller than lossless, error bounded', () => {
    const parsed = parseDicomPart10(fs.readFileSync(SAMPLE))
    const px = parsed.pixelData
    const lossless = predictiveEncode(px, { bitsAllocated: 16, pixelRepresentation: 0, quality: 100 })
    const lossy = predictiveEncode(px, { bitsAllocated: 16, pixelRepresentation: 0, quality: 60 })
    const out = predictiveDecode(lossy, { bitsAllocated: 16, pixelRepresentation: 0, quality: 60, pixelCount: px.length / 2 })
    expect(lossy.length).toBeLessThan(lossless.length)
    expect(px.length / lossy.length).toBeGreaterThan(px.length / lossless.length)
    // 有损误差上界: step = round(0.6 * 40) = 24, 重建误差 <= step
    let maxErr = 0
    for (let i = 0; i < px.length; i += 2) {
      const d = Math.abs(out.readUInt16LE(i) - px.readUInt16LE(i))
      if (d > maxErr) maxErr = d
    }
    expect(maxErr).toBeLessThanOrEqual(24)
  })

  it('codec is deterministic: identical input => identical output', () => {
    const px = makeGradient16(64, 64)
    expect(predictiveEncode(px, { bitsAllocated: 16, pixelRepresentation: 0, quality: 90 }).equals(
      predictiveEncode(px, { bitsAllocated: 16, pixelRepresentation: 0, quality: 90 }),
    )).toBe(true)
    expect(rleEncode(px, 16).equals(rleEncode(px, 16))).toBe(true)
  })

  it('compressPixelData/decompressPixelData high-level entry points work', async () => {
    const parsed = parseDicomPart10(fs.readFileSync(SAMPLE))
    const packed = await compressPixelData(parsed.pixelData, parsed, { kind: 'rle', quality: 100 })
    const meta = { kind: 'rle' as const, lossless: true, quality: 100, bitsAllocated: 16, pixelRepresentation: 0, rows: 512, columns: 512, pixelCount: 512 * 512, samplesPerPixel: 1, source: 'rle-approx' as const }
    const out = await decompressPixelData(packed, meta)
    expect(out.equals(parsed.pixelData)).toBe(true)
  })

  // [G005 Wave3A P16] JPEG2000 真编解码: 高层入口 source 标注
  it('codecMetaFrom annotates source: jpeg2000 => real, rle => rle-approx', () => {
    const parsed = parseDicomPart10(fs.readFileSync(SAMPLE))
    const j2k = codecMetaFrom(parsed, { kind: 'jpeg2000', lossless: true, quality: 100 })
    expect(j2k.source).toBe('real')
    const rle = codecMetaFrom(parsed, { kind: 'rle', lossless: true, quality: 100 })
    expect(rle.source).toBe('rle-approx')
  })
})
