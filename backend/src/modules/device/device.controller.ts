import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { DeviceService, type CreateDeviceDto, type UpdateDeviceDto } from './device.service'

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

@ApiTags('devices')
@ApiBearerAuth()
// [v3.0.6.11-100 Wave 1B] 技师工作站维护提醒接入 → 开放 TECHNICIAN
@Roles('ADMIN', 'DIRECTOR', 'TECHNICIAN')
@Controller('devices')
export class DeviceController {
  constructor(private readonly service: DeviceService) {}

  @Get()
  list(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('modality') modality?: string,
    @Query('state') state?: string,
  ) {
    return this.service.list({
      skip: Number(skip ?? 0),
      take: Number(take ?? 50),
      modality,
      state,
    })
  }

  // ⚠️ 必须在 GET /devices/:id 之前注册
  @Get('maintenance-due')
  maintenanceDue(@Query('cycleHours') cycleHours?: string) {
    return this.service.getMaintenanceDue(Number(cycleHours ?? 2000))
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
