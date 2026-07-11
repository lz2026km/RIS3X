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

@ApiTags('devices')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
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
}
