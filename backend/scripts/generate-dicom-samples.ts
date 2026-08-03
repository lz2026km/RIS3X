/**
 * G005 RIS - 内置示例 DICOM 生成脚本 (Phase 1.2+1.3 真实化)
 *
 * 手工构造真实 DICOM Part 10 文件 (Explicit VR Little Endian, 1.2.840.10008.1.2.1):
 *   - CT 头 (512x512x20): 脑组织 30-40 HU / 颅骨 900+ HU / 脑室 0-10 HU
 *   - CT 胸 (512x512x15): 肺 -800~-600 HU / 软组织 40 HU / 骨
 *   - MR 脑 (256x256x10): T1 样信号 (灰质/白质对比)
 *   - DR 胸片 (2048x2048x1): 肺部/纵隔/肋骨
 *   - DBT 乳腺断层 (512x512x15 x2): 左/右乳腺, 纤维腺体密度 + 微钙化亮点, ±15° 角度
 *
 * 运行: cd backend && npx ts-node scripts/generate-dicom-samples.ts
 * 输出: backend/dicom-samples/<SERIES>/<FILE>.dcm + manifest.json
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

// ────────────────────────────────────────────────────────────────────────────
// UID / SOP 常量
// ────────────────────────────────────────────────────────────────────────────

const UID_ROOT = '1.2.826.0.1.3680043.10.155.3.0.6.11'
const SOP_CT = '1.2.840.10008.5.1.4.1.1.2' // CT Image Storage
const SOP_MR = '1.2.840.10008.5.1.4.1.1.4' // MR Image Storage
const SOP_DX = '1.2.840.10008.5.1.4.1.1.1.1' // Digital X-Ray Image Storage
const SOP_DBT = '1.2.840.10008.5.1.4.1.1.13.1.3' // Digital Breast Tomosynthesis Image Storage
const TS_EXPLICIT_LE = '1.2.840.10008.1.2.1'
const IMPLEMENTATION_CLASS = '1.2.840.10008.5.1.4.1.2.1.1'
const IMPLEMENTATION_VERSION = 'G005-RIS-SAMPLES-3.0.6.11'

const OUT_DIR = path.resolve(__dirname, '..', 'dicom-samples')

// ────────────────────────────────────────────────────────────────────────────
// DICOM Part 10 编码器 (Explicit VR Little Endian)
// ────────────────────────────────────────────────────────────────────────────

const LONG_VR = new Set(['OB', 'OD', 'OF', 'OL', 'OW', 'SQ', 'UC', 'UN', 'UR', 'UT'])

const u16le = (n: number): Buffer => {
  const b = Buffer.alloc(2)
  b.writeUInt16LE(n, 0)
  return b
}
const u32le = (n: number): Buffer => {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(n, 0)
  return b
}

/** 字符串值, ASCII 编码 + 偶字节补齐 */
const val = (s: string): Buffer => {
  const b = Buffer.from(s, 'ascii')
  return b.length % 2 !== 0 ? Buffer.concat([b, Buffer.from([0])]) : b
}

interface ElementDef {
  group: number
  elem: number
  vr: string
  value: Buffer | number | number[]
}

function encodeElement(group: number, elem: number, vr: string, value: Buffer): Buffer {
  const parts: Buffer[] = [u16le(group), u16le(elem), Buffer.from(vr, 'ascii')]
  if (LONG_VR.has(vr)) {
    parts.push(u16le(0), u32le(value.length))
  } else {
    parts.push(u16le(value.length))
  }
  parts.push(value)
  if (value.length % 2 !== 0) parts.push(Buffer.from([0]))
  return Buffer.concat(parts)
}

/** DS 值(可能多值用反斜杠) → ascii buffer */
const ds = (...vals: Array<number | string>): Buffer => val(vals.map((v) => (typeof v === 'number' ? v.toFixed(6) : v)).join('\\'))
const is = (n: number): Buffer => val(String(n))
const ui = (s: string): Buffer => val(s)
const cs = (s: string): Buffer => val(s)
const lo = (s: string): Buffer => val(s)
const da = (s: string): Buffer => val(s)
const tm = (s: string): Buffer => val(s)
const us = (n: number): Buffer => u16le(n)
const usv = (...vals: number[]): Buffer => Buffer.concat(vals.map(u16le))

