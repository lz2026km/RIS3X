/**
 * [G005 Wave 10A] 眼科像素级图像处理控制器 (@Controller('eye/pixel'))
 * 对齐前端 eyeApi.pixel 方法与 MSW eyePixelRenderModule 形状。
 */
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { EyePixelService } from './eye-pixel.service'

const InstanceBodySchema = z.object({ instanceId: z.string().min(1) })
const MprBodySchema = z.object({
  studyId: z.string().min(1),
  axis: z.enum(['axial', 'sagittal', 'coronal']).optional(),
  seriesIds: z.array(z.string()).optional(),
})

@ApiTags('eye-pixel')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('eye/pixel')
export class EyePixelController {
  constructor(private readonly service: EyePixelService) {}

  /** GET /eye/pixel/instance/:instanceId — 实例元数据 */
  @Get('instance/:instanceId')
  getInstance(@Param('instanceId') instanceId: string) {
    return { success: true, data: this.service.getInstance(instanceId) }
  }

  /** GET /eye/pixel/histogram/:instanceId — 256-bin 直方图 */
  @Get('histogram/:instanceId')
  getHistogram(@Param('instanceId') instanceId: string, @Query('frame') frame?: string) {
    return { success: true, data: this.service.getHistogram(instanceId, frame ? Number(frame) : 0) }
  }

  /** GET /eye/pixel/colormap/:modality — 伪彩映射表 (8 种) */
  @Get('colormap/:modality')
  getColormap(@Param('modality') modality: string) {
    return { success: true, data: this.service.getColormap(modality) }
  }

  /** GET /eye/pixel/colormaps — 全部 colormap 目录 */
  @Get('colormaps')
  listColormaps() {
    return { success: true, data: this.service.listColormaps() }
  }

  /** POST /eye/pixel/sharpness — 锐度评估 */
  @Post('sharpness')
  analyzeSharpness(@Body(new ZodValidationPipe(InstanceBodySchema)) body: z.infer<typeof InstanceBodySchema>) {
    return { success: true, data: this.service.analyzeSharpness(body) }
  }

  /** POST /eye/pixel/mpr — MPR 重建 */
  @Post('mpr')
  createMpr(@Body(new ZodValidationPipe(MprBodySchema)) body: z.infer<typeof MprBodySchema>) {
    return { success: true, data: this.service.createMpr(body) }
  }

  /** POST /eye/pixel/detect-artifact — 伪影检测 */
  @Post('detect-artifact')
  detectArtifact(@Body(new ZodValidationPipe(InstanceBodySchema)) body: z.infer<typeof InstanceBodySchema>) {
    return { success: true, data: this.service.detectArtifact(body) }
  }
}
