import { Injectable, NotFoundException } from '@nestjs/common'

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
}

const MOCK_FEATURES: RadiomicsFeature[] = [
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

@Injectable()
export class RadiomicsService {
  async extract(dto: ExtractRequest): Promise<RadiomicsResult> {
    const features = MOCK_FEATURES.map(f => ({ ...f, value: +(f.value * (0.9 + Math.random() * 0.2)).toFixed(2) }))
    STORED_FEATURES.set(dto.instanceId, features)
    return { instanceId: dto.instanceId, features }
  }

  async getFeatures(instanceId: string): Promise<RadiomicsResult> {
    const features = STORED_FEATURES.get(instanceId)
    if (!features) throw new NotFoundException(`No features found for instance ${instanceId}`)
    return { instanceId, features }
  }

  async compare(dto: CompareRequest): Promise<RadiomicsResult[]> {
    return dto.instanceIds.map((id, i) => {
      const roi = dto.rois[i]
      const features = MOCK_FEATURES.map(f => ({ ...f, value: +(f.value * (0.85 + Math.random() * 0.3)).toFixed(2) }))
      STORED_FEATURES.set(id, features)
      return { instanceId: id, features }
    })
  }
}
