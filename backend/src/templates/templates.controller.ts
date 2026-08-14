import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { TemplatesService, CreateTemplateDto } from './templates.service'

const CreateSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  modality: z.string().min(1).optional(),
  bodyPart: z.string().min(1),
  body: z.string().min(1),
  parentId: z.string().optional(),
  radsCategory: z.string().optional(),
  tags: z.array(z.string()).optional(),
  createdById: z.string().min(1),
})

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  modality: z.string().min(1).optional(),
  bodyPart: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
})

// [v3.0.6.11-99 Wave2B (模板设计器 P1)] 结构化内容保存: 段落块数组 + 可选预览文本
const SaveStructureSchema = z.object({
  structure: z
    .array(
      z.object({
        type: z.enum(['text', 'field', 'variable', 'structured']),
        content: z.string(),
        fieldKey: z.string().optional(),
        variable: z.string().optional(),
      }),
    )
    .optional(),
  body: z.string().optional(),
})

// [v3.0.6.11-98 Wave2A P1] 模板审批流请求体
const ApproveSchema = z.object({
  approvedBy: z.string().min(1),
})

const RejectSchema = z.object({
  reason: z.string().min(1),
})

const CreateSnippetSchema = z.object({
  name: z.string().min(1),
  content: z.string().min(1),
  category: z.string().min(1),
  shortcuts: z.string().optional(),
})

const CreateCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.number().optional(),
})

const UpdateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  sortOrder: z.number().optional(),
})

@ApiTags('templates')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('templates')
export class TemplatesController {
  constructor(private readonly service: TemplatesService) {}

  // [G005 Wave1B P1] 智能片段端点 — 必须声明在 @Get(':id') 之前, 避免路由抢占
  @Get('snippets')
  listSnippets(@Query('category') category?: string) {
    return this.service.listSnippets({ category })
  }

  @Post('snippets')
  createSnippet(@Body(new ZodValidationPipe(CreateSnippetSchema)) body: z.infer<typeof CreateSnippetSchema>) {
    return this.service.createSnippet(body)
  }

  @Delete('snippets/:id')
  deleteSnippet(@Param('id') id: string) {
    return this.service.deleteSnippet(id)
  }

  // [v3.0.6.11-96 Wave3B P1] 模板分类管理 — 静态路径必须先于 @Get(':id') 注册
  @Get('categories')
  listCategories() {
    return this.service.listCategories()
  }
  @Post('categories')
  createCategory(@Body(new ZodValidationPipe(CreateCategorySchema)) body: z.infer<typeof CreateCategorySchema>) {
    return this.service.createCategory(body)
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateCategorySchema)) body: z.infer<typeof UpdateCategorySchema>) {
    return this.service.updateCategory(id, body)
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.service.deleteCategory(id)
  }

  // [v3.0.6.11-98 Wave2A P1] 医生可浏览/创建/提交审批, 批准/驳回仅管理员/主任 (类级默认)
  // [v3.0.6.11-98 Wave2B (报告 P1)] 模板收藏服务端化 — 静态路径必须先于 @Get(':id') 注册
  @Roles('DOCTOR', 'DIRECTOR', 'ADMIN', 'TECHNICIAN', 'NURSE')
  @Get('favorites')
  listFavorites(@Req() req: { user?: { sub?: string } }) {
    return this.service.listFavorites(req.user?.sub ?? 'u-001')
  }

  @Roles('DOCTOR', 'DIRECTOR', 'ADMIN', 'TECHNICIAN', 'NURSE')
  @Post(':id/favorite')
  toggleFavorite(@Param('id') id: string, @Req() req: { user?: { sub?: string } }) {
    return this.service.toggleFavorite(id, req.user?.sub ?? 'u-001')
  }

  @Roles('DOCTOR', 'DIRECTOR', 'ADMIN', 'TECHNICIAN', 'NURSE')
  @Get()
  list(
    @Query('category') category?: string,
    @Query('bodyPart') bodyPart?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('personal') personal?: string,
    @Query('userId') userId?: string,
  ) {
    const approved = new Set(['draft', 'pending', 'approved', 'rejected'])
    const statusFilter = status && approved.has(status) ? status : undefined
    const userIdFilter = personal === 'true' && userId ? userId : undefined
    return this.service.list({ category, bodyPart, keyword, status: statusFilter, userId: userIdFilter })
  }

  // [v3.0.6.11-98 Wave2A P1] 审批列表 (待审批) — 静态路径必须先于 @Get(':id') 注册
  @Get('pending')
  listPending() {
    return this.service.list({ status: 'pending' })
  }

  // [v3.0.6.11-98 Wave2A P1] 模板审批流端点 — 静态路径/动作路径必须先于 @Get(':id') 注册
  @Roles('DOCTOR', 'DIRECTOR', 'ADMIN', 'TECHNICIAN', 'NURSE')
  @Post(':id/submit')
  submit(@Param('id') id: string) {
    return this.service.submit(id)
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body(new ZodValidationPipe(ApproveSchema)) body: z.infer<typeof ApproveSchema>) {
    return this.service.approve(id, body.approvedBy)
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body(new ZodValidationPipe(RejectSchema)) body: z.infer<typeof RejectSchema>) {
    return this.service.reject(id, body.reason)
  }

  // [v3.0.6.11-99 Wave2B (模板设计器 P1)] 结构化内容读取/保存 — 静态路径必须先于 @Get(':id') 注册
  @Roles('DOCTOR', 'DIRECTOR', 'ADMIN', 'TECHNICIAN', 'NURSE')
  @Get(':id/structure')
  getStructure(@Param('id') id: string) {
    return this.service.getStructure(id)
  }

  @Roles('DOCTOR', 'DIRECTOR', 'ADMIN', 'TECHNICIAN', 'NURSE')
  @Patch(':id/structure')
  saveStructure(@Param('id') id: string, @Body(new ZodValidationPipe(SaveStructureSchema)) body: z.infer<typeof SaveStructureSchema>) {
    return this.service.saveStructure(id, body.structure, body.body)
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Roles('DOCTOR', 'DIRECTOR', 'ADMIN', 'TECHNICIAN', 'NURSE')
  @Post()
  create(@Body(new ZodValidationPipe(CreateSchema)) body: CreateTemplateDto) {
    return this.service.create(body)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateSchema)) body: z.infer<typeof UpdateSchema>) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id)
  }

  @Roles('DOCTOR', 'DIRECTOR', 'ADMIN', 'TECHNICIAN', 'NURSE')
  @Post(':id/clone')
  clone(@Param('id') id: string) {
    return this.service.clone(id)
  }
}
