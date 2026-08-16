// [G005 v3.0.6.11-101 Wave 6A F8] 水印签章 V2 Controller — 12 端点
// watermark: config/preview/verify; signs: list/apply/get/approve/reject/cancel/stats
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { z } from 'zod'
import { ReportWatermarkService } from './report-watermark.service'
import { ReportSignService } from './report-sign.service'
import { WATERMARK_POSITIONS } from './report-watermark.types'
import type { WatermarkPosition } from './report-watermark.types'

const asTuple = <T extends string>(arr: readonly T[]): [T, ...T[]] => arr as unknown as [T, ...T[]]

const TextWatermarkSchema = z.object({
  content: z.string().max(80).optional(),
  position: z.enum(asTuple<WatermarkPosition>(WATERMARK_POSITIONS)).optional(),
  rotation: z.number().min(-180).max(180).optional(),
  opacity: z.number().min(0.05).max(1).optional(),
  spacing: z.number().min(40).max(400).optional(),
  fontSize: z.number().min(8).max(48).optional(),
})

const ImageWatermarkSchema = z.object({
  enabled: z.boolean().optional(),
  logoKey: z.string().max(64).optional(),
  logoName: z.string().max(80).optional(),
  scale: z.number().min(0.05).max(1).optional(),
  position: z.enum(asTuple<WatermarkPosition>(WATERMARK_POSITIONS)).optional(),
  opacity: z.number().min(0.05).max(1).optional(),
})

const WatermarkConfigSchema = z.object({
  version: z.literal(2).optional(),
  text: TextWatermarkSchema.optional(),
  image: ImageWatermarkSchema.optional(),
})

const PreviewSchema = z.object({
  reportId: z.string().max(64).optional(),
  text: z.string().max(50000).optional(),
  config: WatermarkConfigSchema.optional(),
})

const VerifySchema = z.object({
  reportId: z.string().max(64).optional(),
  text: z.string().max(50000).optional(),
  config: WatermarkConfigSchema.optional(),
  contentHash: z.string().max(128).optional(),
  tamperCode: z.string().max(128).optional(),
})

const ApplySignSchema = z.object({
  reportId: z.string().min(1).max(64),
  reportTitle: z.string().max(120).optional(),
  kind: z.enum(['doctor', 'reviewer', 'co-signer']),
  applicantId: z.string().max(32).optional(),
  applicantName: z.string().max(40).optional(),
  signerId: z.string().min(1).max(32),
  reason: z.string().max(300).optional(),
  reportText: z.string().max(50000).optional(),
})

const ApproveSchema = z.object({
  note: z.string().max(300).optional(),
  actorId: z.string().max(32).optional(),
  actorName: z.string().max(40).optional(),
})

const RejectSchema = z.object({
  reason: z.string().min(1).max(300),
  actorId: z.string().max(32).optional(),
  actorName: z.string().max(40).optional(),
})

const CancelSchema = z.object({
  reason: z.string().max(300).optional(),
  actorId: z.string().max(32).optional(),
  actorName: z.string().max(40).optional(),
})

@ApiTags('report-sign-v2')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('report-sign-v2')
export class ReportSignV2Controller {
  constructor(
    private readonly watermark: ReportWatermarkService,
    private readonly sign: ReportSignService,
  ) {}

  @Get('watermark/config')
  getWatermarkConfig() {
    return this.watermark.getConfig()
  }

  @Post('watermark/preview')
  @HttpCode(HttpStatus.OK)
  previewWatermark(@Body(new ZodValidationPipe(PreviewSchema)) body: z.infer<typeof PreviewSchema>) {
    return this.watermark.buildPreview(body as unknown as Parameters<ReportWatermarkService['buildPreview']>[0])
  }

  @Post('watermark/verify')
  @HttpCode(HttpStatus.OK)
  verifyWatermark(@Body(new ZodValidationPipe(VerifySchema)) body: z.infer<typeof VerifySchema>) {
    return this.watermark.verify(body as unknown as Parameters<ReportWatermarkService['verify']>[0])
  }

  @Get('signs')
  listSigns(@Query('reportId') reportId?: string) {
    return this.sign.list(reportId)
  }

  @Post('signs')
  @HttpCode(HttpStatus.CREATED)
  applySign(@Body(new ZodValidationPipe(ApplySignSchema)) body: z.infer<typeof ApplySignSchema>) {
    return this.sign.apply(body)
  }

  @Get('signs/stats')
  getSignStats() {
    return this.sign.getStats()
  }

  @Get('signs/:id')
  getSign(@Param('id') id: string) {
    return this.sign.get(id)
  }

  @Post('signs/:id/approve')
  @HttpCode(HttpStatus.OK)
  approveSign(@Param('id') id: string, @Body(new ZodValidationPipe(ApproveSchema)) body: z.infer<typeof ApproveSchema>) {
    return this.sign.approve(id, body)
  }

  @Post('signs/:id/reject')
  @HttpCode(HttpStatus.OK)
  rejectSign(@Param('id') id: string, @Body(new ZodValidationPipe(RejectSchema)) body: z.infer<typeof RejectSchema>) {
    return this.sign.reject(id, body)
  }

  @Post('signs/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelSign(@Param('id') id: string, @Body(new ZodValidationPipe(CancelSchema)) body: z.infer<typeof CancelSchema>) {
    return this.sign.cancel(id, body)
  }
}
