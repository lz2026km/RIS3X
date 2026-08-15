import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { MammoQcService } from './mammo-qc.service'

// [G-21 Wave3C] 乳腺质控评估入参: 每张影像的投照/剂量参数
const BreastImageSchema = z.object({
  view: z.string().min(1),
  coverage: z.number().min(0).max(100).optional(),
  nippleTangential: z.boolean().optional(),
  compression: z.number().positive().optional(),
  agd: z.number().positive().optional(),
})

const BreastEvaluateSchema = z.object({
  images: z.array(BreastImageSchema).min(1),
})

// [G005 Wave1B P1] /mammo-qc — 从 Exam(MG/TOM)+质控派生 + seed 回退
@ApiTags('mammo-qc')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('mammo-qc')
export class MammoQcController {
  constructor(private readonly service: MammoQcService) {}

  @Get('overview')
  @ApiOperation({ summary: '乳腺质控总览 (MG/TOM 检查派生)' })
  getOverview() {
    return this.service.getOverview()
  }

  @Get('records')
  @ApiOperation({ summary: '乳腺质控记录列表' })
  listRecords(@Query('search') search?: string, @Query('pageSize') pageSize?: string) {
    return this.service.listRecords({
      search,
      pageSize: pageSize ? Number(pageSize) : undefined,
    })
  }

  @Get('tests')
  @ApiOperation({ summary: '质控测试项' })
  listTests() {
    return this.service.listTests()
  }

  @Get('standards')
  @ApiOperation({ summary: '质控标准 (ACR/MQSA)' })
  listStandards() {
    return this.service.listStandards()
  }

  @Get('stats')
  @ApiOperation({ summary: '质控统计' })
  getStats() {
    return this.service.getStats()
  }

  // [G-21 Wave3C] 乳腺质控规则列表 (投照质量 / 剂量 / 随访建议, 15 条 seed)
  @Get('breast-rules')
  @ApiOperation({ summary: '乳腺质控规则列表 (投照质量/剂量/随访建议)' })
  listBreastRules() {
    return this.service.listBreastRules()
  }

  // [G-21 Wave3C] 乳腺影像质量规则命中评估 (通过/告警/不合格 + 依据)
  @Post('breast-evaluate')
  @ApiOperation({ summary: '乳腺影像质量参数 → 规则命中评估' })
  evaluateBreast(@Body(new ZodValidationPipe(BreastEvaluateSchema)) body: z.infer<typeof BreastEvaluateSchema>) {
    return this.service.evaluateBreast(body)
  }
}
