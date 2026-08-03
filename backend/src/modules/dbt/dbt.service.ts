/**
 * G005 RIS v3.0.6.11-62 - DBT 乳腺断层服务
 *
 * - listStudies: 从 dicomInstance(modality='DBT' / BREAST) 聚合 + 内置样本目录
 *   (dicom-samples/DBT/, manifest.json) 提供当前/既往 DBT 检查
 * - getSlices: 断层切片列表 (0°/+15°/-15° 角度信息来自 DICOM (0018,1120)
 *   Gantry/Detector Tilt; 缺失时按 instanceNumber 推导)
 * - reconstruct: 切片堆叠 → 厚度投影 (MIP / Mean), 真实像素处理, 无文件时合成
 * - compare: 当前 vs 既往双图对比元数据 (左右并排)
 */
import { Injectable, Inject, Logger, NotFoundException, Optional } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import * as fs from 'node:fs'
import * as path from 'node:path'

export interface DbtSeriesSummary {
  seriesInstanceUid: string
  seriesNumber: number
  laterality: 'L' | 'R'
  viewPosition: string
  sliceCount: number
  rows: number
  columns: number
  sliceThickness: number
  pixelSpacing: string
  windowCenter: number
  windowWidth: number
  source: 'sample' | 'db' | 'synthetic'
}

export interface DbtStudyDto {
  id: string
  studyInstanceUid: string
  patientName: string
  patientId: string
  patientSex: string
  patientBirthDate: string
  studyDate: string
  studyTime: string
  studyDescription: string
  accessionNumber: string
  isCurrent: boolean
  priorStudyId?: string
  series: DbtSeriesSummary[]
}

export interface SlicePixelPayload {
  dataBase64: string
  bitsAllocated: number
  signed: boolean
  width: number
  height: number
}

export interface DbtSliceDto {
  instanceNumber: number
  sopInstanceUid: string
  sliceLocation: number
  tomoAngle: number
  sliceThickness: number
  rows: number
  columns: number
  pixelData: SlicePixelPayload | null
}

export interface DbtReconstructResult {
  studyId: string
  seriesInstanceUid: string
  projection: 'mip' | 'mean'
  thickness: number
  source: 'real' | 'synthetic'
  width: number
  height: number
  windowWidth: number
  windowLevel: number
  pixelData: SlicePixelPayload
}

export interface DbtCompareResult {
  current: DbtStudyDto
  prior: DbtStudyDto
  lateralityMap: Array<{ laterality: 'L' | 'R'; currentSeries?: string; priorSeries?: string }>
}

interface BuiltinSeriesRef {
  key: string
  laterality: 'L' | 'R'
  seed: number
}

interface BuiltinStudy {
  id: string
  studyInstanceUid: string
  patientName: string
  patientId: string
  patientSex: string
  patientBirthDate: string
  studyDate: string
  studyTime: string
  accessionNumber: string
  studyDescription: string
  isCurrent: boolean
  priorStudyId?: string
  seriesKeys: BuiltinSeriesRef[]
}

const CURRENT_UID = '1.2.826.0.1.3680043.10.155.3.0.6.11.20260310.ACC-SAMPLE-0005'
const PRIOR_UID = '1.2.826.0.1.3680043.10.155.3.0.6.11.20251102.ACC-SAMPLE-0006'

const BUILTIN_STUDIES: BuiltinStudy[] = [
  {
    id: 'DBT-STUDY-CURRENT',
    studyInstanceUid: CURRENT_UID,
    patientName: 'CHEN^DBT01',
    patientId: 'P0000005',
    patientSex: 'F',
    patientBirthDate: '19780819',
    studyDate: '20260310',
    studyTime: '093020',
    accessionNumber: 'ACC-SAMPLE-0005',
    studyDescription: 'BREAST TOMOSYNTHESIS',
    isCurrent: true,
    seriesKeys: [
      { key: 'DBT_LEFT', laterality: 'L', seed: 91 },
      { key: 'DBT_RIGHT', laterality: 'R', seed: 92 },
    ],
  },
  {
    id: 'DBT-STUDY-PRIOR',
    studyInstanceUid: PRIOR_UID,
    patientName: 'CHEN^DBT01',
    patientId: 'P0000005',
    patientSex: 'F',
    patientBirthDate: '19780819',
    studyDate: '20251102',
    studyTime: '100415',
    accessionNumber: 'ACC-SAMPLE-0006',
    studyDescription: 'BREAST TOMOSYNTHESIS',
    isCurrent: false,
    priorStudyId: undefined,
    seriesKeys: [
      { key: 'DBT_LEFT', laterality: 'L', seed: 93 },
      { key: 'DBT_RIGHT', laterality: 'R', seed: 94 },
    ],
  },
]
BUILTIN_STUDIES[0].priorStudyId = BUILTIN_STUDIES[1].id

