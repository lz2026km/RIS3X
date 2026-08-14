import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { FollowUpService } from './followup.service'
import {
  ApplyTemplateSchema,
  CancelFollowUpSchema,
  CreateFollowUpPlanSchema,
  FromExamFollowUpSchema,
  ListFollowUpQuerySchema,
  MissFollowUpSchema,
  UpdateFollowUpPlanSchema,
} from './followup.schema'
import type { z } from 'zod'

type CreateDto = z.infer<typeof CreateFollowUpPlanSchema>
type UpdateDto = z.infer<typeof UpdateFollowUpPlanSchema>
type ListQuery = z.infer<typeof ListFollowUpQuerySchema>

@ApiTags('followups')
@ApiBearerAuth()
@Roles('DOCTOR', 'DIRECTOR', 'ADMIN', 'TECHNICIAN', 'NURSE')
@Controller('followups')
export class FollowUpController {
  constructor(private readonly svc: FollowUpService) {}

  // ⚠️ 静态子路由 (due/stats/from-exam) 必须先于 :id, 避免被 :id 通配拦截
  @Get('due')
  due(@Query('days') days?: string) {
    return this.svc.due(Number(days ?? 7))
  }

  // [v3.0.6.11-99 Wave3B] 统计: 完成率/失访率/异常率/按类别/按时段
  @Get('stats')
  stats() {
    return this.svc.stats()
  }

  @Get()
  list(@Query() query: ListQuery) {
    const parsed = ListFollowUpQuerySchema.safeParse(query)
    return this.svc.list(parsed.success ? parsed.data : {})
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body(new ZodValidationPipe(CreateFollowUpPlanSchema)) body: CreateDto) {
    return this.svc.create(body)
  }

  // [v3.0.6.11-99 Wave3B] 检查联动: 检查完成 → 自动创建随访计划 (可选模板批量)
  @Post('from-exam')
  @HttpCode(HttpStatus.CREATED)
  fromExam(@Body(new ZodValidationPipe(FromExamFollowUpSchema)) body: z.infer<typeof FromExamFollowUpSchema>) {
    return this.svc.fromExam(body)
  }

  // [v3.0.6.11-99 Wave3B] 状态机流转
  @Post(':id/remind')
  remind(@Param('id') id: string, @Req() req: any) {
    return this.svc.remind(id, req?.user?.sub ?? 'u-001')
  }

  @Post(':id/miss')
  miss(@Param('id') id: string, @Body(new ZodValidationPipe(MissFollowUpSchema)) body: z.infer<typeof MissFollowUpSchema>) {
    return this.svc.miss(id, body.reason)
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body(new ZodValidationPipe(CancelFollowUpSchema)) body: z.infer<typeof CancelFollowUpSchema>) {
    return this.svc.cancel(id, body.reason)
  }

  @Post(':id/in-progress')
  inProgress(@Param('id') id: string) {
    return this.svc.inProgress(id)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateFollowUpPlanSchema)) body: UpdateDto) {
    return this.svc.update(id, body)
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.svc.complete(id)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id)
  }
}

// [v3.0.6.11-99 Wave3B] 模板库: /followup-templates (CRUD + apply 应用到患者)
@ApiTags('followup-templates')
@ApiBearerAuth()
@Roles('DOCTOR', 'DIRECTOR', 'ADMIN', 'TECHNICIAN', 'NURSE')
@Controller('followup-templates')
export class FollowUpTemplateController {
  constructor(private readonly svc: FollowUpService) {}

  @Get()
  list() {
    return this.svc.listTemplates()
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: { name: string; category?: string; intervals?: number[]; items?: string[]; active?: boolean }) {
    return this.svc.createTemplate(body)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<{ name: string; category?: string; intervals?: number[]; items?: string[]; active?: boolean }>) {
    return this.svc.updateTemplate(id, body)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.removeTemplate(id)
  }

  // [v3.0.6.11-99 Wave3B] 应用模板 → 按间隔批量生成随访计划
  @Post(':id/apply')
  @HttpCode(HttpStatus.CREATED)
  apply(@Param('id') id: string, @Body(new ZodValidationPipe(ApplyTemplateSchema)) body: z.infer<typeof ApplyTemplateSchema>) {
    return this.svc.applyTemplate(id, body)
  }
}
