import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { DeviceService, type CreateDeviceDto, type UpdateDeviceDto } from './device.service'
import { DeviceScheduleService } from './device-schedule.service'
import { ListQuerySchema, resolvePagination } from '../../common/dto/pagination.dto'

const CreateDeviceSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(128),
  modality: z.string().min(1),
  manufacturer: z.string().max(128).optional(),
  location: z.string().max(128).optional(),
})

const UpdateDeviceSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  modality: z.string().min(1).optional(),
  manufacturer: z.string().max(128).optional(),
  location: z.string().max(128).optional(),
  state: z.enum(['IDLE', 'IN_USE', 'MAINTENANCE', 'BROKEN', 'OFFLINE']).optional(),
})

// [v3.0.6.11-100 Wave 1B] 维护记录: type 必填, hoursUsed 使用时长(小时), note 备注
const MaintenanceLogSchema = z.object({
  type: z.enum(['preventive', 'corrective']),
  hoursUsed: z.coerce.number().min(0).max(100000).optional(),
  note: z.string().max(500).optional(),
})

// [G005 v3.0.6.11-103 Wave 18] 设备调度甘特图 V2 Schemas
const CreateBlockSchema = z.object({
  deviceId: z.string().min(1),
  type: z.enum(['EXAM', 'MAINTENANCE']),
  title: z.string().min(1).max(200),
  start: z.string().min(1),
  end: z.string().min(1),
  examId: z.string().optional(),
  examNo: z.string().optional(),
  patientName: z.string().optional(),
  priority: z.string().optional(),
})

const UpdateBlockSchema = z.object({
  start: z.string().min(1).optional(),
  end: z.string().min(1).optional(),
  title: z.string().min(1).max(200).optional(),
  type: z.enum(['EXAM', 'MAINTENANCE']).optional(),
})

// [v3.0.6.11-104 Wave 1C] 设备列表查询校验 (统一分页 + modality/state 筛选)
export const DeviceListQuerySchema = ListQuerySchema.extend({
  modality: z.string().max(32).optional(),
  state: z.enum(['IDLE', 'IN_USE', 'MAINTENANCE', 'BROKEN', 'OFFLINE']).optional(),
})

@ApiTags('devices')
@ApiBearerAuth()
// [v3.0.6.11-100 Wave 1B] 技师工作站维护提醒接入 → 开放 TECHNICIAN
@Roles('ADMIN', 'DIRECTOR', 'TECHNICIAN')
@Controller('devices')
export class DeviceController {
  constructor(
    private readonly service: DeviceService,
    private readonly schedule: DeviceScheduleService,
  ) {}

  @Get()
  list(@Query(new ZodValidationPipe(DeviceListQuerySchema)) query: z.infer<typeof DeviceListQuerySchema>) {
    const { skip, take } = resolvePagination(query, 50)
    return this.service.list({
      skip,
      take,
      modality: query.modality,
      state: query.state,
    })
  }

  // ⚠️ 必须在 GET /devices/:id 之前注册
  @Get('maintenance-due')
  maintenanceDue(@Query('cycleHours') cycleHours?: string) {
    return this.service.getMaintenanceDue(Number(cycleHours ?? 2000))
  }

  // ════════════ [G005 v3.0.6.11-103 Wave 18] 设备调度甘特图 V2 ════════════
  // ⚠️ 静态路径 (schedule/conflicts) 必须在 GET /devices/:id 之前注册

  @Get('schedule/conflicts')
  @ApiOperation({ summary: '冲突检测列表 (重叠 + 建议调整)' })
  scheduleConflicts(@Query('weekStart') weekStart?: string) {
    return this.schedule.getConflicts(weekStart)
  }

  @Get('schedule/stats')
  @ApiOperation({ summary: '设备调度统计 (利用率/维护/空闲)' })
  scheduleStats(@Query('weekStart') weekStart?: string) {
    return this.schedule.getStats(weekStart)
  }

  @Get('schedule')
  @ApiOperation({ summary: '设备调度周视图 (甘特图 V2)' })
  scheduleWeek(@Query('weekStart') weekStart?: string) {
    return this.schedule.getWeekView(weekStart)
  }

  @Post('schedule/blocks')
  @ApiOperation({ summary: '创建排程块 (检查/维护)' })
  createScheduleBlock(@Body(new ZodValidationPipe(CreateBlockSchema)) body: z.infer<typeof CreateBlockSchema>) {
    return this.schedule.createBlock(body)
  }

  @Patch('schedule/blocks/:id')
  @ApiOperation({ summary: '拖拽更新排程块时间 (带冲突检测)' })
  updateScheduleBlock(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateBlockSchema)) body: z.infer<typeof UpdateBlockSchema>) {
    return this.schedule.updateBlock(id, body)
  }

  @Delete('schedule/blocks/:id')
  @ApiOperation({ summary: '删除排程块' })
  deleteScheduleBlock(@Param('id') id: string) {
    return this.schedule.deleteBlock(id)
  }

  @Get('schedule/blocks/:id/suggest')
  @ApiOperation({ summary: '冲突块的建议调整位置' })
  suggestScheduleBlock(@Param('id') id: string) {
    return this.schedule.suggestMove(id)
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreateDeviceSchema)) body: CreateDeviceDto) {
    return this.service.create(body)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateDeviceSchema)) body: UpdateDeviceDto) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id)
  }

  @Get(':id/stats')
  getStats(@Param('id') id: string) {
    return this.service.getStats(id)
  }

  // [v3.0.6.11-100 Wave 1B] 记录维护 (preventive/corrective) — 重置使用时长 + 更新维护时间
  @Post(':id/maintenance-log')
  logMaintenance(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(MaintenanceLogSchema)) body: z.infer<typeof MaintenanceLogSchema>,
  ) {
    return this.service.logMaintenance(id, body)
  }
}
