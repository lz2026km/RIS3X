import { Logger } from '@nestjs/common'
import * as path from 'node:path'

/**
 * G005 RIS - 真实 JPEG2000 编解码 (OpenJPEG WASM)
 *
 * 基于 @cornerstonejs/codec-openjpeg (OpenJPEG 官方 C 库的 Emscripten 构建, MIT):
 *  - encode: 产生 DICOM JPEG 2000 传输语法同款裸 J2K codestream (FF 4F SOC 开头)
 *  - decode: 本构建解码器要求 JP2 容器, 先 wrap 最小 JP2 盒子再解码
 *  - 输出像素为 LE 原生序 (与 DICOM 一致), 已做 16-bit 无损往返验证
 *
 * 注: 该构建的 encode() 忽略 setQuality/setCompressionRatio (恒等有损参数),
 *     故真实编码仅覆盖无损模式; 有损路径继续走 LOCO-I 近似 (dicom-codec predictive)。
 */

const logger = new Logger('Jpeg2000Codec')

export interface Jpeg2000EncodeOpts {
  rows: number
  columns: number
  bitsAllocated: number
  pixelRepresentation: number
  samplesPerPixel: number
}

export interface Jpeg2000DecodeOpts {
  rows: number
  columns: number
  bitsAllocated: number
  pixelCount: number
}

interface J2kFrameInfo {
  width: number
  height: number
  bitsPerSample: number
  componentCount: number
  isSigned: boolean
}

interface J2kEncoderLike {
  getDecodedBuffer(frameInfo: J2kFrameInfo): Uint8Array
  encode(frameInfo: J2kFrameInfo): void
  getEncodedBuffer(): ArrayBuffer
}

interface J2kDecoderLike {
  getEncodedBuffer(length: number): Uint8Array
  decode(): void
  getDecodedBuffer(): ArrayBuffer
  getFrameInfo(): J2kFrameInfo
}

interface J2kLib {
  J2KEncoder: new () => J2kEncoderLike
  J2KDecoder: new () => J2kDecoderLike
}

let libPromise: Promise<J2kLib> | null = null

function loadLib(): Promise<J2kLib> {
  if (!libPromise) {
    libPromise = (async () => {
      try {
        const entry = require.resolve('@cornerstonejs/codec-openjpeg')
        const distDir = path.dirname(entry)
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const factory = require('@cornerstonejs/codec-openjpeg') as (opts: { locateFile: (file: string) => string }) => Promise<J2kLib>
        const lib = await factory({ locateFile: (file: string) => path.join(distDir, file) })
        if (!lib || typeof lib.J2KEncoder !== 'function' || typeof lib.J2KDecoder !== 'function') {
          throw new Error('OpenJPEG WASM loaded but API surface unexpected')
        }
        logger.log('OpenJPEG WASM initialized')
        return lib
      } catch (e) {
        libPromise = null
        throw e
      }
    })()
  }
  return libPromise
}

/** 裸 J2K codestream → 最小 JP2 容器 (签名 + ftyp + jp2h(ihdr/colr) + jp2c) */
export function wrapJp2(codestream: Buffer, width: number, height: number, componentCount: number): Buffer {
  const box = (type: string, payload: Buffer): Buffer => {
    const b = Buffer.alloc(8 + payload.length)
    b.writeUInt32BE(8 + payload.length, 0)
    b.write(type, 4, 4, 'latin1')
    payload.copy(b, 8)
    return b
  }
  const sig = Buffer.from('0000000c6a5020200d0a870a', 'hex')
  const ftyp = Buffer.alloc(20)
  ftyp.writeUInt32BE(20, 0)
  ftyp.write('ftyp', 4, 4, 'latin1')
  ftyp.writeUInt32BE(0, 8)
  ftyp.write('jp2 ', 12, 4, 'latin1')
  ftyp.write('jp2 ', 16, 4, 'latin1')
  const ihdr = Buffer.alloc(14)
  ihdr.writeUInt32BE(height, 0)
  ihdr.writeUInt32BE(width, 4)
  ihdr.writeUInt16BE(componentCount, 8)
  ihdr.writeUInt8(0, 10) // bpc: 0 = 8 位以上无偏好
  ihdr.writeUInt8(7, 11) // compression = JPEG 2000
  ihdr.writeUInt8(0, 12) // unknown colorspace
  ihdr.writeUInt8(0, 13) // no intellectual property
  const colr = Buffer.alloc(7)
  colr.writeUInt8(1, 0) // enumerated
  colr.writeUInt8(0, 1)
  colr.writeUInt8(0, 2)
  colr.writeUInt32BE(componentCount === 3 ? 16 : 17, 3) // sRGB / grayscale
  const jp2h = box('jp2h', Buffer.concat([box('ihdr', ihdr), box('colr', colr)]))
  const jp2c = box('jp2c', Buffer.from(codestream))
  return Buffer.concat([sig, ftyp, jp2h, jp2c])
}

export async function jpeg2000Encode(pixelData: Buffer, opts: Jpeg2000EncodeOpts): Promise<Buffer> {
  const lib = await loadLib()
  if (opts.samplesPerPixel > 1) {
    throw new Error(`JPEG2000 encode: unsupported samplesPerPixel=${opts.samplesPerPixel}`)
  }
  const is16 = opts.bitsAllocated > 8
  const frameBytes = opts.rows * opts.columns * (is16 ? 2 : 1)
  const bytes = pixelData.length >= frameBytes ? pixelData.subarray(0, frameBytes) : pixelData
  const frameInfo: J2kFrameInfo = {
    width: opts.columns,
    height: opts.rows,
    bitsPerSample: is16 ? 16 : 8,
    componentCount: 1,
    isSigned: opts.pixelRepresentation === 1,
  }
  const encoder = new lib.J2KEncoder()
  const src = encoder.getDecodedBuffer(frameInfo)
  src.set(bytes)
  encoder.encode(frameInfo)
  const out = new Uint8Array(encoder.getEncodedBuffer())
  return Buffer.from(out)
}

export async function jpeg2000Decode(packed: Buffer, opts: Jpeg2000DecodeOpts): Promise<Buffer> {
  const lib = await loadLib()
  const sampleBytes = opts.bitsAllocated > 8 ? 2 : 1
  const wrapped = wrapJp2(packed, opts.columns, opts.rows, 1)
  const decoder = new lib.J2KDecoder()
  const inBuf = decoder.getEncodedBuffer(wrapped.length)
  inBuf.set(wrapped)
  decoder.decode()
  const frame = decoder.getFrameInfo()
  const outFrameBytes = opts.rows * opts.columns * (frame.bitsPerSample > 8 ? 2 : 1)
  const decoded = new Uint8Array(decoder.getDecodedBuffer())
  const expected = Math.min(opts.pixelCount * sampleBytes, outFrameBytes)
  if (decoded.length < expected) {
    throw new Error(`JPEG2000 decode: buffer too small (${decoded.length} < ${expected})`)
  }
  return Buffer.from(decoded.subarray(0, expected))
}
