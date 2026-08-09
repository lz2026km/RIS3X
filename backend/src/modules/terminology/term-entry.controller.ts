import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { TermEntryService } from './term-entry.service'

// [G005 Wave1A W9] /terms — 前端 termApi (TermLibraryPage / TermSynonymGraphPage / DictionaryPage) 真实后端
// 静态子路由 (search/suggestions/synonyms/translations/extracted/category-tree) 必须在 /terms/:id 之前注册

const UpsertTermSchema = z.object({
  term: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  pinyin: z.string().optional(),
  category: z.string().optional(),
  synonyms: z.array(z.string()).optional(),
  relatedTerms: z.array(z.string()).optional(),
  definition: z.string().optional(),
  typicalFindings: z.array(z.string()).optional(),
  typicalDiagnosis: z.array(z.string()).optional(),
  radsSystem: z.string().optional(),
  isFeatured: z.boolean().optional(),
  modality: z.array(z.string()).optional(),
  bodyPart: z.array(z.string()).optional(),
  icd10: z.string().optional(),
  snomed: z.string().optional(),
  usageCount: z.number().optional(),
})

@ApiTags('terminology')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('terms')
export class TermEntryController {
  constructor(private readonly service: TermEntryService) {}

  @Get()
  @ApiOperation({ summary: '术语列表 (category/search 过滤)' })
  list(@Query('category') category?: string, @Query('search') search?: string) {
    return this.service.list({ category, search })
  }

  @Get('search')
  @ApiOperation({ summary: '术语搜索' })
  search(@Query('q') q?: string) {
    return this.service.search(q ?? '')
  }

  @Get('suggestions')
  @ApiOperation({ summary: '术语联想' })
  suggestions(@Query('modality') modality?: string, @Query('search') search?: string) {
    return this.service.suggestions({ modality, search })
  }

  @Get('synonyms')
  @ApiOperation({ summary: '同义词关系' })
  synonyms() {
    return this.service.synonymRelations()
  }

  @Get('translations')
  @ApiOperation({ summary: '多语言翻译' })
  translations() {
    return this.service.translations()
  }

  @Get('extracted')
  @ApiOperation({ summary: '抽取词条' })
  extracted() {
    return this.service.extractedTerms()
  }

  @Get('category-tree')
  @ApiOperation({ summary: '分类树' })
  categoryTree() {
    return this.service.categoryTree()
  }

  @Get(':id')
  @ApiOperation({ summary: '术语详情' })
  getById(@Param('id') id: string) {
    return this.service.getById(id)
  }

  @Post()
  @ApiOperation({ summary: '创建术语' })
  create(@Body(new ZodValidationPipe(UpsertTermSchema)) body: z.infer<typeof UpsertTermSchema>) {
    return this.service.create(body)
  }

  @Put(':id')
  @ApiOperation({ summary: '更新术语' })
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpsertTermSchema)) body: z.infer<typeof UpsertTermSchema>) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除术语' })
  delete(@Param('id') id: string) {
    return this.service.delete(id)
  }
}
