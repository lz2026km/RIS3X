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
  FromReportFollowUpSchema,
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

  // ⚠️ 静态子路由 (due/stats/from-exam/reminder-queue/from-report) 必须先于 :id, 避免被 :id 通配拦截
  @Get('due')
  due(@Query('days') days?: string) {
    return this.svc.due(Number(days ?? 7))
  }

  // [v3.0.6.11-103 Wave 13] 随访到期提醒队列: 逾期/今日到期/未来 N 天分组
  @Get('reminder-queue')
  reminderQueue(@Query('days') days?: string) {
    return this.svc.reminderQueue(Number(days ?? 7))
  }

  // [v3.0.6.11-103 Wave 13] 随访自动触发强化: 报告手动补建随访 (关键词规则触发, 不受 auto/hint 模式限制)
  @Post('from-report')
  @HttpCode(HttpStatus.CREATED)
  fromReport(@Body(new ZodValidationPipe(FromReportFollowUpSchema)) body: z.infer<typeof FromReportFollowUpSchema>) {
    return this.svc.fromReport(body)
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

// [v3.0.6.11-100 Wave2C (报告工作站 P3)] 报告→随访自动触发规则: GET /followup-trigger-rules
// 规则列表 (内存 + seed) + 触发模式 (auto=自动创建 / hint=仅提示), 供书写页「建议随访」卡片展示
@ApiTags('followup-trigger-rules')
@ApiBearerAuth()
@Roles('DOCTOR', 'DIRECTOR', 'ADMIN', 'TECHNICIAN', 'NURSE')
@Controller('followup-trigger-rules')
export class FollowUpTriggerRulesController {
  constructor(private readonly svc: FollowUpService) {}

  @Get()
  list() {
    return this.svc.triggerRulesInfo()
  }

  // [v3.0.6.11-100 Wave2C P3] 触发模式配置: GET /followup-trigger-rules/mode (读写 followup_auto_trigger_mode)
  @Get('mode')
  async getMode() {
    return { mode: await this.svc.getTriggerMode() }
  }
}
