/**
 * G005 放射RIS系统 v3.0.6.11-101 - 模板审批流 V2 控制器 (Wave 6C, F7, 孤儿模块)
 *
 * 端点 (POST 统一 200):
 * - GET    /template-approval/templates                 模板列表 (state/category/keyword)
 * - POST   /template-approval/templates                 新建草稿模板
 * - GET    /template-approval/templates/:id             模板详情
 * - PATCH  /template-approval/templates/:id/content     修改内容 (生成新版本)
 * - GET    /template-approval/templates/:id/versions    版本历史
 * - GET    /template-approval/templates/:id/approvals   审批记录
 * - POST   /template-approval/templates/:id/assign      审批人分配 (科室/角色)
 * - POST   /template-approval/templates/:id/submit      提交审批 (draft→pending)
 * - POST   /template-approval/templates/:id/approve     通过 (pending→approved)
 * - POST   /template-approval/templates/:id/reject      驳回 (pending→rejected)
 * - POST   /template-approval/templates/:id/publish     发布 (approved→published)
 * - POST   /template-approval/templates/:id/rework      退回草稿
 * - POST   /template-approval/templates/:id/favorite    收藏切换
 * - POST   /template-approval/templates/:id/use         使用统计
 * - GET    /template-approval/favorites                 我的收藏
 * - GET    /template-approval/stats                     审批统计
 */
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { TemplateApprovalService } from './template-approval.service'

const StateEnum = z.enum(['draft', 'pending', 'approved', 'rejected', 'published'])

const CreateTemplateSchema = z.object({
  name: z.string().min(1),
  category: z.string().default('通用'),
  modality: z.string().optional(),
  bodyPart: z.string().default('通用'),
  content: z.string().min(1),
  createdBy: z.string().default('当前用户'),
})

const UpdateContentSchema = z.object({
  name: z.string().optional(),
  content: z.string().optional(),
  bodyPart: z.string().optional(),
  changedBy: z.string().default('当前用户'),
  note: z.string().optional(),
})

const SubmitSchema = z.object({
  submittedBy: z.string().default('当前用户'),
  comment: z.string().optional(),
})

const ApproveSchema = z.object({
  approvedBy: z.string().default('当前用户'),
  comment: z.string().optional(),
})

const RejectSchema = z.object({
  rejectedBy: z.string().default('当前用户'),
  reason: z.string().min(1),
})

const PublishSchema = z.object({
  publishedBy: z.string().default('当前用户'),
  comment: z.string().optional(),
})

const ReworkSchema = z.object({
  by: z.string().default('当前用户'),
  comment: z.string().optional(),
})

const AssignSchema = z.object({
  dept: z.string().default('放射科'),
  role: z.string().default('DIRECTOR'),
  approverName: z.string().min(1),
})

@ApiTags('template-approval')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('template-approval')
export class TemplateApprovalController {
  constructor(private readonly service: TemplateApprovalService) {}

  @Get('templates')
  listTemplates(@Query() query: Record<string, unknown>) {
    const parsed = z
      .object({ state: StateEnum.optional(), category: z.string().optional(), keyword: z.string().optional() })
      .safeParse(query)
    return this.service.listTemplates(parsed.success ? parsed.data : {})
  }

  @Post('templates')
  @HttpCode(200)
  createTemplate(@Body(new ZodValidationPipe(CreateTemplateSchema)) body: z.infer<typeof CreateTemplateSchema>) {
    return this.service.createTemplate(body)
  }

  @Get('templates/:id')
  getTemplate(@Param('id') id: string) {
    return this.service.getTemplate(id)
  }

  @Patch('templates/:id/content')
  @HttpCode(200)
  updateContent(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateContentSchema)) body: z.infer<typeof UpdateContentSchema>) {
    return this.service.updateContent(id, body)
  }

  @Get('templates/:id/versions')
  getVersions(@Param('id') id: string) {
    return this.service.getVersions(id)
  }

  @Get('templates/:id/approvals')
  getApprovals(@Param('id') id: string) {
    return this.service.getApprovals(id)
  }

  // ===== 状态机 =====
  @Post('templates/:id/submit')
  @HttpCode(200)
  submit(@Param('id') id: string, @Body(new ZodValidationPipe(SubmitSchema)) body: z.infer<typeof SubmitSchema>) {
    return this.service.submit(id, body)
  }

  @Post('templates/:id/approve')
  @HttpCode(200)
  approve(@Param('id') id: string, @Body(new ZodValidationPipe(ApproveSchema)) body: z.infer<typeof ApproveSchema>) {
    return this.service.approve(id, body)
  }

  @Post('templates/:id/reject')
  @HttpCode(200)
  reject(@Param('id') id: string, @Body(new ZodValidationPipe(RejectSchema)) body: z.infer<typeof RejectSchema>) {
    return this.service.reject(id, body)
  }

  @Post('templates/:id/publish')
  @HttpCode(200)
  publish(@Param('id') id: string, @Body(new ZodValidationPipe(PublishSchema)) body: z.infer<typeof PublishSchema>) {
    return this.service.publish(id, body)
  }

  @Post('templates/:id/rework')
  @HttpCode(200)
  rework(@Param('id') id: string, @Body(new ZodValidationPipe(ReworkSchema)) body: z.infer<typeof ReworkSchema>) {
    return this.service.rework(id, body)
  }

  @Post('templates/:id/assign')
  @HttpCode(200)
  assignApprover(@Param('id') id: string, @Body(new ZodValidationPipe(AssignSchema)) body: z.infer<typeof AssignSchema>) {
    return this.service.assignApprover(id, body)
  }

  // ===== 收藏 / 使用 =====
  @Post('templates/:id/favorite')
  @HttpCode(200)
  toggleFavorite(@Param('id') id: string, @Query('userId') userId?: string) {
    return this.service.toggleFavorite(id, userId ?? 'u-001')
  }

  @Get('favorites')
  listFavorites(@Query('userId') userId?: string) {
    return this.service.listFavorites(userId ?? 'u-001')
  }

  @Post('templates/:id/use')
  @HttpCode(200)
  recordUsage(@Param('id') id: string, @Query('usedBy') usedBy?: string) {
    return this.service.recordUsage(id, usedBy)
  }

  // ===== 统计 =====
  @Get('stats')
  stats() {
    return this.service.stats()
  }
}