export interface SampleSeriesSpec {
  key: string
  modality: string
  sopClassUid: string
  patientName: string
  patientId: string
  patientSex: string
  patientBirthDate: string
  studyDate: string
  studyTime: string
  accessionNumber: string
  studyDescription: string
  seriesDescription: string
  seriesNumber: number
  rows: number
  columns: number
  pixelSpacing: [number, number]
  sliceThickness: number
  windowCenter: number
  windowWidth: number
  rescaleIntercept: number
  rescaleSlope: number
  sliceCount: number
  /** 输出子目录 (默认 spec.key); DBT 左右乳腺可共用 dicom-samples/DBT/ */
  dir?: string
  /** DBT 投照角度序列 (每帧一个角度, 度); 缺省按 instanceNumber 排序 */
  tomoAngles?: number[]
  bodyPartExamined?: string
  viewPosition?: string
  kvp?: number
  imageType?: string
  generateSlice: (px: number, py: number, layer: number) => number
}


export interface SampleInstanceMeta {
  file: string
  sopInstanceUid: string
  instanceNumber: number
  sliceLocation: number
  imagePositionPatient: [number, number, number]
  /** DBT 该帧投照角度 (度) */
  tomoAngle?: number
}

export interface SampleSeriesManifest {
  key: string
  modality: string
  sopClassUid: string
  studyInstanceUid: string
  seriesInstanceUid: string
  patientName: string
  patientId: string
  patientSex: string
  patientBirthDate: string
  studyDate: string
  studyDescription: string
  seriesDescription: string
  bodyPartExamined?: string
  viewPosition?: string
  seriesNumber: number
  rows: number
  columns: number
  pixelSpacing: string
  sliceThickness: string
  windowCenter: string
  windowWidth: string
  rescaleIntercept: string
  rescaleSlope: string
  transferSyntax: string
  instances: SampleInstanceMeta[]
}

// ────────────────────────────────────────────────────────────────────────────
// 确定性伪随机噪声 (保证可复现)
// ────────────────────────────────────────────────────────────────────────────

function noise2(x: number, y: number, seed: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}

// ────────────────────────────────────────────────────────────────────────────
// 解剖学体素生成器
// ────────────────────────────────────────────────────────────────────────────

/**
 * CT 头: 颅骨环 + 脑实质 30-40 HU + 脑室 0-10 HU。
 * 存储值 = HU + 1024 (RescaleIntercept=-1024, RescaleSlope=1), 无符号 16bit。
 */
function makeHeadCtSlice(): SampleSeriesSpec['generateSlice'] {
  return (px, py, layer) => {
    const u = (px - 256) / 256
    const v = (py - 256) / 256
    // 颅骨椭圆环: r0 (内) ~ r1 (外)
    const e = (a: number, b: number) => (u / a) ** 2 + (v / b) ** 2
    const skull = e(0.86, 1.0)
    const r = Math.sqrt(skull)
    const n = noise2(px * 0.05, py * 0.05, 7)
    let hu = -1000
    if (r < 0.8) {
      // 脑实质
      hu = 33 + 3 * Math.sin(layer * Math.PI) + n * 4
      // 脑室 (CSF) - 中央区
      const vx = u - (Math.sin(layer * Math.PI * 1.5) * 0.04)
      const vy = v - 0.12
      const vEn = (vx / 0.13) ** 2 + ((vy * 1.6) / 0.13) ** 2
      if (vEn < 1 && layer > 0.25 && layer < 0.8) hu = 5 + n * 2
      // 基底节/丘脑 (略高密度)
      const th = ((u - 0.02) / 0.14) ** 2 + ((v - 0.22) / 0.1) ** 2
      if (th < 1 && layer > 0.3) hu = 38 + n * 3
    } else if (r < 0.95) {
      // 颅骨
      const t = (r - 0.8) / 0.15
      hu = 950 + 150 * Math.sin(t * Math.PI) + n * 60
      // 板障 (middle layer lower density)
      if (t > 0.3 && t < 0.7) hu = 600 + n * 80
    }
    return Math.round(hu + 1024)
  }
}

/**
 * CT 胸: 双肺 -800~-600 HU + 血管 + 软组织 40 HU + 脊柱/肋骨。
 */
