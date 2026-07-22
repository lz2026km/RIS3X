import { Injectable } from '@nestjs/common'

interface RegisterDto {
  fixedSeriesUid: string
  movingSeriesUid: string
  transformType: 'rigid' | 'affine' | 'deformable' | 'nonlinear'
}

interface RenderDto {
  fixedSeriesUid: string
  movingSeriesUid: string
  plane: 'axial' | 'coronal' | 'sagittal'
  sliceIndex: number
  alpha: number
  windowWidth: number
  windowLevel: number
  fusionWindowWidth: number
  fusionWindowLevel: number
}

const TRANSFORM_METRICS: Record<string, { dice: number; hd95: number; rmse: number }> = {
  rigid: { dice: 0.82, hd95: 3.12, rmse: 18.4 },
  affine: { dice: 0.87, hd95: 2.45, rmse: 14.2 },
  deformable: { dice: 0.92, hd95: 1.67, rmse: 9.8 },
  nonlinear: { dice: 0.94, hd95: 1.21, rmse: 7.3 },
}

const TRANSFORM_MATRICES: Record<string, number[][]> = {
  rigid: [
    [0.998, -0.015, 0.003, 1.2],
    [0.015, 0.999, -0.008, -0.8],
    [-0.003, 0.008, 0.999, 0.5],
    [0, 0, 0, 1],
  ],
  affine: [
    [0.995, -0.022, 0.010, 2.1],
    [0.018, 1.002, -0.012, -1.3],
    [-0.007, 0.011, 0.996, 0.9],
    [0, 0, 0, 1],
  ],
  deformable: [
    [0.985, -0.035, 0.018, 3.4],
    [0.028, 0.978, -0.021, -2.1],
    [-0.015, 0.019, 0.982, 1.6],
    [0, 0, 0, 1],
  ],
  nonlinear: [
    [0.972, -0.048, 0.025, 4.7],
    [0.039, 0.965, -0.031, -3.2],
    [-0.022, 0.027, 0.968, 2.8],
    [0, 0, 0, 1],
  ],
}

@Injectable()
export class FusionV2Service {
  async register(dto: RegisterDto) {
    const metrics = TRANSFORM_METRICS[dto.transformType] ?? TRANSFORM_METRICS.rigid
    const matrix = TRANSFORM_MATRICES[dto.transformType] ?? TRANSFORM_MATRICES.rigid
    return {
      registrationId: `reg-v2-${Date.now()}`,
      fixedSeriesUid: dto.fixedSeriesUid,
      movingSeriesUid: dto.movingSeriesUid,
      transformType: dto.transformType,
      status: 'completed',
      metrics,
      matrix,
      processingTimeMs: Math.round(150 + Math.random() * 350),
    }
  }

  async render(dto: RenderDto) {
    return {
      frameId: `frame-v2-${Date.now()}`,
      width: 512,
      height: 512,
      alpha: dto.alpha,
      plane: dto.plane,
      sliceIndex: dto.sliceIndex,
      pixelDataBase64: '',
      windowWidth: dto.windowWidth,
      windowLevel: dto.windowLevel,
      fusionWindowWidth: dto.fusionWindowWidth,
      fusionWindowLevel: dto.fusionWindowLevel,
    }
  }

  async getSeries(patientId: string) {
    const seriesMap: Record<string, { modality: string; seriesDescription: string; instanceCount: number }[]> = {
      'P001': [
        { modality: 'CT', seriesDescription: 'Chest CT', instanceCount: 128 },
        { modality: 'PT', seriesDescription: 'PET Whole Body', instanceCount: 128 },
      ],
      'P002': [
        { modality: 'MR', seriesDescription: 'Brain T1', instanceCount: 160 },
        { modality: 'MR', seriesDescription: 'Brain DWI', instanceCount: 160 },
      ],
      'P003': [
        { modality: 'MR', seriesDescription: 'Brain T1+C', instanceCount: 160 },
        { modality: 'MR', seriesDescription: 'Brain T2', instanceCount: 160 },
      ],
    }
    return {
      patientId,
      series: seriesMap[patientId] ?? [
        { modality: 'CT', seriesDescription: 'Standard CT', instanceCount: 128 },
        { modality: 'PT', seriesDescription: 'PET Standard', instanceCount: 128 },
      ],
    }
  }
}
