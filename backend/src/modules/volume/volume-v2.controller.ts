/**
 * G005 RIS - [v3.0.6.11-101 Wave 3A] 多平面重建 V2 控制器
 *
 * 端点 (均 POST, @HttpCode(200)):
 *   POST /volume-v2/mpr-linked  三平面联动切片 + 相交线参数
 *   POST /volume-v2/cpr         曲面重建拉直图 + 路径投影
 *   POST /volume-v2/vr          光线投射体绘制 (yaw/pitch + 传输函数预设)
 *   POST /volume-v2/cut         任意切面裁剪 → 截面图像 + 统计
 *
 * 入参 jobId / seriesUID 均可选: jobId 命中缓存 > seriesUID 真实体 > 内置合成体回退。
 */
import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { VolumeV2Service, type CprPoint, type Vec3, type VrPreset } from './volume-v2.service'

const Vec3Schema = z.object({ x: z.number(), y: z.number(), z: z.number() })

const MprLinkedSchema = z.object({
  jobId: z.string().min(1).optional(),
  seriesUID: z.string().min(1).optional(),
  position: Vec3Schema,
})

const CprSchema = z.object({
  jobId: z.string().min(1).optional(),
  seriesUID: z.string().min(1).optional(),
  points: z.array(Vec3Schema).min(2).max(256),
  spacing: z.number().min(0.5).optional(),
  crossWidth: z.number().int().min(3).max(101).optional(),
})

const VrSchema = z.object({
  jobId: z.string().min(1).optional(),
  seriesUID: z.string().min(1).optional(),
  yaw: z.number().min(-360).max(360).optional(),
  pitch: z.number().min(-360).max(360).optional(),
  preset: z.enum(['bone', 'softTissue', 'vessel']).optional(),
  step: z.number().min(0.4).max(20).optional(),
  size: z.number().int().min(64).max(512).optional(),
})

const CutSchema = z.object({
  jobId: z.string().min(1).optional(),
  seriesUID: z.string().min(1).optional(),
  normal: Vec3Schema,
  offset: z.number().optional(),
})

@ApiTags('volume-v2')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('volume-v2')
export class VolumeV2Controller {
  constructor(private readonly service: VolumeV2Service) {}

  @Post('mpr-linked')
  @HttpCode(200)
  mprLinked(
    @Body(new ZodValidationPipe(MprLinkedSchema))
    body: { jobId?: string; seriesUID?: string; position: Vec3 },
  ) {
    return this.service.mprLinked(body)
  }

  @Post('cpr')
  @HttpCode(200)
  cpr(
    @Body(new ZodValidationPipe(CprSchema))
    body: { jobId?: string; seriesUID?: string; points: CprPoint[]; spacing?: number; crossWidth?: number },
  ) {
    return this.service.cpr(body)
  }

  @Post('vr')
  @HttpCode(200)
  vr(
    @Body(new ZodValidationPipe(VrSchema))
    body: { jobId?: string; seriesUID?: string; yaw?: number; pitch?: number; preset?: VrPreset; step?: number; size?: number },
  ) {
    return this.service.vr(body)
  }

  @Post('cut')
  @HttpCode(200)
  cut(
    @Body(new ZodValidationPipe(CutSchema))
    body: { jobId?: string; seriesUID?: string; normal: Vec3; offset?: number },
  ) {
    return this.service.cut(body)
  }
}