function makeChestCtSlice(): SampleSeriesSpec['generateSlice'] {
  return (px, py, layer) => {
    const u = (px - 256) / 256
    const v = (py - 256) / 256
    const n = noise2(px * 0.06, py * 0.06, 11)
    let hu = -1000
    const body = (u / 0.52) ** 2 + (v / 0.68) ** 2
    if (body < 1) {
      hu = 40 + n * 8 // 软组织
      // 肺野
      for (const side of [-1, 1]) {
        const lu = u - side * 0.17
        const lung = (lu / 0.13) ** 2 + ((v - 0.02) / 0.2) ** 2
        if (lung < 1) {
          hu = -820 + n * 40 + 60 * (0.75 - Math.abs(layer - 0.5) * 1.5)
          // 肺纹理/血管 (分支状)
          const vessel = Math.sin(lu * 40 + v * 30 + layer * 12) * Math.cos(lu * 25 - v * 20)
          if (vessel > 0.55) hu = 20 + n * 15
          else if (vessel > 0.2) hu = -300 + n * 60
        }
      }
      // 心脏 (左侧, 中层面)
      if (layer > 0.25 && layer < 0.75) {
        const heart = ((u - 0.12) / 0.11) ** 2 + ((v - 0.18) / 0.13) ** 2
        if (heart < 1) hu = 45 + n * 12
      }
      // 脊柱
      const spine = ((u + 0.03) / 0.075) ** 2 + ((v - 0.46) / 0.075) ** 2
      if (spine < 1) {
        const c = Math.sqrt(spine)
        hu = 700 * (1 - c * 0.6) + n * 50
      }
      // 肋骨弧 (上部)
      const ribBand = Math.abs(Math.sqrt((u / 0.55) ** 2 + ((v - 0.15) / 0.55) ** 2) - 0.62)
      if (ribBand < 0.045 && v > 0) hu = 500 + n * 60
    }
    return Math.round(hu + 1024)
  }
}

/**
 * MR T1: 白质 ~2200 / 灰质 ~1400 / 脑脊液 ~800 / 背景 0。
 */
function makeMrSlice(): SampleSeriesSpec['generateSlice'] {
  return (px, py, layer) => {
    const u = (px - 128) / 128
    const v = (py - 132) / 128
    const n = noise2(px * 0.09, py * 0.09, 23)
    const e = (u / 0.88) ** 2 + (v / 0.98) ** 2
    const r = Math.sqrt(e)
    let sig = 0
    if (r < 0.9) {
      // 灰质 (皮层) 靠近外缘
      if (r > 0.55) {
        sig = 1450 + 150 * (r - 0.55) / 0.35 + n * 90
      } else {
        sig = 2150 + 120 * Math.sin(layer * Math.PI * 2) + n * 80
      }
      // 脑室 (CSF)
      const vx = (u - 0.04) / 0.1
      const vy = (v + 0.12) / 0.07
      if (vx * vx + vy * vy < 1 && layer > 0.2 && layer < 0.85) sig = 780 + n * 40
      // 颅骨/头皮信号 0 (骨骼在 T1 为低信号)
      if (r > 0.82) sig = Math.min(sig, 350)
    }
    return Math.round(Math.max(0, Math.min(4095, sig)))
  }
}

/**
 * DR 胸片 (单帧): 纵隔亮 / 双肺暗含纹理 / 肋骨弧 / 心脏。
 */
function makeDrChest(): SampleSeriesSpec['generateSlice'] {
  return (px, py) => {
    const u = (px - 1024) / 1024
    const v = (py - 1024) / 1024
    const n = noise2(px * 0.008, py * 0.008, 31)
    let sig = 60 + n * 15 // 背景 (胶片)
    const body = (u / 0.56) ** 2 + (v / 0.8) ** 2
    if (body < 1) {
      sig = 1250 + n * 80 // 软组织
      // 双肺
      for (const side of [-1, 1]) {
        const lu = u - side * 0.19
        const lung = (lu / 0.15) ** 2 + ((v - 0.05) / 0.26) ** 2
        if (lung < 1) {
          sig = 260 + n * 60
          const vessel = Math.sin(lu * 55 + v * 45) * Math.cos(lu * 30 - v * 40)
          if (vessel > 0.5) sig = 850 + n * 100
          else if (vessel > 0.15) sig = 420 + n * 80
        }
      }
      // 心影 (左侧, 下方)
      const heart = ((u - 0.13) / 0.13) ** 2 + ((v - 0.32) / 0.16) ** 2
      if (heart < 1) sig = 2150 + n * 120
      // 纵隔/气管带
      const medi = ((u - 0.02) / 0.06) ** 2
      if (medi < 1 && v < 0.25) sig = 1500 + n * 100
      // 脊柱
      const spine = ((u - 0.02) / 0.045) ** 2 + ((v - 0.5) / 0.5) ** 2
      if (spine < 1 && v > 0.1) sig = 2200 + n * 130
      // 肋骨弧
      for (let k = 0; k < 5; k++) {
        const ry = 0.78 + k * 0.03
        const rib = Math.abs(Math.sqrt((u / 0.5) ** 2 + ((v + 0.15 - k * 0.05) / ry) ** 2) - 0.9)
        if (rib < 0.035 && v < 0.4) sig = 1850 + n * 110
      }
      // 膈肌弧线
      const dia = Math.abs(v - (0.42 + 0.18 * Math.abs(u)))
      if (dia < 0.02 && v > 0.2) sig = 1950 + n * 90
    }
    return Math.round(Math.max(0, Math.min(4095, sig)))
  }
}

