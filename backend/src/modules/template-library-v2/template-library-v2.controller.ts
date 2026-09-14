/**
 * G005 放射RIS系统 v3.0.6.11-101 - 模板库 V2 控制器 (Wave 7B, F13, 孤儿模块)
 *
 * 端点 (POST 统一 200):
 * - GET    /template-library-v2/categories                      模板分类树 (模态/科室/用途)
 * - GET    /template-library-v2/templates                       模板列表 (modality/dept/purpose/keyword)
 * - GET    /template-library-v2/search                          搜索 (关键词/标签/模态/科室/用途/部位 + 分页)
 * - GET    /template-library-v2/recommend                       模板推荐 (确定性评分)
 * - GET    /template-library-v2/favorites                       我的收藏
 * - GET    /template-library-v2/usage-history                   最近使用历史
 * - GET    /template-library-v2/stats                           模板库统计
 * - POST   /template-library-v2/templates                       新建模板
 * - GET    /template-library-v2/templates/:id                   模板详情
 * - GET    /template-library-v2/templates/:id/stats             使用统计 (次数/采纳率/最近使用)
 * - POST   /template-library-v2/templates/:id/use               使用计数 (递增)
 * - POST   /template-library-v2/templates/:id/favorite          收藏切换
 * - POST   /template-library-v2/templates/:id/copy              复制模板
 * - GET    /template-library-v2/templates/:id/export            单模板导出 (JSON 序列化)
 * - POST   /template-library-v2/export                          批量导出 (JSON 序列化)
 * - POST   /template-library-v2/import                          导入 (JSON 序列化)
 */
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { TemplateLibraryV2Service } from './template-library-v2.service'

const PurposeEnum = z.enum(['STRUCTURED_REPORT', 'FOLLOWUP', 'URGENT', 'CONTRAST', 'PROCEDURE', 'TECHNIQUE'])

const CreateTemplateSchema = z.object({
  name: z.string().min(1),
  modality: z.string().optional(),
  dept: z.string().optional(),
  purpose: PurposeEnum.optional(),
  bodyPart: z.string().optional(),
  tags: z.array(z.string()).optional(),
  content: z.string().min(1),
  createdBy: z.string().optional(),
})

const SearchSchema = z.object({
  keyword: z.string().optional(),
  tags: z.array(z.string()).optional(),
  modality: z.string().optional(),
  dept: z.string().optional(),
  purpose: PurposeEnum.optional(),
  bodyPart: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
})

const RecommendSchema = z.object({
  modality: z.string().optional(),
  dept: z.string().optional(),
  purpose: PurposeEnum.optional(),
  tags: z.array(z.string()).optional(),
  bodyPart: z.string().optional(),
  limit: z.coerce.number().int().positive().max(20).optional(),
})

const ExportSchema = z.object({ ids: z.array(z.string()).min(1).optional() })

const ImportSchema = z.object({ json: z.string().min(1) })

const UseSchema = z.object({ usedBy: z.string().optional() })

const CopySchema = z.object({ copiedBy: z.string().optional() })

// [v3.0.6.11-104 Wave 1C] 收藏切换 body 校验 (此前 @Body() 未走 zod)
export const FavoriteSchema = z.object({ userId: z.string().max(64).optional() })

@ApiTags('template-library-v2')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('template-library-v2')
export class TemplateLibraryV2Controller {
  constructor(private readonly service: TemplateLibraryV2Service) {}

  @Get('categories')
  @ApiOperation({ summary: '模板分类树 (检查类型/科室/用途)' })
  categories() {
    return this.service.getCategoryTree()
  }

  @Get('templates')
  @ApiOperation({ summary: '模板列表' })
  listTemplates(@Query() query: Record<string, unknown>) {
    const parsed = z
      .object({ modality: z.string().optional(), dept: z.string().optional(), purpose: PurposeEnum.optional(), keyword: z.string().optional() })
      .safeParse(query)
    return this.service.listTemplates(parsed.success ? parsed.data : {})
  }

  @Get('search')
  @ApiOperation({ summary: '模板搜索 (关键词/标签/类型)' })
  search(@Query() query: Record<string, unknown>) {
    const parsed = SearchSchema.safeParse(query)
    return this.service.search(parsed.success ? parsed.data : {})
  }

  @Get('recommend')
  @ApiOperation({ summary: '模板推荐 (确定性评分)' })
  recommend(@Query() query: Record<string, unknown>) {
    const parsed = RecommendSchema.safeParse(query)
    return this.service.recommend(parsed.success ? parsed.data : {})
  }

  @Get('favorites')
  @ApiOperation({ summary: '我的收藏' })
  listFavorites(@Query('userId') userId?: string) {
    return this.service.listFavorites(userId)
  }

  @Get('usage-history')
  @ApiOperation({ summary: '最近使用历史' })
  usageHistory(@Query('userId') userId?: string) {
    return this.service.listUsageHistory(userId)
  }

  @Get('stats')
  @ApiOperation({ summary: '模板库统计' })
  stats() {
    return this.service.stats()
  }

  @Post('templates')
  @HttpCode(200)
  @ApiOperation({ summary: '新建模板' })
  createTemplate(@Body(new ZodValidationPipe(CreateTemplateSchema)) body: z.infer<typeof CreateTemplateSchema>) {
    return this.service.createTemplate(body)
  }

  @Get('templates/:id')
  @ApiOperation({ summary: '模板详情' })
  getTemplate(@Param('id') id: string) {
    return this.service.getTemplate(id)
  }

  @Get('templates/:id/stats')
  @ApiOperation({ summary: '模板使用统计 (次数/采纳率/最近使用)' })
  templateStats(@Param('id') id: string) {
    return this.service.templateUsageStats(id)
  }

  @Post('templates/:id/use')
  @HttpCode(200)
  @ApiOperation({ summary: '使用计数递增' })
  recordUsage(@Param('id') id: string, @Body(new ZodValidationPipe(UseSchema)) body: z.infer<typeof UseSchema>) {
    return this.service.recordUsage(id, body.usedBy)
  }

  @Post('templates/:id/favorite')
  @HttpCode(200)
  @ApiOperation({ summary: '收藏切换' })
  toggleFavorite(@Param('id') id: string, @Body(new ZodValidationPipe(FavoriteSchema)) body: z.infer<typeof FavoriteSchema>) {
    return this.service.toggleFavorite(id, body?.userId)
  }

  @Post('templates/:id/copy')
  @HttpCode(200)
  @ApiOperation({ summary: '复制模板' })
  copyTemplate(@Param('id') id: string, @Body(new ZodValidationPipe(CopySchema)) body: z.infer<typeof CopySchema>) {
    return this.service.copyTemplate(id, body.copiedBy)
  }

  @Get('templates/:id/export')
  @ApiOperation({ summary: '单模板导出 (JSON 序列化)' })
  exportTemplate(@Param('id') id: string) {
    return this.service.exportTemplates([id])
  }

  @Post('export')
  @HttpCode(200)
  @ApiOperation({ summary: '批量导出 (JSON 序列化)' })
  exportTemplates(@Body(new ZodValidationPipe(ExportSchema)) body: z.infer<typeof ExportSchema>) {
    return this.service.exportTemplates(body.ids)
  }

  @Post('import')
  @HttpCode(200)
  @ApiOperation({ summary: '导入 (JSON 序列化)' })
  importTemplates(@Body(new ZodValidationPipe(ImportSchema)) body: z.infer<typeof ImportSchema>, @Query('importedBy') importedBy?: string) {
    return this.service.importTemplates(body.json, importedBy)
  }
}
