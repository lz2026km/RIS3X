import { api } from './client'
import type { ApiResponse } from './types'

export interface RoiDefinition {
  instanceId: string
  type: 'rectangle' | 'ellipse' | 'polygon'
  coordinates: number[]
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

export interface CompareRequest {
  instanceIds: string[]
  rois: RoiDefinition[]
}

export const radiomicsApi = {
  extract: (instanceId: string, roi: Omit<RoiDefinition, 'instanceId'>) =>
    api.post<ApiResponse<RadiomicsResult>>('/radiomics/extract', { instanceId, roi }),

  getFeatures: (instanceId: string) =>
    api.get<ApiResponse<RadiomicsResult>>(`/radiomics/features/${instanceId}`),

  compare: (body: CompareRequest) =>
    api.post<ApiResponse<RadiomicsResult[]>>('/radiomics/compare', body),
}
