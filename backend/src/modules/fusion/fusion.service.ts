import { Injectable } from '@nestjs/common'

interface RegisterDto {
  fixedSeriesUid: string
  movingSeriesUid: string
  transformType: 'rigid' | 'affine' | 'deformable'
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

@Injectable()
export class FusionService {
  async register(dto: RegisterDto) {
    return {
      registrationId: `reg-${Date.now()}`,
      fixedSeriesUid: dto.fixedSeriesUid,
      movingSeriesUid: dto.movingSeriesUid,
      transformType: dto.transformType,
      status: 'completed',
      metrics: {
        dice: 0.89,
        hd95: 2.34,
        rmse: 12.7,
      },
      matrix: [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ],
    }
  }

  async render(dto: RenderDto) {
    return {
      frameId: `frame-${Date.now()}`,
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
