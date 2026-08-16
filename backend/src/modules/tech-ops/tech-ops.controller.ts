/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 4B (tech-ops) - 技师工作站 V2 控制器
 * 端点 (全部为独立孤儿模块, DB 不可用自动回退确定性种子):
 * - GET  /tech-ops/utilization            设备利用率历史 (days=1-30, granularity=day|hour)
 *                                          → 30 天时间序列 + 统计(均值/峰值/低谷时段) + 设备对比
 * - GET  /tech-ops/meta                   设备矩阵 + 模态列表 + 当前时间
 * - GET  /tech-ops/emergency/suggest      紧急插入时段建议 (modality/deviceId/durationMin)
 *                                          → 当前进行中/最近空闲/备用设备 + 冲突检测
 * - POST /tech-ops/emergency/insert       紧急插入 (冲突时返回调整方案; force 时强制插入)
 * - GET  /tech-ops/emergency/records      紧急插入记录
 * - POST /tech-ops/optimize               跨机房排程优化 (队列 + 设备矩阵 → 贪心分配 + 等待对比)
 * - GET  /tech-ops/optimize/demo          演示队列 + 设备矩阵 (无参优化用)
 */
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { TechOpsService, type UtilizationGranularity } from './tech-ops.service'

const ModalSchema = z.enum(['CT', 'MR', 'DR', 'DSA', 'MG'])
const PrioritySchema = z.enum(['ROUTINE', 'URGENT', 'STAT'])

const SuggestQuerySchema = z.object({
  modality: ModalSchema.optional(),
  deviceId: z.string().optional(),
  durationMin: z.coerce.number().int().min(5).max(90).optional(),
})

const InsertSchema = z.object({
  patientName: z.string().optional(),
  examItem: z.string().optional(),
  modality: ModalSchema.optional(),
  deviceId: z.string().optional(),
  durationMin: z.coerce.number().int().min(5).max(90).optional(),
  startMin: z.coerce.number().int().min(0).max(1439).optional(),
  priority: PrioritySchema.optional(),
  force: z.coerce.boolean().optional(),
  reason: z.string().optional(),
})

const OptimizeExamSchema = z.object({
  id: z.string().min(1),
  patientName: z.string().min(1),
  examItem: z.string().min(1),
  modality: ModalSchema,
  durationMin: z.coerce.number().int().min(1).max(240),
  priority: PrioritySchema,
  arrivalMin: z.coerce.number().int().min(0).max(1440),
})

const OptimizeDeviceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  modality: ModalSchema,
  availableFrom: z.coerce.number().int().min(0).max(1440),
  technician: z.string().min(1),
})

const OptimizeSchema = z.object({
  exams: z.array(OptimizeExamSchema).max(100),
  devices: z.array(OptimizeDeviceSchema).max(50),
})

@ApiTags('tech-ops')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller()
export class TechOpsController {
  constructor(private readonly service: TechOpsService) {}

  @Get('tech-ops/utilization')
  getUtilization(
    @Query('days') days?: string,
    @Query('granularity') granularity?: string,
  ) {
    const parsedDays = Number(days)
    const parsed = z.object({ days: z.coerce.number().int().min(1).max(30).optional() }).parse({ days: Number.isFinite(parsedDays) ? parsedDays : 30 })
    const g: UtilizationGranularity = granularity === 'hour' ? 'hour' : 'day'
    return this.service.getUtilizationHistory({ days: parsed.days, granularity: g })
  }

  @Get('tech-ops/meta')
  getMeta() {
    return this.service.getMeta()
  }

  @Get('tech-ops/emergency/suggest')
  getSuggest(@Query() query: unknown) {
    const parsed = SuggestQuerySchema.parse(query ?? {})
    return this.service.suggestSlots(parsed)
  }

  @Post('tech-ops/emergency/insert')
  insert(@Body(new ZodValidationPipe(InsertSchema)) body: z.infer<typeof InsertSchema>) {
    return this.service.insert(body)
  }

  @Get('tech-ops/emergency/records')
  listInserts() {
    return this.service.listInserts()
  }

  @Get('tech-ops/emergency/records/:id')
  getRecord(@Param('id') id: string) {
    const hit = this.service.listInserts().find((r) => r.id === id)
    if (!hit) return { success: false, message: `记录 ${id} 不存在` }
    return hit
  }

  @Post('tech-ops/optimize')
  optimize(@Body(new ZodValidationPipe(OptimizeSchema)) body: z.infer<typeof OptimizeSchema>) {
    return this.service.optimize(body)
  }

  @Get('tech-ops/optimize/demo')
  demoQueue() {
    return this.service.demoQueue()
  }
}
