import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AutoCollectionService } from './auto-collection.service'

// [G005 Wave1A] 自动采集模块 (前端 autoCollectionApi 全部方法 + tasks start/stop/run + logs)

const CreateRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  triggerType: z.enum(['event', 'schedule', 'threshold']).optional(),
  triggerConfig: z.record(z.unknown()).optional(),
  action: z.enum(['notify', 'report', 'archive', 'transfer']).optional(),
  actionConfig: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
})

const UpdateRuleSchema = CreateRuleSchema.partial()

const CreateTaskSchema = z.object({
  ruleId: z.string().optional(),
  sourceType: z.enum(['DICOM', 'HL7', 'FTP']).optional(),
})

const UpdateConfigSchema = z.object({ value: z.string().min(1) })

@ApiTags('auto-collection')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('auto-collection')
export class AutoCollectionController {
  constructor(private readonly service: AutoCollectionService) {}

  // ===== Rules =====
  @Get('rules')
  @ApiOperation({ summary: '采集规则列表' })
  listRules() {
    return this.service.listRules()
  }

  @Get('rules/:id')
  @ApiOperation({ summary: '采集规则详情' })
  getRule(@Param('id') id: string) {
    return this.service.getRule(id)
  }

  @Post('rules')
  @ApiOperation({ summary: '创建采集规则' })
  createRule(@Body(new ZodValidationPipe(CreateRuleSchema)) body: z.infer<typeof CreateRuleSchema>) {
    return this.service.createRule(body as Parameters<AutoCollectionService['createRule']>[0])
  }

  @Put('rules/:id')
  @ApiOperation({ summary: '更新采集规则 (含启用/停用)' })
  updateRule(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateRuleSchema)) body: z.infer<typeof UpdateRuleSchema>) {
    return this.service.updateRule(id, body)
  }

  @Delete('rules/:id')
  @ApiOperation({ summary: '删除采集规则' })
  deleteRule(@Param('id') id: string) {
    return this.service.deleteRule(id)
  }

  // ===== Tasks =====
  @Get('tasks')
  @ApiOperation({ summary: '采集任务列表 (DICOM/HL7/FTP)' })
  listTasks(@Query('ruleId') ruleId?: string, @Query('status') status?: string) {
    return this.service.listTasks({ ruleId, status })
  }

  @Get('tasks/:id')
  @ApiOperation({ summary: '采集任务详情' })
  getTask(@Param('id') id: string) {
    return this.service.getTask(id)
  }

  @Post('tasks')
  @ApiOperation({ summary: '创建采集任务' })
  createTask(@Body(new ZodValidationPipe(CreateTaskSchema)) body: z.infer<typeof CreateTaskSchema>) {
    return this.service.createTask(body)
  }

  @Post('tasks/:id/start')
  @ApiOperation({ summary: '启动任务' })
  startTask(@Param('id') id: string) {
    return this.service.startTask(id)
  }

  @Post('tasks/:id/stop')
  @ApiOperation({ summary: '停止任务' })
  stopTask(@Param('id') id: string) {
    return this.service.stopTask(id)
  }

  @Post('tasks/:id/run')
  @ApiOperation({ summary: '立即执行任务' })
  runTask(@Param('id') id: string) {
    return this.service.runTask(id)
  }

  // 前端 autoCollectionApi.rerunTask 兼容
  @Post('tasks/:id/rerun')
  @ApiOperation({ summary: '重新执行任务 (兼容 rerun)' })
  rerunTask(@Param('id') id: string) {
    return this.service.rerunTask(id)
  }

  // ===== Config / Logs / Stats =====
  @Get('config')
  @ApiOperation({ summary: '采集配置列表' })
  listConfig() {
    return this.service.listConfig()
  }

  @Put('config/:key')
  @ApiOperation({ summary: '更新采集配置' })
  updateConfig(@Param('key') key: string, @Body(new ZodValidationPipe(UpdateConfigSchema)) body: z.infer<typeof UpdateConfigSchema>) {
    return this.service.updateConfig(key, body.value)
  }

  @Get('logs')
  @ApiOperation({ summary: '采集执行日志' })
  listLogs(@Query('limit') limit?: string) {
    return this.service.listLogs(Number(limit))
  }

  @Get('stats')
  @ApiOperation({ summary: '采集统计' })
  getStats() {
    return this.service.getStats()
  }
}