/**
 * DBT 断层 (乳腺断层合成): 空气背景 / 乳腺主体轮廓 / 纤维腺体密度 /
 * 脂肪小叶间隙 / 皮肤线 / 微钙化亮点簇 / 角度视差 (层间水平位移)。
 * 存储值 = 原始信号 (RescaleIntercept=0), 范围 ~320..4095。
 */
function makeDbtSlice(side: 'L' | 'R', seed: number): SampleSeriesSpec['generateSlice'] {
  const CLUSTERS: Array<[number, number, number]> = [
    [-150, -40, 1.0], [90, 20, 0.85], [-60, 140, 1.2], [30, -180, 0.9],
    [170, -120, 1.1], [-200, 60, 1.0], [-10, -60, 1.3], [140, 180, 0.95],
  ]
  return (px, py, layer) => {
    const n = noise2(px * 0.04, py * 0.04, seed)
    const n2 = noise2(px * 0.14, py * 0.14, seed + 17)
    const n3 = noise2(px * 0.5, py * 0.5, seed + 41)
    const lob = noise2(px * 0.06, py * 0.06, seed + 7)
    let sig = 320 + n * 40
    const dir = side === 'R' ? 1 : -1
    const cx = 256 + dir * 120
    const cy = 300
    const bx = (px - cx) * dir
    const by = py - cy
    const e = (bx / (256 * 1.45)) ** 2 + (by / (256 * 1.75)) ** 2
    if (e < 1) {
      const t = 1 - Math.sqrt(e)
      sig = 620 + 260 * t + n * 90
      const bxs = bx - (layer - 0.5) * 26 * dir
      const bxe = (bxs / (256 * 1.45)) ** 2 + (by / (256 * 1.75)) ** 2
      const te = Math.max(0, 1 - Math.sqrt(bxe))
      sig += 420 * Math.pow(te, 1.6) * (0.55 + 0.45 * n2)
      sig += 90 * Math.abs(Math.sin(bxs * 0.02 + by * 0.015 + 0.6 * Math.log(te + 1))) * (0.5 + 0.5 * n3)
      if (lob > 0.35) sig -= 220 * (lob - 0.35) / 0.65
      if (t < 0.045) sig += 380
      for (const [ox, oy, r] of CLUSTERS) {
        const ddx = bx - ox
        const ddy = by - oy
        const d = Math.sqrt(ddx * ddx + ddy * ddy)
        const size = 6 * r
        if (d < size) {
          const k = 1 - d / size
          sig += 3000 * k * k
        }
      }
    }
    sig += 60 * Math.sin(layer * Math.PI * 2 + (px + py) * 0.01)
    return Math.round(Math.max(0, Math.min(4095, sig)))
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Part 10 文件构建
// ────────────────────────────────────────────────────────────────────────────

function buildPart10(opts: {
  spec: SampleSeriesSpec
  sopInstanceUid: string
  instanceNumber: number
  sliceLocation: number
  imagePositionPatient: [number, number, number]
  pixelData: Buffer
  tomoAngle?: number
}): Buffer {
  const { spec, sopInstanceUid, instanceNumber, sliceLocation, imagePositionPatient, pixelData } = opts
  const studyUid = `${UID_ROOT}.${spec.studyDate.replace(/-/g, '')}.${spec.accessionNumber}`
  const seriesUid = `${UID_ROOT}.${spec.modality}.S.${spec.seriesNumber}`
  const series = spec

  const metaElements: Buffer[] = []
  const meta = (hexTag: string, vr: string, value: Buffer): Buffer => {
    const g = parseInt(hexTag.slice(0, 4), 16)
    const e = parseInt(hexTag.slice(4, 8), 16)
    return encodeElement(g, e, vr, value)
  }
  metaElements.push(meta('00020001', 'OB', Buffer.from([0x01, 0x00])))
  metaElements.push(meta('00020002', 'UI', ui(series.sopClassUid)))
  metaElements.push(meta('00020003', 'UI', ui(sopInstanceUid)))
  metaElements.push(meta('00020010', 'UI', ui(TS_EXPLICIT_LE)))
  metaElements.push(meta('00020012', 'UI', ui(IMPLEMENTATION_CLASS)))
  metaElements.push(meta('00020013', 'SH', val(IMPLEMENTATION_VERSION)))
  const metaBody = Buffer.concat(metaElements)
  const groupLen = meta('00020000', 'UL', u32le(metaBody.length))

  const dsElements: Buffer[] = []
  const ed = (g: number, e: number, vr: string, value: Buffer): void => {
    dsElements.push(encodeElement(g, e, vr, value))
  }
  // Patient
  ed(0x0008, 0x0005, 'CS', cs('ISO_IR 6')) // Specific Character Set (ASCII)
  ed(0x0008, 0x0008, 'CS', val(series.imageType ?? `ORIGINAL\\PRIMARY\\AXIAL`))
  ed(0x0008, 0x0016, 'UI', ui(series.sopClassUid))
  ed(0x0008, 0x0018, 'UI', ui(sopInstanceUid))
  ed(0x0008, 0x0020, 'DA', da(series.studyDate))
  ed(0x0008, 0x0030, 'TM', tm(series.studyTime))
  ed(0x0008, 0x0050, 'SH', lo(series.accessionNumber))
  ed(0x0008, 0x0060, 'CS', cs(series.modality))
  ed(0x0008, 0x0070, 'LO', lo('G005 Synthetic Scanner'))
  ed(0x0008, 0x0090, 'PN', val('G005^RAD'))
  ed(0x0008, 0x1030, 'LO', lo(series.studyDescription))
  ed(0x0008, 0x103E, 'LO', lo(series.seriesDescription))
  // Study / Series
  ed(0x0020, 0x000D, 'UI', ui(studyUid))
  ed(0x0020, 0x000E, 'UI', ui(seriesUid))
  ed(0x0020, 0x0010, 'SH', lo(studyUid))
  ed(0x0020, 0x0011, 'IS', is(series.seriesNumber))
  ed(0x0020, 0x0013, 'IS', is(instanceNumber))
  ed(0x0020, 0x0032, 'DS', ds(...imagePositionPatient))
  ed(0x0020, 0x0037, 'DS', ds('1', '0', '0', '0', '1', '0'))
  ed(0x0020, 0x1041, 'DS', ds(sliceLocation))
  // Patient
  ed(0x0010, 0x0010, 'PN', val(series.patientName))
  ed(0x0010, 0x0020, 'LO', lo(series.patientId))
  ed(0x0010, 0x0030, 'DA', da(series.patientBirthDate))
  ed(0x0010, 0x0040, 'CS', cs(series.patientSex))
  // Image Pixel
  ed(0x0028, 0x0002, 'US', us(1)) // SamplesPerPixel
  ed(0x0028, 0x0004, 'CS', cs('MONOCHROME2'))
  ed(0x0028, 0x0010, 'US', us(series.rows))
  ed(0x0028, 0x0011, 'US', us(series.columns))
  ed(0x0028, 0x0030, 'DS', ds(...series.pixelSpacing))
  ed(0x0028, 0x0050, 'DS', ds(series.sliceThickness))
  ed(0x0028, 0x0100, 'US', us(16)) // BitsAllocated
  ed(0x0028, 0x0101, 'US', us(16)) // BitsStored
  ed(0x0028, 0x0102, 'US', us(15)) // HighBit
  ed(0x0028, 0x0103, 'US', us(0)) // PixelRepresentation (unsigned)
  ed(0x0028, 0x1050, 'DS', ds(series.windowCenter))
  ed(0x0028, 0x1051, 'DS', ds(series.windowWidth))
  ed(0x0028, 0x1052, 'DS', ds(series.rescaleIntercept))
  ed(0x0028, 0x1053, 'DS', ds(series.rescaleSlope))
  if (series.bodyPartExamined) ed(0x0018, 0x0015, 'CS', cs(series.bodyPartExamined))
  if (series.viewPosition) ed(0x0018, 0x5101, 'CS', cs(series.viewPosition))
  if (series.kvp) ed(0x0018, 0x0060, 'DS', ds(series.kvp))
  if (opts.tomoAngle !== undefined) ed(0x0018, 0x1120, 'DS', ds(opts.tomoAngle))
  ed(0x7FE0, 0x0010, 'OW', pixelData)

  const preamble = Buffer.alloc(128, 0)
  const dicm = Buffer.from('DICM', 'ascii')
  const dataset = Buffer.concat(dsElements)
  return Buffer.concat([preamble, dicm, groupLen, metaBody, dataset])
}

// ────────────────────────────────────────────────────────────────────────────
// 生成主流程
// ────────────────────────────────────────────────────────────────────────────

interface SeriesOutput {
  manifest: SampleSeriesManifest
  files: string[]
}

function generateSeries(spec: SampleSeriesSpec): SeriesOutput {
  const studyUid = `${UID_ROOT}.${spec.studyDate.replace(/-/g, '')}.${spec.accessionNumber}`
  const seriesUid = `${UID_ROOT}.${spec.modality}.S.${spec.seriesNumber}`
  const dir = path.join(OUT_DIR, spec.dir ?? spec.key)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const instances: SampleInstanceMeta[] = []
  const files: string[] = []
  const z0 = -((spec.sliceCount - 1) * spec.sliceThickness) / 2

  for (let i = 0; i < spec.sliceCount; i++) {
    const layer = spec.sliceCount > 1 ? i / (spec.sliceCount - 1) : 0
    const buf = Buffer.alloc(spec.rows * spec.columns * 2)
    const offset = spec.columns * 2
    for (let y = 0; y < spec.rows; y++) {
      for (let x = 0; x < spec.columns; x++) {
        const v = spec.generateSlice(x, y, layer)
        buf.writeUInt16LE(Math.max(0, Math.min(65535, v)), y * offset + x * 2)
      }
    }
    const instanceNumber = i + 1
    const sliceLocation = Number((z0 + i * spec.sliceThickness).toFixed(2))
    const tomoAngle = spec.tomoAngles && spec.tomoAngles.length === spec.sliceCount ? spec.tomoAngles[i] : undefined
    const sopInstanceUid = `${UID_ROOT}.${spec.modality}.I.${spec.seriesNumber}.${String(instanceNumber).padStart(4, '0')}`
    const file = path.join(dir, `${spec.key}_${String(instanceNumber).padStart(3, '0')}.dcm`)
    const dicom = buildPart10({
      spec,
      sopInstanceUid,
      instanceNumber,
      sliceLocation,
      imagePositionPatient: [0, 0, sliceLocation],
      pixelData: buf,
      tomoAngle,
    })
    fs.writeFileSync(file, dicom)
    files.push(file)
    instances.push({
      file: path.relative(OUT_DIR, file).replace(/\\/g, '/'),
      sopInstanceUid,
      instanceNumber,
      sliceLocation,
      imagePositionPatient: [0, 0, sliceLocation],
      tomoAngle,
    })
  }

  const manifest: SampleSeriesManifest = {
    key: spec.key,
    modality: spec.modality,
    sopClassUid: spec.sopClassUid,
    studyInstanceUid: studyUid,
    seriesInstanceUid: seriesUid,
    patientName: spec.patientName,
    patientId: spec.patientId,
    patientSex: spec.patientSex,
    patientBirthDate: spec.patientBirthDate,
    studyDate: spec.studyDate,
    studyDescription: spec.studyDescription,
    seriesDescription: spec.seriesDescription,
    seriesNumber: spec.seriesNumber,
    bodyPartExamined: spec.bodyPartExamined,
    viewPosition: spec.viewPosition,
    rows: spec.rows,
    columns: spec.columns,
    pixelSpacing: spec.pixelSpacing.map((p) => p.toFixed(6)).join('\\'),
    sliceThickness: spec.sliceThickness.toFixed(6),
    windowCenter: String(spec.windowCenter),
    windowWidth: String(spec.windowWidth),
    rescaleIntercept: String(spec.rescaleIntercept),
    rescaleSlope: String(spec.rescaleSlope),
    transferSyntax: TS_EXPLICIT_LE,
    instances,
  }
  return { manifest, files }
}

// ────────────────────────────────────────────────────────────────────────────
// 校验: 回读解析 Part 10, 核对关键 tags
// ────────────────────────────────────────────────────────────────────────────

function verifyFile(file: string, expect: { rows: number; columns: number; modality: string; sopInstanceUid: string; pixelBytes: number }): void {
  const buf = fs.readFileSync(file)
  if (buf.toString('ascii', 128, 132) !== 'DICM') throw new Error(`${file}: missing DICM magic`)
  let offset = 132
  const found = new Map<string, Buffer>()
  while (offset + 8 <= buf.length) {
    const group = buf.readUInt16LE(offset)
    const elem = buf.readUInt16LE(offset + 2)
    if (group === 0xfffe) break
    let vr = ''
    let length = 0
    let dataStart = 0
    const c = buf[offset + 4]
    if (c >= 0x41 && c <= 0x7a) {
      vr = buf.toString('ascii', offset + 4, offset + 6)
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
    if (length === 0xffffffff) throw new Error(`${file}: undefined length not expected in samples`)
    if (dataStart + length > buf.length) throw new Error(`${file}: element overflows file (${group.toString(16)},${elem.toString(16)})`)
    found.set(`${group.toString(16).padStart(4, '0')}:${elem.toString(16).padStart(4, '0')}`, buf.subarray(dataStart, dataStart + length))
    offset = dataStart + length
    if (length % 2 !== 0) offset++
  }
  const usVal = (tag: string): number => {
    const b = found.get(tag)
    if (!b) throw new Error(`${file}: missing ${tag}`)
    return b.readUInt16LE(0)
  }
  const strVal = (tag: string): string => (found.get(tag) ?? Buffer.alloc(0)).toString('ascii').replace(/\0/g, '')
  const rows = usVal('0028:0010')
  const cols = usVal('0028:0011')
  const modality = strVal('0008:0060')
  const sop = strVal('0008:0018')
  const pixel = found.get('7fe0:0010')
  if (rows !== expect.rows || cols !== expect.columns) throw new Error(`${file}: rows/cols mismatch`)
  if (modality !== expect.modality) throw new Error(`${file}: modality mismatch`)
  if (sop !== expect.sopInstanceUid) throw new Error(`${file}: sop uid mismatch`)
  if (!pixel || pixel.length !== expect.pixelBytes) throw new Error(`${file}: pixel length mismatch`)
  if (!found.has('0028:1050') || !found.has('0028:1052') || !found.has('0028:1053')) throw new Error(`${file}: missing window/rescale tags`)
  if (!found.has('0010:0010') || !found.has('0020:000e') || !found.has('0008:0005')) throw new Error(`${file}: missing patient/series tags`)
}

// ────────────────────────────────────────────────────────────────────────────

function main(): void {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  const series: SampleSeriesSpec[] = [
    {
      key: 'CT_HEAD',
      modality: 'CT',
      sopClassUid: SOP_CT,
      patientName: 'ZHANG^CS01',
      patientId: 'P0000001',
      patientSex: 'M',
      patientBirthDate: '19750312',
      studyDate: '20260115',
      studyTime: '101500',
      accessionNumber: 'ACC-SAMPLE-0001',
      studyDescription: 'HEAD CT',
      seriesDescription: 'AXIAL HEAD 5MM',
      seriesNumber: 1,
      rows: 512,
      columns: 512,
      pixelSpacing: [0.5, 0.5],
      sliceThickness: 5,
      windowCenter: 40,
      windowWidth: 80,
      rescaleIntercept: -1024,
      rescaleSlope: 1,
      sliceCount: 20,
      generateSlice: makeHeadCtSlice(),
    },
    {
      key: 'CT_CHEST',
      modality: 'CT',
      sopClassUid: SOP_CT,
      patientName: 'LI^CS02',
      patientId: 'P0000002',
      patientSex: 'F',
      patientBirthDate: '19821005',
      studyDate: '20260115',
      studyTime: '142030',
      accessionNumber: 'ACC-SAMPLE-0002',
      studyDescription: 'CHEST CT',
      seriesDescription: 'AXIAL CHEST 5MM',
      seriesNumber: 2,
      rows: 512,
      columns: 512,
      pixelSpacing: [0.7, 0.7],
      sliceThickness: 5,
      windowCenter: 40,
      windowWidth: 400,
      rescaleIntercept: -1024,
      rescaleSlope: 1,
      sliceCount: 15,
      generateSlice: makeChestCtSlice(),
    },
    {
      key: 'MR_BRAIN',
      modality: 'MR',
      sopClassUid: SOP_MR,
      patientName: 'WANG^CS03',
      patientId: 'P0000003',
      patientSex: 'F',
      patientBirthDate: '19901122',
      studyDate: '20260116',
      studyTime: '093040',
      accessionNumber: 'ACC-SAMPLE-0003',
      studyDescription: 'BRAIN MRI',
      seriesDescription: 'T1 AXIAL',
      seriesNumber: 3,
      rows: 256,
      columns: 256,
      pixelSpacing: [0.9, 0.9],
      sliceThickness: 5,
      windowCenter: 900,
      windowWidth: 1800,
      rescaleIntercept: 0,
      rescaleSlope: 1,
      sliceCount: 10,
      generateSlice: makeMrSlice(),
    },
    {
      key: 'DR_CHEST',
      modality: 'DR',
      sopClassUid: SOP_DX,
      patientName: 'LIU^CS04',
      patientId: 'P0000004',
      patientSex: 'M',
      patientBirthDate: '19680730',
      studyDate: '20260116',
      studyTime: '110510',
      accessionNumber: 'ACC-SAMPLE-0004',
      studyDescription: 'CHEST X-RAY',
      seriesDescription: 'PA CHEST',
      seriesNumber: 4,
      rows: 2048,
      columns: 2048,
      pixelSpacing: [0.2, 0.2],
      sliceThickness: 0,
      windowCenter: 1024,
      windowWidth: 2048,
      rescaleIntercept: 0,
      rescaleSlope: 1,
      sliceCount: 1,
      generateSlice: makeDrChest(),
    },
    {
      key: 'DBT_LEFT',
      modality: 'DBT',
      sopClassUid: SOP_DBT,
      patientName: 'CHEN^DBT01',
      patientId: 'P0000005',
      patientSex: 'F',
      patientBirthDate: '19780819',
      studyDate: '20260310',
      studyTime: '093020',
      accessionNumber: 'ACC-SAMPLE-0005',
      studyDescription: 'BREAST TOMOSYNTHESIS',
      seriesDescription: 'L-CC DBT TOMOSYNTHESIS',
      dir: 'DBT',
      seriesNumber: 5,
      rows: 512,
      columns: 512,
      pixelSpacing: [0.1, 0.1],
      sliceThickness: 1,
      windowCenter: 1600,
      windowWidth: 2400,
      rescaleIntercept: 0,
      rescaleSlope: 1,
      sliceCount: 15,
      tomoAngles: [-15,-12.86,-10.71,-8.57,-6.43,-4.29,-2.14,0,2.14,4.29,6.43,8.57,10.71,12.86,15],
      bodyPartExamined: 'BREAST',
      viewPosition: 'LCC',
      kvp: 30,
      imageType: 'ORIGINAL\\PRIMARY\\TOMOSYNTHESIS',
      generateSlice: makeDbtSlice('L', 91),
    },
    {
      key: 'DBT_RIGHT',
      modality: 'DBT',
      sopClassUid: SOP_DBT,
      patientName: 'CHEN^DBT01',
      patientId: 'P0000005',
      patientSex: 'F',
      patientBirthDate: '19780819',
      studyDate: '20260310',
      studyTime: '093530',
      accessionNumber: 'ACC-SAMPLE-0005',
      studyDescription: 'BREAST TOMOSYNTHESIS',
      seriesDescription: 'R-CC DBT TOMOSYNTHESIS',
      dir: 'DBT',
      seriesNumber: 6,
      rows: 512,
      columns: 512,
      pixelSpacing: [0.1, 0.1],
      sliceThickness: 1,
      windowCenter: 1600,
      windowWidth: 2400,
      rescaleIntercept: 0,
      rescaleSlope: 1,
      sliceCount: 15,
      tomoAngles: [-15,-12.86,-10.71,-8.57,-6.43,-4.29,-2.14,0,2.14,4.29,6.43,8.57,10.71,12.86,15],
      bodyPartExamined: 'BREAST',
      viewPosition: 'RCC',
      kvp: 30,
      imageType: 'ORIGINAL\\PRIMARY\\TOMOSYNTHESIS',
      generateSlice: makeDbtSlice('R', 92),
    },
  ]

  const manifests: SampleSeriesManifest[] = []
  let fileCount = 0
  let totalBytes = 0
  const t0 = Date.now()
  for (const spec of series) {
    const { manifest, files } = generateSeries(spec)
    manifests.push(manifest)
    for (const file of files) {
      const idx = Number(path.basename(file).match(/(\d+)\.dcm$/)?.[1] ?? 1) - 1
      verifyFile(file, {
        rows: spec.rows,
        columns: spec.columns,
        modality: spec.modality,
        sopInstanceUid: manifest.instances[idx]!.sopInstanceUid,
        pixelBytes: spec.rows * spec.columns * 2,
      })
      const size = fs.statSync(file).size
      fileCount++
      totalBytes += size
    }
    console.log(`[gen] ${spec.key}: ${spec.sliceCount} slices x ${spec.rows}x${spec.columns} OK`)
  }

  const manifestPath = path.join(OUT_DIR, 'manifest.json')
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseDir: path.relative(path.resolve(__dirname, '..'), OUT_DIR).replace(/\\/g, '/'),
        transferSyntax: TS_EXPLICIT_LE,
        seriesCount: manifests.length,
        instanceCount: fileCount,
        totalBytes,
        series: manifests,
      },
      null,
      2,
    ),
  )
  console.log(`[gen] manifest written: ${manifestPath}`)
  console.log(`[gen] done: ${fileCount} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(1)}s`)
}

main()
