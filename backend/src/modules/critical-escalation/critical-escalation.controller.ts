/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 6B (critical-escalation) - 危急值升级链 V2 控制器
 * 端点 (全部 200, 孤儿模块可无 DB 启动, seed 回退):
 *   - GET  /critical-escalation/config                      升级链配置 (3 级别 + 超时 + 规则)
 *   - PUT  /critical-escalation/config                      更新升级链配置
 *   - GET  /critical-escalation/chains                      升级链列表 (status 过滤)
 *   - POST /critical-escalation/chains                      启动升级链 (危急值 → 一级通知)
 *   - GET  /critical-escalation/chains/:id                  升级链详情 (步骤时间线 + 倒计时)
 *   - POST /critical-escalation/chains/:id/tick             超时检查 → 自动升级
 *   - POST /critical-escalation/chains/:id/acknowledge      确认 (当前级别)
 *   - POST /critical-escalation/chains/:id/escalate         手动升级
 *   - POST /critical-escalation/chains/:id/close            关闭升级链
 *   - GET  /critical-escalation/chains/:id/steps            升级步骤时间线
 *   - GET  /critical-escalation/stats                       响应耗时统计 (按级别)
 */
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { CriticalEscalationService } from './critical-escalation.service'

const LevelConfigSchema = z.object({
  level: z.number().int().min(1).max(3),
  name: z.string().optional(),
  role: z.string().optional(),
  timeoutMinutes: z.number().int().min(1).max(240),
  channels: z.array(z.string().min(1).max(16)).max(4).optional(),
})

const UpdateConfigSchema = z.object({
  levels: z.array(LevelConfigSchema).length(3),
})

const StartChainSchema = z.object({
  criticalValueId: z.string().min(1),
  patientName: z.string().optional(),
  modality: z.string().optional(),
  title: z.string().optional(),
  severity: z.string().optional(),
})

const AcknowledgeSchema = z.object({
  confirmedBy: z.string().min(1),
  comment: z.string().optional(),
})

const EscalateSchema = z
  .object({
    reason: z.string().optional(),
    escalatedBy: z.string().optional(),
  })
  .optional()

const CloseSchema = z
  .object({
    closedBy: z.string().optional(),
    comment: z.string().optional(),
  })
  .optional()

@ApiTags('critical-escalation')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('critical-escalation')
export class CriticalEscalationController {
  constructor(private readonly service: CriticalEscalationService) {}

  @Get('config')
  getConfig() {
    return { success: true, data: this.service.getConfig() }
  }

  @Put('config')
  @HttpCode(200)
  updateConfig(@Body(new ZodValidationPipe(UpdateConfigSchema)) body: z.infer<typeof UpdateConfigSchema>) {
    return { success: true, data: this.service.updateConfig(body) }
  }

  @Get('chains')
  listChains(@Query('status') status?: string) {
    return { success: true, data: this.service.listChains({ status }) }
  }

  @Post('chains')
  @HttpCode(200)
  async startChain(@Body(new ZodValidationPipe(StartChainSchema)) body: z.infer<typeof StartChainSchema>) {
    return { success: true, data: await this.service.startChain(body) }
  }

  @Get('chains/:id')
  getChain(@Param('id') id: string) {
    return { success: true, data: this.service.getChain(id) }
  }

  @Post('chains/:id/tick')
  @HttpCode(200)
  tick(@Param('id') id: string) {
    return { success: true, data: this.service.tick(id) }
  }

  @Post('chains/:id/acknowledge')
  @HttpCode(200)
  async acknowledge(@Param('id') id: string, @Body(new ZodValidationPipe(AcknowledgeSchema)) body: z.infer<typeof AcknowledgeSchema>) {
    return { success: true, data: await this.service.acknowledge(id, body) }
  }

  @Post('chains/:id/escalate')
  @HttpCode(200)
  async escalate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(EscalateSchema)) body?: z.infer<typeof EscalateSchema>,
  ) {
    return { success: true, data: await this.service.escalate(id, body ?? {}) }
  }

  @Post('chains/:id/close')
  @HttpCode(200)
  async closeChain(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CloseSchema)) body?: z.infer<typeof CloseSchema>,
  ) {
    return { success: true, data: await this.service.closeChain(id, body ?? {}) }
  }

  @Get('chains/:id/steps')
  steps(@Param('id') id: string) {
    return { success: true, data: this.service.stepsOf(id) }
  }

  @Get('stats')
  getStats() {
    return { success: true, data: this.service.getStats() }
  }
}
