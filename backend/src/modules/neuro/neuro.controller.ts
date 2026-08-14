// [G005 Wave1A 17] 神经专科 controller — /neuro/*
// 形状与 MSW neuroHandlers 对齐 (success/data/meta)
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { NeuroService } from './neuro.service'
import { z } from 'zod'

const AnalyzeSchema = z.object({
  studyId: z.string().optional(),
}).passthrough()

@ApiTags('neuro')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('neuro')
export class NeuroController {
  constructor(private readonly service: NeuroService) {}

  @Get('studies')
  @ApiOperation({ summary: '神经检查列表 (Exam 派生 + seed)' })
  list(@Query('type') type?: string, @Query('search') search?: string) {
    return this.service.listStudies({ type, search })
  }

  @Get('studies/:id')
  @ApiOperation({ summary: '神经检查详情 (检查+报告+影像信息)' })
  get(@Param('id') id: string) {
    return this.service.getStudy(id)
  }

  @Get('stats')
  @ApiOperation({ summary: '神经专科统计 (卒中/肿瘤/癫痫分类计数)' })
  stats() {
    return this.service.stats()
  }

  @Get('tumor-grades')
  @ApiOperation({ summary: '脑肿瘤分级分布' })
  tumorGrades() {
    return this.service.tumorGrades()
  }

  @Get('stroke-windows')
  @ApiOperation({ summary: '卒中治疗时间窗 (发病/成像/窗内判定)' })
  strokeWindows() {
    return this.service.strokeWindows()
  }

  @Post('analyze')
  @ApiOperation({ summary: '急诊分析 (确定性规则: LVO 疑似/ASPECTS/时间窗)' })
  analyze(@Body(new ZodValidationPipe(AnalyzeSchema)) body: z.infer<typeof AnalyzeSchema>) {
    return this.service.analyze(body.studyId)
  }
}
