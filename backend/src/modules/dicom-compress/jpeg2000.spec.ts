// [G005 Wave3A P16] jpeg2000.ts 真编解码 (OpenJPEG WASM) spec: 无损往返 + JP2 包裹
import { jpeg2000Encode, jpeg2000Decode, wrapJp2 } from './jpeg2000'

describe('jpeg2000 (OpenJPEG WASM) 真编解码', () => {
  it('wrapJp2 产出合法 JP2 容器 (签名 + ftyp + jp2h + jp2c)', () => {
    const cs = Buffer.from('ff4fff51', 'hex')
    const wrapped = wrapJp2(cs, 16, 16, 1)
    expect(wrapped.subarray(0, 12).toString('hex')).toBe('0000000c6a5020200d0a870a')
    expect(wrapped.toString('latin1', 16, 20)).toBe('ftyp')
    expect(wrapped.toString('latin1', 36, 40)).toBe('jp2h')
    expect(wrapped.subarray(wrapped.length - 8, wrapped.length - 4).toString('latin1')).toBe('jp2c')
  })

  it('16-bit LE 无损往返 100% 一致 (64x64)', async () => {
    const rows = 64
    const columns = 64
    const pixelData = Buffer.alloc(rows * columns * 2)
    for (let i = 0; i < rows * columns; i++) {
      pixelData.writeUInt16LE((i * 13) % 4096, i * 2)
    }
    const packed = await jpeg2000Encode(pixelData, {
      rows,
      columns,
      bitsAllocated: 16,
      pixelRepresentation: 0,
      samplesPerPixel: 1,
    })
    expect(packed.length).toBeGreaterThan(0)
    expect(packed[0]).toBe(0xff)
    expect(packed[1]).toBe(0x4f)
    expect(packed.length).toBeLessThan(pixelData.length)

    const decoded = await jpeg2000Decode(packed, {
      rows,
      columns,
      bitsAllocated: 16,
      pixelCount: rows * columns,
    })
    expect(decoded.length).toBe(pixelData.length)
    expect(decoded.equals(pixelData)).toBe(true)
  })

  it('8-bit 无损往返 100% 一致 (32x48)', async () => {
    const rows = 32
    const columns = 48
    const pixelData = Buffer.alloc(rows * columns)
    for (let i = 0; i < rows * columns; i++) pixelData[i] = (i * 7) % 256
    const packed = await jpeg2000Encode(pixelData, {
      rows,
      columns,
      bitsAllocated: 8,
      pixelRepresentation: 0,
      samplesPerPixel: 1,
    })
    const decoded = await jpeg2000Decode(packed, {
      rows,
      columns,
      bitsAllocated: 8,
      pixelCount: rows * columns,
    })
    expect(decoded.equals(pixelData)).toBe(true)
  })

  it('16-bit 有符号 (pixelRepresentation=1) 无损往返一致', async () => {
    const rows = 40
    const columns = 40
    const pixelData = Buffer.alloc(rows * columns * 2)
    for (let i = 0; i < rows * columns; i++) {
      pixelData.writeInt16LE(((i * 29) % 2000) - 1000, i * 2)
    }
    const packed = await jpeg2000Encode(pixelData, {
      rows,
      columns,
      bitsAllocated: 16,
      pixelRepresentation: 1,
      samplesPerPixel: 1,
    })
    const decoded = await jpeg2000Decode(packed, {
      rows,
      columns,
      bitsAllocated: 16,
      pixelCount: rows * columns,
    })
    expect(decoded.equals(pixelData)).toBe(true)
  })
})