const LONG_VR = new Set(['OB', 'OD', 'OF', 'OL', 'OW', 'SQ', 'UC', 'UN', 'UR', 'UT'])

interface ParsedDicom {
  rows: number
  columns: number
  bitsAllocated: number
  pixelRepresentation: number
  windowCenter: number
  windowWidth: number
  rescaleIntercept: number
  rescaleSlope: number
  instanceNumber: number
  sliceLocation: number
  sliceThickness: number
  tomoAngle: number | null
  pixelData: Buffer
}

@Injectable()
export class DbtService {
  private readonly logger = new Logger(DbtService.name)
  private sampleRoot: string | null = null
  private readonly sampleRootOverride: string | null
  private manifest: {
    series: Array<{
      key: string
      modality: string
      studyInstanceUid: string
      seriesInstanceUid: string
      seriesDescription: string
      seriesNumber: number
      rows: number
      columns: number
      pixelSpacing: string
      sliceThickness: string
      windowCenter: string
      windowWidth: string
      viewPosition?: string
      bodyPartExamined?: string
      instances: Array<{ file: string; sopInstanceUid: string; instanceNumber: number; tomoAngle?: number }>
    }>
  } | null = null

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject('DBT_SAMPLE_ROOT') sampleRootOverride?: string,
  ) {
    this.sampleRootOverride = sampleRootOverride ?? null
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 样本源
  // ────────────────────────────────────────────────────────────────────────────

  private getSampleRoot(): string | null {
    if (this.sampleRoot !== null) return this.sampleRoot
    let resolved: string | null = null
    if (this.sampleRootOverride) {
      resolved = fs.existsSync(path.join(this.sampleRootOverride, 'manifest.json')) ? this.sampleRootOverride : null
    } else {
      const candidates = [
        process.env.DICOM_SAMPLE_DIR,
        path.resolve(process.cwd(), 'dicom-samples'),
        path.resolve(__dirname, '../../../dicom-samples'),
        path.resolve(__dirname, '../../../../dicom-samples'),
        path.resolve(process.cwd(), 'backend', 'dicom-samples'),
      ]
      for (const c of candidates) {
        if (c && fs.existsSync(path.join(c, 'manifest.json'))) {
          resolved = c
          break
        }
      }
    }
    this.sampleRoot = resolved
    return resolved
  }

  private getManifest(): typeof this.manifest {
    if (this.manifest) return this.manifest
    const root = this.getSampleRoot()
    if (!root) return null
    try {
      this.manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))
    } catch (e) {
      this.logger.warn(`manifest load failed: ${(e as Error).message}`)
      this.manifest = null
    }
    return this.manifest
  }

  private seriesForStudy(study: BuiltinStudy) {
    const manifest = this.getManifest()
    const prior = !study.isCurrent
    return study.seriesKeys.map((ref, idx) => {
      const m = manifest?.series.find((s) => s.key === ref.key)
      const seriesInstanceUid = prior
        ? `${m?.seriesInstanceUid ?? '1.2.826.0.1.3680043.10.155.3.0.6.11.DBT'}.P${study.id === 'DBT-STUDY-PRIOR' ? '2' : '1'}`
        : (m?.seriesInstanceUid ?? `1.2.826.0.1.3680043.10.155.3.0.6.11.DBT.S.${idx + 5}`)
      return {
        ref,
        manifestSeries: m,
        seriesInstanceUid,
        rows: m?.rows ?? 512,
        columns: m?.columns ?? 512,
        sliceThickness: Number(m?.sliceThickness ?? '1') || 1,
        pixelSpacing: m?.pixelSpacing ?? '0.1\\0.1',
        windowCenter: Number(m?.windowCenter ?? '1600') || 1600,
        windowWidth: Number(m?.windowWidth ?? '2400') || 2400,
        viewPosition: m?.viewPosition ?? (ref.laterality === 'L' ? 'LCC' : 'RCC'),
        seriesNumber: m?.seriesNumber ?? (prior ? idx + 7 : idx + 5),
        sliceCount: m?.instances?.length ?? 15,
      }
    })
  }

  private toStudyDto(study: BuiltinStudy): DbtStudyDto {
    const series = this.seriesForStudy(study).map((s) => ({
      seriesInstanceUid: s.seriesInstanceUid,
      seriesNumber: s.seriesNumber,
      laterality: s.ref.laterality,
      viewPosition: s.viewPosition,
      sliceCount: s.sliceCount,
      rows: s.rows,
      columns: s.columns,
      sliceThickness: s.sliceThickness,
      pixelSpacing: s.pixelSpacing,
      windowCenter: s.windowCenter,
      windowWidth: s.windowWidth,
      source: s.manifestSeries ? ('sample' as const) : ('synthetic' as const),
    }))
    return {
      id: study.id,
      studyInstanceUid: study.studyInstanceUid,
      patientName: study.patientName,
      patientId: study.patientId,
      patientSex: study.patientSex,
      patientBirthDate: study.patientBirthDate,
      studyDate: study.studyDate,
      studyTime: study.studyTime,
      studyDescription: study.studyDescription,
      accessionNumber: study.accessionNumber,
      isCurrent: study.isCurrent,
      priorStudyId: study.priorStudyId,
      series,
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 检查列表
  // ────────────────────────────────────────────────────────────────────────────

  async listStudies(): Promise<DbtStudyDto[]> {
    const out = BUILTIN_STUDIES.map((s) => this.toStudyDto(s))
    const model = (this.prisma as unknown as { dicomInstance?: { findMany: (a: unknown) => Promise<unknown[]> } }).dicomInstance
    if (model?.findMany) {
      try {
        const instances = await model.findMany({ where: { modality: 'DBT' } })
        if (Array.isArray(instances) && instances.length > 0) {
          const byStudy = new Map<string, unknown[]>()
          for (const inst of instances) {
            const uid = (inst as Record<string, unknown>).studyInstanceUid as string
            const list = byStudy.get(uid) ?? []
            list.push(inst)
            byStudy.set(uid, list)
          }
          for (const [uid, list] of byStudy) {
            if (out.some((s) => s.studyInstanceUid === uid)) continue
            const first = list[0] as Record<string, unknown>
            out.push({
              id: `DBT-DB-${uid}`,
              studyInstanceUid: uid,
              patientName: String(first.patientName ?? ''),
              patientId: String(first.patientId ?? ''),
              patientSex: '',
              patientBirthDate: '',
              studyDate: '',
              studyTime: '',
              studyDescription: 'DBT TOMOSYNTHESIS',
              accessionNumber: '',
              isCurrent: true,
              series: [
                {
                  seriesInstanceUid: String((list[0] as Record<string, unknown>).seriesInstanceUid ?? ''),
                  seriesNumber: 1,
                  laterality: 'L',
                  viewPosition: 'CC',
                  sliceCount: list.length,
                  rows: 512,
                  columns: 512,
                  sliceThickness: 1,
                  pixelSpacing: '0.1\\0.1',
                  windowCenter: 1600,
                  windowWidth: 2400,
                  source: 'db',
                },
              ],
            })
          }
        }
      } catch (e) {
        this.logger.warn(`listStudies db lookup failed: ${(e as Error).message}`)
      }
    }
    return out
  }

  private findStudy(studyId: string): BuiltinStudy {
    const study = BUILTIN_STUDIES.find((s) => s.id === studyId || s.studyInstanceUid === studyId)
    if (!study) throw new NotFoundException(`DBT study ${studyId} not found`)
    return study
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 切片列表
  // ────────────────────────────────────────────────────────────────────────────

  private resolveSliceFiles(study: BuiltinStudy, seriesUid: string) {
    const series = this.seriesForStudy(study).find((s) => s.seriesInstanceUid === seriesUid)
    if (!series) throw new NotFoundException(`DBT series ${seriesUid} not found`)
    const manifest = series.manifestSeries
    const root = this.getSampleRoot()
    const files: Array<{ file: string; sopInstanceUid: string; instanceNumber: number; tomoAngle?: number }> = []
    if (manifest && root) {
      for (const inst of manifest.instances) {
        const fp = path.join(root, inst.file)
        if (fs.existsSync(fp)) files.push({ file: fp, sopInstanceUid: inst.sopInstanceUid, instanceNumber: inst.instanceNumber, tomoAngle: inst.tomoAngle })
      }
    }
    return { series, files, manifest }
  }

  async getSlices(studyId: string, seriesUid?: string): Promise<{ study: DbtStudyDto; slices: DbtSliceDto[] }> {
    const study = this.findStudy(studyId)
    const dto = this.toStudyDto(study)
    const targets = seriesUid
      ? this.seriesForStudy(study).filter((s) => s.seriesInstanceUid === seriesUid)
      : this.seriesForStudy(study)
    if (targets.length === 0) throw new NotFoundException(`DBT series ${seriesUid ?? ''} not found`)

    const slices: DbtSliceDto[] = []
    for (const t of targets) {
      const { series, files } = this.resolveSliceFiles(study, t.seriesInstanceUid)
      const n = files.length > 0 ? files.length : series.sliceCount
      files.sort((a, b) => a.instanceNumber - b.instanceNumber)
      for (let i = 0; i < n; i++) {
        const inst = files[i]
        const fallbackAngle = Number((((i - (n - 1) / 2) / Math.max(1, n - 1)) * 30).toFixed(2))
        let pixelData: SlicePixelPayload | null = null
        let tomoAngle = inst?.tomoAngle ?? fallbackAngle
        if (inst) {
          try {
            const parsed = this.parseDicomPart10(fs.readFileSync(inst.file))
            if (parsed.tomoAngle !== null) tomoAngle = parsed.tomoAngle
            const aged = !study.isCurrent
            pixelData = this.pixelPayloadFromParsed(parsed, aged)
          } catch (e) {
            this.logger.debug(`getSlices parse failed ${inst.file}: ${(e as Error).message}`)
          }
        } else {
          pixelData = this.syntheticSlicePayload({ laterality: series.ref.laterality, columns: series.columns, rows: series.rows }, i, n, study)
        }
        slices.push({
          instanceNumber: inst?.instanceNumber ?? i + 1,
          sopInstanceUid: inst?.sopInstanceUid ?? `${series.seriesInstanceUid}.${i + 1}`,
          sliceLocation: Number(((i - (n - 1) / 2) * series.sliceThickness).toFixed(2)),
          tomoAngle,
          sliceThickness: series.sliceThickness,
          rows: series.rows,
          columns: series.columns,
          pixelData,
        })
      }
    }
    return { study: dto, slices }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 断层重建 (切片堆叠 → 厚度投影)
  // ────────────────────────────────────────────────────────────────────────────

  async reconstruct(
    studyId: string,
    seriesUid: string,
    projection: 'mip' | 'mean' = 'mip',
    thickness?: number,
  ): Promise<DbtReconstructResult> {
    const study = this.findStudy(studyId)
    const { series, files } = this.resolveSliceFiles(study, seriesUid)
    const n = files.length > 0 ? files.length : series.sliceCount
    const range = thickness && thickness > 0 ? Math.min(n, Math.round(thickness)) : n
    const start = Math.max(0, Math.floor((n - range) / 2))
    const end = Math.min(n - 1, start + range - 1)

    const width = series.columns
    const height = series.rows
    const grid = new Float32Array(width * height)
    if (projection === 'mip') grid.fill(-Infinity)
    let realUsed = 0

    files.sort((a, b) => a.instanceNumber - b.instanceNumber)
    for (let i = start; i <= end; i++) {
      const inst = files[i]
      let layer: Float32Array | null = null
      if (inst) {
        try {
          const parsed = this.parseDicomPart10(fs.readFileSync(inst.file))
          layer = this.parsedToGrid(parsed, width, height)
          realUsed++
        } catch {
          layer = null
        }
      }
      if (!layer) layer = this.syntheticLayer({ laterality: series.ref.laterality, columns: series.columns, rows: series.rows }, i, n, study)
      for (let p = 0; p < width * height; p++) {
        if (projection === 'mip') {
          if (layer[p] > grid[p]) grid[p] = layer[p]
        } else {
          grid[p] += layer[p]
        }
      }
    }
    if (projection === 'mean') {
      const cnt = Math.max(1, end - start + 1)
      for (let p = 0; p < width * height; p++) grid[p] /= cnt
    }

    const payload = this.gridToPayload(grid, width, height)
    return {
      studyId,
      seriesInstanceUid: seriesUid,
      projection,
      thickness: range,
      source: realUsed > 0 ? 'real' : 'synthetic',
      width,
      height,
      windowWidth: series.windowWidth,
      windowLevel: series.windowCenter,
      pixelData: payload,
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 双图对比
  // ────────────────────────────────────────────────────────────────────────────

  async compare(body: { currentStudyId: string; priorStudyId: string }): Promise<DbtCompareResult> {
    const currentStudy = this.findStudy(body.currentStudyId)
    const priorStudy = this.findStudy(body.priorStudyId)
    if (!currentStudy.isCurrent) throw new NotFoundException(`Study ${body.currentStudyId} is not a current DBT study`)
    if (priorStudy.isCurrent) throw new NotFoundException(`Study ${body.priorStudyId} is not a prior DBT study`)

    const current = this.toStudyDto(currentStudy)
    const prior = this.toStudyDto(priorStudy)
    const lateralityMap = current.series.map((cs) => ({
      laterality: cs.laterality,
      currentSeries: cs.seriesInstanceUid,
      priorSeries: prior.series.find((ps) => ps.laterality === cs.laterality)?.seriesInstanceUid,
    }))
    return { current, prior, lateralityMap }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // DICOM Part 10 解析 (Explicit/Implicit VR LE)
  // ────────────────────────────────────────────────────────────────────────────

  private parseDicomPart10(buf: Buffer): ParsedDicom {
    if (buf.length < 132 || buf.toString('ascii', 128, 132) !== 'DICM') {
      throw new Error('Not a DICOM Part 10 file')
    }
    const out: ParsedDicom = {
      rows: 0,
      columns: 0,
      bitsAllocated: 16,
      pixelRepresentation: 0,
      windowCenter: 40,
      windowWidth: 400,
      rescaleIntercept: 0,
      rescaleSlope: 1,
      instanceNumber: 0,
      sliceLocation: 0,
      sliceThickness: 1,
      tomoAngle: null,
      pixelData: Buffer.alloc(0),
    }
    const readDs = (value: Buffer): number => {
      const s = value.toString('ascii').replace(/\0/g, '').split('\\')[0]?.trim()
      const n = Number(s)
      return Number.isFinite(n) ? n : 0
    }
    let offset = 132
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
      if (group === 0x0028) {
        if (elem === 0x0010) out.rows = value.readUInt16LE(0)
        else if (elem === 0x0011) out.columns = value.readUInt16LE(0)
        else if (elem === 0x0100) out.bitsAllocated = value.readUInt16LE(0)
        else if (elem === 0x0103) out.pixelRepresentation = value.readUInt16LE(0)
        else if (elem === 0x1050) out.windowCenter = readDs(value)
        else if (elem === 0x1051) out.windowWidth = readDs(value)
        else if (elem === 0x1052) out.rescaleIntercept = readDs(value)
        else if (elem === 0x1053) out.rescaleSlope = readDs(value)
        else if (elem === 0x0030) {
          const parts = value.toString('ascii').replace(/\0/g, '').split('\\')
          void parts
        } else if (elem === 0x0050) out.sliceThickness = readDs(value)
      } else if (group === 0x0020) {
        if (elem === 0x0013) out.instanceNumber = Number(value.toString('ascii').replace(/\0/g, '').trim()) || 0
        else if (elem === 0x1041) out.sliceLocation = readDs(value)
      } else if (group === 0x0018 && elem === 0x1120) {
        out.tomoAngle = readDs(value)
      } else if (group === 0x7fe0 && elem === 0x0010) {
        out.pixelData = Buffer.from(value)
      }
      offset = dataStart + length
      if (length % 2 !== 0) offset++
    }
    if (out.rows === 0 || out.columns === 0) throw new Error('Missing Rows/Columns')
    return out
  }

  private parsedToGrid(parsed: ParsedDicom, width: number, height: number): Float32Array {
    const grid = new Float32Array(width * height)
    const pixel = parsed.pixelData
    const bytesPerVoxel = Math.max(2, Math.round(parsed.bitsAllocated / 8))
    const slope = parsed.rescaleSlope || 1
    const intercept = parsed.rescaleIntercept || 0
    const count = Math.min(width * height, Math.floor(pixel.length / bytesPerVoxel))
    for (let i = 0; i < count; i++) {
      const off = i * bytesPerVoxel
      const stored = bytesPerVoxel >= 4 ? pixel.readUInt32LE(off) : parsed.pixelRepresentation === 1 ? pixel.readInt16LE(off) : pixel.readUInt16LE(off)
      grid[i] = Math.round(stored * slope + intercept)
    }
    return grid
  }

  private pixelPayloadFromParsed(parsed: ParsedDicom, aged: boolean): SlicePixelPayload {
    const grid = this.parsedToGrid(parsed, parsed.columns, parsed.rows)
    if (aged) {
      for (let i = 0; i < grid.length; i++) grid[i] = Math.round(grid[i]! * 0.94 + 30)
    }
    return this.gridToPayload(grid, parsed.columns, parsed.rows)
  }

  private gridToPayload(grid: Float32Array, width: number, height: number): SlicePixelPayload {
    const data = new Int16Array(width * height)
    for (let i = 0; i < grid.length; i++) {
      const v = grid[i]
      data[i] = Number.isFinite(v) ? Math.round(Math.max(-32768, Math.min(32767, v))) : 0
    }
    return {
      dataBase64: Buffer.from(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength).toString('base64'),
      bitsAllocated: 16,
      signed: true,
      width,
      height,
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 合成回退 (无样本文件时)
  // ────────────────────────────────────────────────────────────────────────────

  private syntheticLayer(series: { laterality: 'L' | 'R'; columns: number; rows: number }, index: number, total: number, study: BuiltinStudy): Float32Array {
    const ref = study.seriesKeys.find((k) => k.laterality === series.laterality)
    const seed = ref?.seed ?? 91
    const layer = total > 1 ? index / (total - 1) : 0
    const grid = new Float32Array(series.columns * series.rows)
    for (let y = 0; y < series.rows; y++) {
      for (let x = 0; x < series.columns; x++) {
        grid[y * series.columns + x] = this.syntheticValue(x, y, layer, series.laterality, seed)
      }
    }
    return grid
  }

  private syntheticSlicePayload(series: { laterality: 'L' | 'R'; columns: number; rows: number }, index: number, total: number, study: BuiltinStudy): SlicePixelPayload {
    const grid = this.syntheticLayer(series, index, total, study)
    return this.gridToPayload(grid, series.columns, series.rows)
  }

  private noise2(x: number, y: number, seed: number): number {
    const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
    return (s - Math.floor(s)) * 2 - 1
  }

  private syntheticValue(x: number, y: number, layer: number, side: 'L' | 'R', seed: number): number {
    const CLUSTERS: Array<[number, number, number]> = [
      [-150, -40, 1.0], [90, 20, 0.85], [-60, 140, 1.2], [30, -180, 0.9],
      [170, -120, 1.1], [-200, 60, 1.0], [-10, -60, 1.3], [140, 180, 0.95],
    ]
    const n = this.noise2(x * 0.04, y * 0.04, seed)
    const n2 = this.noise2(x * 0.14, y * 0.14, seed + 17)
    const n3 = this.noise2(x * 0.5, y * 0.5, seed + 41)
    const lob = this.noise2(x * 0.06, y * 0.06, seed + 7)
    let sig = 320 + n * 40
    const dir = side === 'R' ? 1 : -1
    const cx = 256 + dir * 120
    const cy = 300
    const bx = (x - cx) * dir
    const by = y - cy
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
    sig += 60 * Math.sin(layer * Math.PI * 2 + (x + y) * 0.01)
    return Math.round(Math.max(0, Math.min(4095, sig)))
  }
}
