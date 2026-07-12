import { Controller, Get, Post, Param, Body } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { VolumeService } from './volume.service'

const ReconstructSchema = z.object({ seriesUID: z.string().min(1) })
const MprSchema = z.object({ jobId: z.string().min(1), plane: z.enum(['axial', 'sagittal', 'coronal']), sliceIndex: z.number().int().min(0) })
const MipSchema = z.object({ jobId: z.string().min(1), direction: z.enum(['axial', 'sagittal', 'coronal']) })

@ApiTags('volume')
@ApiBearerAuth()
@Controller('volume')
export class VolumeController {
  constructor(private readonly service: VolumeService) {}

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
  mip(@Body(new ZodValidationPipe(MipSchema)) body: { jobId: string; direction: 'axial' | 'sagittal' | 'coronal' }) {
    return this.service.generateMIP(body)
  }
}
