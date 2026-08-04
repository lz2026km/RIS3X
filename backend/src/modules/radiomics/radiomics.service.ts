import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { floatInRange } from '../../common/utils/deterministic-hash'

export interface RoiDefinition {
  instanceId: string
  type: 'rectangle' | 'ellipse' | 'polygon'
  coordinates: number[]
}

export interface ExtractRequest {
  instanceId: string
  roi: RoiDefinition
}

export interface CompareRequest {
  instanceIds: string[]
  rois: RoiDefinition[]
}

export interface RadiomicsFeature {
  category: string
  name: string
  value: number
  unit: string
}

export interface RadiomicsResult {
  instanceId: string
  features: RadiomicsFeature[]
  /** true = DB 不可用, 结果未落库 (内存/确定性生成) */
  simulated?: boolean
}

const BASE_FEATURES: RadiomicsFeature[] = [
  { category: 'Shape', name: 'Volume', value: 125.4, unit: 'mm³' },
  { category: 'Shape', name: 'SurfaceArea', value: 210.8, unit: 'mm²' },
  { category: 'Shape', name: 'Compactness1', value: 0.87, unit: '1' },
  { category: 'Shape', name: 'Sphericity', value: 0.76, unit: '1' },
  { category: 'Shape', name: 'Elongation', value: 0.45, unit: '1' },
  { category: 'FirstOrder', name: 'Mean', value: 85.3, unit: 'HU' },
  { category: 'FirstOrder', name: 'Median', value: 82.0, unit: 'HU' },
  { category: 'FirstOrder', name: 'StdDev', value: 42.1, unit: 'HU' },
  { category: 'FirstOrder', name: 'Skewness', value: 0.23, unit: '1' },
  { category: 'FirstOrder', name: 'Kurtosis', value: 2.89, unit: '1' },
  { category: 'FirstOrder', name: 'Entropy', value: 6.34, unit: 'bits' },
  { category: 'GLCM', name: 'Contrast', value: 128.5, unit: '1' },
  { category: 'GLCM', name: 'Correlation', value: 0.62, unit: '1' },
  { category: 'GLCM', name: 'Energy', value: 0.18, unit: '1' },
  { category: 'GLCM', name: 'Homogeneity', value: 0.73, unit: '1' },
  { category: 'GLRLM', name: 'ShortRunEmphasis', value: 0.91, unit: '1' },
  { category: 'GLRLM', name: 'LongRunEmphasis', value: 1.24, unit: '1' },
  { category: 'GLSZM', name: 'SizeZoneNonUniformity', value: 45.6, unit: '1' },
  { category: 'Wavelet', name: 'Wavelet-HLL_Mean', value: 72.1, unit: 'HU' },
  { category: 'Wavelet', name: 'Wavelet-HLH_Entropy', value: 5.89, unit: 'bits' },
]

const STORED_FEATURES = new Map<string, RadiomicsFeature[]>()

function roiIdOf(roi?: RoiDefinition): string {
  if (!roi) return 'default'
  return `${roi.type}:${roi.coordinates.slice(0, 6).join('_')}`
}

/**
 * 确定性特征: 以 (instanceId, roiId, featureName) 为种子, 围绕基础值 ±10% 抖动,
 * 同输入恒定输出 (无 Math.random)。
 */
function generateFeatures(instanceId: string, roiId: string): RadiomicsFeature[] {
  return BASE_FEATURES.map((f) => {
    const seed = `${instanceId}:${roiId}:${f.name}`
    const value = Math.round(floatInRange(seed, 0.9 * f.value, 1.1 * f.value, 2, 2) * 100) / 100
    return { ...f, value }
  })
}

@Injectable()
export class RadiomicsService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(row: { instanceUid: string; category: string | null; featureName: string; value: number; unit: string | null }): RadiomicsFeature {
    return { category: row.category ?? '', name: row.featureName, value: row.value, unit: row.unit ?? '' }
  }

  private async persist(instanceId: string, roiId: string, features: RadiomicsFeature[]): Promise<void> {
    await this.prisma.radiomicsFeature.createMany({
      data: features.map((f) => ({
        instanceUid: instanceId,
        roiId,
        category: f.category,
        featureName: f.name,
        value: f.value,
        unit: f.unit,
      })),
    })
  }

  async extract(dto: ExtractRequest): Promise<RadiomicsResult> {
    const roiId = roiIdOf(dto.roi)
    const features = generateFeatures(dto.instanceId, roiId)
    try {
      await this.persist(dto.instanceId, roiId, features)
      return { instanceId: dto.instanceId, features }
    } catch {
      STORED_FEATURES.set(dto.instanceId, features)
      return { instanceId: dto.instanceId, features, simulated: true }
    }
  }

  async getFeatures(instanceId: string): Promise<RadiomicsResult> {
    try {
      const rows = await this.prisma.radiomicsFeature.findMany({ where: { instanceUid: instanceId } })
      if (rows.length === 0) throw new NotFoundException(`No features found for instance ${instanceId}`)
      return { instanceId, features: rows.map((r) => this.toDto(r)) }
    } catch (error) {
      if (error instanceof NotFoundException) throw error
      const features = STORED_FEATURES.get(instanceId)
      if (!features) throw new NotFoundException(`No features found for instance ${instanceId}`)
      return { instanceId, features, simulated: true }
    }
  }

  async compare(dto: CompareRequest): Promise<RadiomicsResult[]> {
    return Promise.all(dto.instanceIds.map(async (id, i) => {
      const roi = dto.rois[i]
      const roiId = roiIdOf(roi)
      const features = generateFeatures(id, roiId)
      try {
        await this.persist(id, roiId, features)
        return { instanceId: id, features }
      } catch {
        STORED_FEATURES.set(id, features)
        return { instanceId: id, features, simulated: true }
      }
    }))
  }
}
