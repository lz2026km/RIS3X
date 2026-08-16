/**
 * G005 放射RIS系统 v3.0.6.11-101 - 危急值管理 V2 控制器 (Wave 6C, F5, 孤儿模块)
 *
 * 端点 (POST/PATCH 统一 200):
 * - GET    /critical-v2/rules                 规则库列表 (category/modality/enabled/keyword)
 * - POST   /critical-v2/rules                 新建自定义规则
 * - PATCH  /critical-v2/rules/:id             启停/阈值/建议处置调整
 * - POST   /critical-v2/evaluate              自动判定预览 (不落库)
 * - POST   /critical-v2/judge                 自动判定并生成触发记录 + 自动通知
 * - GET    /critical-v2/triggers              触发记录列表 (status/level/patientName)
 * - GET    /critical-v2/triggers/:id          触发详情
 * - POST   /critical-v2/triggers/:id/notify   发送通知 (电话/短信/消息)
 * - POST   /critical-v2/triggers/:id/resolve  处置闭环
 * - GET    /critical-v2/notifications         通知记录列表 (?triggerId=)
 * - POST   /critical-v2/notifications/:id/confirm  确认 (接受/拒绝/备注)
 * - GET    /critical-v2/stats                 统计 (触发率/确认及时率/超时率)
 */
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { CriticalV2Service } from './critical-v2.service'

const LevelEnum = z.enum(['critical', 'urgent', 'warning'])
const ChannelEnum = z.enum(['phone', 'sms', 'message'])
const OpEnum = z.enum(['>', '>=', '<', '<=', 'contains', 'notContains'])

const ListRulesSchema = z.object({
  category: z.string().optional(),
  modality: z.string().optional(),
  enabled: z.string().optional(),
  keyword: z.string().optional(),
})

const CreateRuleSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1),
  category: z.string().default('通用'),
  modality: z.string().default('CT'),
  examType: z.string().min(1),
  itemKey: z.string().min(1),
  item: z.string().min(1),
  operator: OpEnum,
  threshold: z.number().optional(),
  thresholdText: z.string().optional(),
  unit: z.string().optional(),
  level: LevelEnum.default('critical'),
  description: z.string().min(1),
  suggestion: z.string().min(1),
  responseDeadlineMin: z.number().int().min(1).default(30),
})

const UpdateRuleSchema = z.object({
  enabled: z.boolean().optional(),
  threshold: z.number().optional(),
  thresholdText: z.string().optional(),
  suggestion: z.string().optional(),
  level: LevelEnum.optional(),
})

const EvaluateItemSchema = z.object({
  key: z.string().min(1),
  name: z.string().optional(),
  value: z.union([z.number(), z.string()]),
  unit: z.string().optional(),
})

const EvaluateSchema = z.object({
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  examType: z.string().optional(),
  modality: z.string().optional(),
  items: z.array(EvaluateItemSchema).optional(),
  description: z.string().optional(),
})

const RecipientSchema = z.object({
  name: z.string().min(1),
  dept: z.string().optional(),
  phone: z.string().optional(),
  channels: z.array(ChannelEnum).optional(),
})

const JudgeSchema = EvaluateSchema.extend({
  recipients: z.array(RecipientSchema).optional(),
})

const NotifySchema = z.object({
  recipients: z.array(RecipientSchema).optional(),
})

const ConfirmSchema = z.object({
  decision: z.enum(['accepted', 'rejected']),
  comment: z.string().optional(),
  confirmedBy: z.string().optional(),
})

@ApiTags('critical-v2')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('critical-v2')
export class CriticalV2Controller {
  constructor(private readonly service: CriticalV2Service) {}

  // ===== 规则库 =====
  @Get('rules')
  listRules(@Query() query: Record<string, unknown>) {
    const parsed = ListRulesSchema.safeParse(query)
    const f = parsed.success ? parsed.data : {}
    return this.service.listRules({
      ...f,
      enabled: f.enabled === undefined ? undefined : f.enabled === 'true',
    })
  }

  @Post('rules')
  @HttpCode(200)
  createRule(@Body(new ZodValidationPipe(CreateRuleSchema)) body: z.infer<typeof CreateRuleSchema>) {
    return this.service.createRule(body)
  }

  @Patch('rules/:id')
  @HttpCode(200)
  updateRule(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateRuleSchema)) body: z.infer<typeof UpdateRuleSchema>) {
    return this.service.updateRule(id, body)
  }

  // ===== 自动判定 =====
  @Post('evaluate')
  @HttpCode(200)
  evaluate(@Body(new ZodValidationPipe(EvaluateSchema)) body: z.infer<typeof EvaluateSchema>) {
    return this.service.evaluate(body)
  }

  @Post('judge')
  @HttpCode(200)
  judge(@Body(new ZodValidationPipe(JudgeSchema)) body: z.infer<typeof JudgeSchema>) {
    return this.service.judge(body)
  }

  // ===== 触发记录 =====
  @Get('triggers')
  listTriggers(@Query() query: Record<string, unknown>) {
    const parsed = z
      .object({ status: z.string().optional(), level: LevelEnum.optional(), patientName: z.string().optional() })
      .safeParse(query)
    return this.service.listTriggers(parsed.success ? parsed.data : {})
  }

  @Get('triggers/:id')
  getTrigger(@Param('id') id: string) {
    return this.service.getTrigger(id)
  }

  @Post('triggers/:id/notify')
  @HttpCode(200)
  notifyTrigger(@Param('id') id: string, @Body(new ZodValidationPipe(NotifySchema)) body: z.infer<typeof NotifySchema>) {
    return this.service.notifyTrigger(id, body ?? {})
  }

  @Post('triggers/:id/resolve')
  @HttpCode(200)
  resolveTrigger(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(z.object({ comment: z.string().optional() }).optional())) body?: { comment?: string },
  ) {
    return this.service.resolveTrigger(id, body?.comment)
  }

  // ===== 通知记录 =====
  @Get('notifications')
  listNotifications(@Query('triggerId') triggerId?: string) {
    return this.service.listNotifications(triggerId)
  }

  @Post('notifications/:id/confirm')
  @HttpCode(200)
  confirmNotification(@Param('id') id: string, @Body(new ZodValidationPipe(ConfirmSchema)) body: z.infer<typeof ConfirmSchema>) {
    return this.service.confirmNotification(id, body)
  }

  // ===== 统计 =====
  @Get('stats')
  stats() {
    return this.service.stats()
  }
}
