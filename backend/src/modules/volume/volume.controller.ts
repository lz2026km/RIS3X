import { Controller, Get, Post, Param, Body } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { VolumeService } from './volume.service'

const ReconstructSchema = z.object({ seriesUID: z.string().min(1) })
const MprSchema = z.object({ jobId: z.string().min(1), plane: z.enum(['axial', 'sagittal', 'coronal']), sliceIndex: z.number().int().min(0) })
const MipSchema = z.object({ jobId: z.string().min(1), direction: z.enum(['axial', 'sagittal', 'coronal']), thickness: z.number().int().min(1).optional() })
const VrSchema = z.object({
  jobId: z.string().min(1),
  preset: z.enum(['default', 'bone', 'softTissue', 'vessel', 'lung']).optional(),
  opacity: z.number().min(0).max(1).optional(),
  rotation: z.object({ x: z.number().optional(), y: z.number().optional(), z: z.number().optional() }).optional(),
})

@ApiTags('volume')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('volume')
export class VolumeController {
  constructor(private readonly service: VolumeService) {}

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
}
