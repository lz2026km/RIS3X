/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 8A (report-search-v2) - 报告检索 V2 控制器
 * 端点 (全部 200, 孤儿模块可无 DB 启动, seed 回退):
 *   - POST /report-search-v2/search              结构化条件检索 (关键词/模态/时间/医生/诊断词/机构)
 *   - POST /report-search-v2/natural-language     自然语言 → 条件 → 检索
 *   - GET  /report-search-v2/meta                下拉元数据 (模态/机构/医生/诊断关键词)
 *   - GET  /report-search-v2/stats               语料统计
 */
import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ReportSearchV2Service } from './report-search-v2.service'

const SearchSchema = z.object({
  keyword: z.string().max(200).optional(),
  modality: z.string().max(32).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  doctor: z.string().max(64).optional(),
  diagnosisKeyword: z.string().max(100).optional(),
  organization: z.string().max(100).optional(),
})

const NaturalLanguageSchema = z.object({
  phrase: z.string().min(1).max(300),
})

@ApiTags('report-search-v2')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('report-search-v2')
export class ReportSearchV2Controller {
  constructor(private readonly service: ReportSearchV2Service) {}

  @Post('search')
  @HttpCode(200)
  search(@Body(new ZodValidationPipe(SearchSchema)) body: z.infer<typeof SearchSchema>) {
    return { success: true, data: this.service.search(body) }
  }

  @Post('natural-language')
  @HttpCode(200)
  naturalLanguage(@Body(new ZodValidationPipe(NaturalLanguageSchema)) body: z.infer<typeof NaturalLanguageSchema>) {
    return { success: true, data: this.service.naturalLanguage(body.phrase) }
  }

  @Get('meta')
  getMeta() {
    return { success: true, data: this.service.getMeta() }
  }

  @Get('stats')
  getStats() {
    return { success: true, data: this.service.getStats() }
  }
}
