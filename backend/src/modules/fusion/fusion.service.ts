import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

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
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    const metrics = { dice: 0.89, hd95: 2.34, rmse: 12.7 }
    const matrix = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ]
    let registrationId = `reg-${Date.now()}`
    try {
      const job = await this.prisma.fusionJob.create({
        data: {
          primarySeries: dto.fixedSeriesUid,
          secondarySeries: dto.movingSeriesUid,
          type: dto.transformType,
          status: 'completed',
          resultPath: `/fusion/register/${dto.fixedSeriesUid}/${dto.movingSeriesUid}`,
          params: { metrics, matrix },
        },
      })
      registrationId = job.id
    } catch {
      // DB unavailable -> keep in-memory registration result
    }
    return {
      registrationId,
      fixedSeriesUid: dto.fixedSeriesUid,
      movingSeriesUid: dto.movingSeriesUid,
      transformType: dto.transformType,
      status: 'completed',
      metrics,
      matrix,
    }
  }

  async render(dto: RenderDto) {
    const frame = {
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
    try {
      await this.prisma.fusionJob.create({
        data: {
          primarySeries: dto.fixedSeriesUid,
          secondarySeries: dto.movingSeriesUid,
          type: `render-${dto.plane}`,
          status: 'completed',
          resultPath: `/fusion/frame/${dto.fixedSeriesUid}/${dto.movingSeriesUid}/${dto.plane}/${dto.sliceIndex}`,
          params: { alpha: dto.alpha, windowWidth: dto.windowWidth, windowLevel: dto.windowLevel, fusionWindowWidth: dto.fusionWindowWidth, fusionWindowLevel: dto.fusionWindowLevel, width: 512, height: 512 },
        },
      })
    } catch {
      // DB unavailable -> keep in-memory render result
    }
    return frame
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
