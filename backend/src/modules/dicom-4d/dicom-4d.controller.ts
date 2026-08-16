import { Controller, Post, Get, Param, Body, HttpCode, Logger } from '@nestjs/common'
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { Dicom4dService } from './dicom-4d.service'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'

const FramesSchema = z.object({ seriesUid: z.string().min(1) })

@ApiTags('dicom-4d')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('dicom/4d')
export class Dicom4dController {
  private readonly logger = new Logger(Dicom4dController.name)
  constructor(private readonly service: Dicom4dService) {}

  @Post('list')
  @ApiOperation({ summary: 'List 4D series' })
  list() {
    return this.service.list()
  }

  @Post('frames')
  @ApiOperation({ summary: 'Get 4D frame sequence (per-instance phase-assigned frame stream)' })
  getFrames(@Body(new ZodValidationPipe(FramesSchema)) body: { seriesUid: string }) {
    return this.service.getFrames(body.seriesUid)
  }

  @Get('phase/:seriesUid')
  @ApiOperation({ summary: 'Get cardiac/respiratory phase for 4D series' })
  getPhase(@Param('seriesUid') seriesUid: string) {
    return this.service.getPhase(seriesUid)
  }

  // ==================== [G005 v3.0.6.11-101 Wave 1B (G-07)] 真实帧源新端点 ====================

  @Post('phase-info')
  @HttpCode(200)
  @ApiOperation({ summary: '[G-07] Series phase distribution (cardiac 0-19 / respiratory 0-9 bins)' })
  getPhaseInfo(@Body(new ZodValidationPipe(FramesSchema)) body: { seriesUid: string }) {
    return this.service.getPhaseInfo(body.seriesUid)
  }

  @Post('movie')
  @HttpCode(200)
  @ApiOperation({ summary: '[G-07] 4D movie render data: interpolation params + ECG/RR interval curve' })
  getMovieData(@Body(new ZodValidationPipe(FramesSchema)) body: { seriesUid: string }) {
    return this.service.getMovieData(body.seriesUid)
  }
}
