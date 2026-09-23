/**
 * G005 放射RIS系统 - 口腔影像后处理 (dental-imaging) 服务 (孤儿模块)
 *
 * 覆盖前端 dentalApi 中尚无后端实现的口腔影像后处理端点:
 *   - GET  /dental/studies/:id/dicom-paths
 *   - GET  /dental/studies/:id/segments / POST /dental/studies/:id/segment
 *   - GET  /dental/studies/:id/mpr
 *   - GET  /dental/studies/:id/3d-model
 *   - GET  /dental/cbct/:id/nerve-canal | /bone-density | /measure
 *   - GET  /dental/scan/:id/compare | POST /dental/scan/:id/align
 *   - GET  /dental/cad/milling-status/:id
 *   - GET  /dental/implant/abutments
 *   - GET  /dental/implant/inventory/price-check
 *
 * 无 DB 依赖: 全部由确定性种子 (seed) 与内存 store 派生, 可无 DB 启动。
 * 伪随机均为确定性 (同 id 同结果), 便于测试复现。
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'

// ================= 类型定义 =================

export interface DicomSeriesPath {
  path: string
  modality: string
  instanceCount: number
}

export interface DentalSegment {
  id: string
  type: string
  label: string
  volume: number
  color: string
}

export interface NerveCanalData {
  lowerAlveolarNerve: { path: number[][]; diameter: number; safeDistance: number }
  mentalForamen: { left: { x: number; y: number; z: number }; right: { x: number; y: number; z: number } }
}

export interface BoneDensityData {
  regions: Array<{ region: string; density: number; unit: string }>
}

export interface DentalMeasureData {
  measurements: Array<{ id: string; type: string; label: string; value: number; unit: string }>
}

export interface MillingStatus {
  id: string
  status: string
  progress: number
  estimatedRemaining: string
  errors: string[]
}

export interface ImplantAbutment {
  id: string
  brand: string
  type: string
  height: number
  angle: number
  price: number
}

export interface PriceCheckItem {
  modelId: string
  brand: string | null
  price: number
}

interface SeedStudyImaging {
  id: string
  modality: string
}

// ================= 种子数据 =================

const SEED_DENTAL_IMAGING_STUDIES: SeedStudyImaging[] = [
  { id: 'DENT-CBCT-001', modality: 'CBCT' },
  { id: 'DENT-CBCT-002', modality: 'CBCT' },
  { id: 'DENT-PANO-001', modality: 'Panoramic' },
  { id: 'DENT-SCAN-001', modality: 'Scan' },
  { id: 'DENT-SCAN-002', modality: 'Scan' },
  { id: 'DENT-PERI-001', modality: 'Periapical' },
  { id: 'DENT-BITE-001', modality: 'Bitewing' },
]

const SEED_ABUTMENTS: ImplantAbutment[] = [
  { id: 'abt-001', brand: 'Straumann', type: 'titanium-straight', height: 4.0, angle: 0, price: 1280 },
  { id: 'abt-002', brand: 'Straumann', type: 'zirconia', height: 5.0, angle: 15, price: 2350 },
  { id: 'abt-003', brand: 'Nobel', type: 'titanium-angulated', height: 4.5, angle: 17, price: 1420 },
  { id: 'abt-004', brand: 'Dentsply', type: 'titanium-straight', height: 3.5, angle: 0, price: 1150 },
]

const SEED_IMPLANT_PRICES: Record<string, number> = {
  'ST-SL-3.3-10': 1980,
  'ST-SL-4.1-10': 2180,
  'NB-CC-3.5-11.5': 2450,
  'NB-CC-4.3-13': 2650,
  'DP-ASTR-3.8-11': 1720,
  'DP-ASTR-4.5-13': 1880,
}

function hashStr(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

@Injectable()
export class DentalImagingService {
  /** segments per study (内存 store, POST /segment 追加) */
  private readonly segmentsByStudy = new Map<string, DentalSegment[]>()

  private modalityOf(id: string): string {
    const seeded = SEED_DENTAL_IMAGING_STUDIES.find((s) => s.id === id)
    if (seeded) return seeded.modality
    const h = hashStr(id)
    const modalities = ['CBCT', 'Panoramic', 'Periapical', 'Scan', 'Bitewing']
    return modalities[h % modalities.length]!
  }

  private segmentsFor(id: string): DentalSegment[] {
    const existing = this.segmentsByStudy.get(id)
    if (existing) return existing
    const modality = this.modalityOf(id)
    const seed: DentalSegment[] =
      modality === 'CBCT'
        ? [
            { id: `${id}-SEG-1`, type: 'bone', label: '下颌骨', volume: 18200, color: '#8fa3b8' },
            { id: `${id}-SEG-2`, type: 'teeth', label: '牙列', volume: 6400, color: '#e8c46a' },
            { id: `${id}-SEG-3`, type: 'nerve', label: '下牙槽神经管', volume: 320, color: '#38d9a9' },
          ]
        : [{ id: `${id}-SEG-1`, type: 'teeth', label: '牙列', volume: 5400, color: '#e8c46a' }]
    this.segmentsByStudy.set(id, seed)
    return seed
  }

  // ================= 影像路径 / MPR / 3D =================

  /** GET /dental/studies/:id/dicom-paths */
  getDicomPaths(id: string): { success: true; data: { series: DicomSeriesPath[] } } {
    const modality = this.modalityOf(id)
    const h = hashStr(id)
    const instanceCount = modality === 'CBCT' ? 240 + (h % 200) : 1 + (h % 4)
    return {
      success: true,
      data: {
        series: [
          { path: `/pacs/dental/${id}/series/1`, modality, instanceCount },
          { path: `/pacs/dental/${id}/series/2`, modality: 'SecondaryCapture', instanceCount: 1 },
        ],
      },
    }
  }

  /** GET /dental/studies/:id/segments */
  getSegments(id: string): { success: true; data: { segments: DentalSegment[] } } {
    return { success: true, data: { segments: this.segmentsFor(id) } }
  }

  /** POST /dental/studies/:id/segment */
  triggerSegment(id: string, body: { model?: string }): { success: true; data: DentalSegment } {
    const model = (body?.model ?? 'tooth').trim() || 'tooth'
    const list = this.segmentsFor(id)
    const seg: DentalSegment = {
      id: `seg-${Date.now().toString(36)}-${list.length + 1}`,
      type: model,
      label: '自动分割结果',
      volume: 100,
      color: '#52c41a',
    }
    list.push(seg)
    this.segmentsByStudy.set(id, list)
    return { success: true, data: seg }
  }

  /** GET /dental/studies/:id/mpr */
  getMpr(id: string) {
    const h = hashStr(id)
    return {
      success: true,
      data: {
        axes: ['axial', 'sagittal', 'coronal'],
        sliceCount: 80 + (h % 120),
        resolution: '512x512',
        format: 'DICOM',
      },
    }
  }

  /** GET /dental/studies/:id/3d-model */
  get3dModel(id: string) {
    const modality = this.modalityOf(id)
    const isScan = modality === 'Scan'
    return {
      success: true,
      data: {
        modelUrl: `/api/v1/dental/studies/${id}/3d-model.stl`,
        format: isScan ? 'STL' : 'OBJ',
        triangleCount: 50000,
        size: '2.4 MB',
      },
    }
  }

  // ================= CBCT 专项 =================

  /** GET /dental/cbct/:id/nerve-canal */
  getNerveCanal(id: string): { success: true; data: NerveCanalData } {
    const h = hashStr(id)
    return {
      success: true,
      data: {
        lowerAlveolarNerve: {
          path: [
            [100, 200, 50],
            [105, 210, 55],
            [110, 220, 60],
          ],
          diameter: 3.2,
          safeDistance: 6 + (h % 40) / 10,
        },
        mentalForamen: {
          left: { x: 45, y: 180, z: 30 },
          right: { x: 155, y: 180, z: 30 },
        },
      },
    }
  }

  /** GET /dental/cbct/:id/bone-density */
  getBoneDensity(id: string): { success: true; data: BoneDensityData } {
    const h = hashStr(id)
    const d = (base: number, offset: number) => base + ((h + offset) % 200) - 100
    return {
      success: true,
      data: {
        regions: [
          { region: '下颌前牙区', density: d(850, 1), unit: 'HU' },
          { region: '下颌后牙区', density: d(1100, 2), unit: 'HU' },
          { region: '上颌前牙区', density: d(720, 3), unit: 'HU' },
          { region: '上颌后牙区', density: d(480, 4), unit: 'HU' },
          { region: '颏部', density: d(1450, 5), unit: 'HU' },
        ],
      },
    }
  }

  /** GET /dental/cbct/:id/measure */
  getCbctMeasure(id: string): { success: true; data: DentalMeasureData } {
    return {
      success: true,
      data: {
        measurements: [
          { id: 'meas-1', type: 'distance', label: '缺牙区骨高度', value: 12.5, unit: 'mm' },
          { id: 'meas-2', type: 'distance', label: '下牙槽神经管距牙槽嵴', value: 15.2, unit: 'mm' },
          { id: 'meas-3', type: 'angle', label: '下颌平面角', value: 28.5, unit: '°' },
        ],
      },
    }
  }

  // ================= 口扫 =================

  /** GET /dental/scan/:id/compare */
  compareScan(id: string) {
    const h = hashStr(id)
    return {
      success: true,
      data: {
        differences: {
          volume: Math.round((0.05 + (h % 200) / 1000) * 100) / 100,
          surfaceArea: Math.round((0.02 + (h % 100) / 1000) * 100) / 100,
          toothMovement: [
            { toothNo: 11, movement: 0.2 + (h % 5) / 10, unit: 'mm' },
            { toothNo: 21, movement: 0.1 + (h % 4) / 10, unit: 'mm' },
          ],
        },
      },
    }
  }

  /** POST /dental/scan/:id/align */
  alignScan(id: string, body: { targetScanId?: string }) {
    const targetScanId = (body?.targetScanId ?? '').trim()
    if (!targetScanId) throw new BadRequestException('targetScanId 不能为空')
    return {
      success: true,
      data: {
        aligned: true,
        sourceScanId: id,
        targetScanId,
        rmsError: 0.08,
        alignedAt: new Date().toISOString(),
      },
    }
  }

  // ================= CAD/CAM =================

  /** GET /dental/cad/milling-status/:id */
  getMillingStatus(id: string): { success: true; data: MillingStatus } {
    const h = hashStr(id)
    const progress = 20 + (h % 75)
    return {
      success: true,
      data: {
        id,
        status: progress >= 100 ? 'completed' : 'in-progress',
        progress,
        estimatedRemaining: progress >= 100 ? '0min' : `${Math.max(1, Math.round((100 - progress) / 12))}min`,
        errors: [],
      },
    }
  }

  // ================= 种植体库 =================

  /** GET /dental/implant/abutments?brand= */
  listAbutments(brand?: string): { success: true; data: ImplantAbutment[] } {
    const data = SEED_ABUTMENTS.filter((a) => !brand || a.brand === brand)
    return { success: true, data }
  }

  /** GET /dental/implant/inventory/price-check?brand=&models=a,b,c */
  priceCheck(brand?: string, modelsParam?: string): { success: true; data: PriceCheckItem[] } {
    const models = (modelsParam ?? '')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean)
    if (models.length === 0) throw new BadRequestException('models 不能为空')
    const data: PriceCheckItem[] = models.map((modelId) => {
      const seeded = SEED_IMPLANT_PRICES[modelId]
      const price = seeded ?? 1500 + (hashStr(modelId) % 2200)
      return { modelId, brand: brand ?? null, price }
    })
    return { success: true, data }
  }

  /** 不存在检查: 仅用于影像专项, id 缺失时抛 404 (含 study/scan/cbct 前缀) */
  assertImagingId(id: string, kind: string): void {
    if (!id || id.trim().length === 0) throw new NotFoundException(`${kind} ${id} not found`)
  }
}
