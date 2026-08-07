import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { VolumeService } from './volume.service'
import { SegmentationService } from './segmentation.service'

const ReconstructSchema = z.object({ seriesUID: z.string().min(1) })
const MprSchema = z.object({ jobId: z.string().min(1), plane: z.enum(['axial', 'sagittal', 'coronal']), sliceIndex: z.number().int().min(0) })
const MipSchema = z.object({ jobId: z.string().min(1), direction: z.enum(['axial', 'sagittal', 'coronal']), thickness: z.number().int().min(1).optional() })
const VrSchema = z.object({
  jobId: z.string().min(1),
  preset: z.enum(['default', 'bone', 'softTissue', 'vessel', 'lung']).optional(),
  opacity: z.number().min(0).max(1).optional(),
  rotation: z.object({ x: z.number().optional(), y: z.number().optional(), z: z.number().optional() }).optional(),
})
const SegmentSchema = z.object({
  seriesUID: z.string().min(1),
  target: z.enum(['nodule', 'bone', 'liver', 'lung']),
  thresholdMin: z.number().optional(),
  thresholdMax: z.number().optional(),
  seed: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional(),
  minVoxels: z.number().int().positive().optional(),
  maxVoxels: z.number().int().positive().optional(),
})
const CreateSegmentationSchema = z.object({
  label: z.string().min(1),
  color: z.string().min(1).default('#ff4d4f'),
  voxelIndices: z.array(z.number().int().nonnegative()).max(200000).default([]),
})

@ApiTags('volume')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('volume')
export class VolumeController {
  constructor(
    private readonly service: VolumeService,
    private readonly segmentation: SegmentationService,
  ) {}

  @Get('series')
  series() {
    return this.service.listSeries()
  }

  @Post('reconstruct')
  reconstruct(@Body(new ZodValidationPipe(ReconstructSchema)) body: { seriesUID: string }) {
    return this.service.reconstruct(body.seriesUID)
  }

  @Get('status/:jobId')
  status(@Param('jobId') jobId: string) {
    return this.service.getStatus(jobId)
  }

  @Post('mpr')
  mpr(@Body(new ZodValidationPipe(MprSchema)) body: { jobId: string; plane: 'axial' | 'sagittal' | 'coronal'; sliceIndex: number }) {
    return this.service.generateMPR(body)
  }

  @Post('mip')
  mip(@Body(new ZodValidationPipe(MipSchema)) body: { jobId: string; direction: 'axial' | 'sagittal' | 'coronal'; thickness?: number }) {
    return this.service.generateMIP(body)
  }

  @Post('vr')
  vr(@Body(new ZodValidationPipe(VrSchema)) body: { jobId: string; preset?: string; opacity?: number; rotation?: { x?: number; y?: number; z?: number } }) {
    return this.service.generateVR(body)
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Phase 1.7: 3D 分割与定量 (nodule/bone/liver/lung + HU 直方图)
  // ────────────────────────────────────────────────────────────────────────────

  @Post('segment')
  segment(@Body(new ZodValidationPipe(SegmentSchema)) body: {
    seriesUID: string
    target: 'nodule' | 'bone' | 'liver' | 'lung'
    thresholdMin?: number
    thresholdMax?: number
    seed?: { x: number; y: number; z: number }
    minVoxels?: number
    maxVoxels?: number
  }) {
    return this.segmentation.segment(body)
  }

  @Post('segment/:segId/quantify')
  quantify(@Param('segId') segId: string) {
    return this.segmentation.quantify(segId)
  }

  @Get('segmentations/:seriesUID')
  segmentations(@Param('seriesUID') seriesUID: string) {
    return this.segmentation.listSegmentations(seriesUID)
  }

  @Post('segmentations/:id/approve')
  approve(@Param('id') id: string) {
    return this.segmentation.approve(id)
  }

  // ────────────────────────────────────────────────────────────────────────────
  // [W2-C] 手动标注管理 (SegmentationPage: 参数化创建 / 列表 / 删除)
  // ────────────────────────────────────────────────────────────────────────────

  @Get(':studyUid/segmentations')
  listManualSegmentations(@Param('studyUid') studyUid: string) {
    return this.segmentation.listManualSegmentations(studyUid)
  }

  @Post(':studyUid/segmentations')
  createSegmentation(
    @Param('studyUid') studyUid: string,
    @Body(new ZodValidationPipe(CreateSegmentationSchema)) body: { label: string; color?: string; voxelIndices?: number[] },
  ) {
    return this.segmentation.createManualSegmentation(studyUid, body)
  }

  @Delete('segmentations/:id')
  deleteSegmentation(@Param('id') id: string) {
    return this.segmentation.deleteManualSegmentation(id)
  }
}
