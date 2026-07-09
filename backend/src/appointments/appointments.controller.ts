/**
 * G005 鏀惧皠RIS绯荤粺 v3.0.2 - 棰勭害鎺у埗鍣?
 * 4 绔偣:GET / GET:id / POST / PATCH:id / DELETE:id
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { AppointmentsService, CreateAppointmentDto, UpdateAppointmentDto } from './appointments.service'

const AppointmentStateEnum = z.enum([
  'SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW',
])

const CreateSchema = z.object({
  patientName: z.string().min(1),
  patientId: z.string().min(1),
  modality: z.string().min(1),
  bodyPart: z.string().optional(),
  startAt: z.string().datetime().or(z.date()),
  endAt: z.string().datetime().or(z.date()),
  deviceId: z.string().min(1),
  deviceName: z.string().min(1),
  room: z.string().optional(),
  priority: z.enum(['ROUTINE', 'URGENT', 'STAT']).default('ROUTINE'),
  note: z.string().optional(),
  referringDoctor: z.string().optional(),
  createdById: z.string().min(1),
})

const UpdateSchema = z.object({
  state: AppointmentStateEnum.optional(),
  startAt: z.string().datetime().or(z.date()).optional(),
  endAt: z.string().datetime().or(z.date()).optional(),
  note: z.string().optional(),
})

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Get()
  list(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('state') state?: string,
    @Query('deviceId') deviceId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.list({
      skip: Number(skip ?? 0),
      take: Number(take ?? 50),
      state: state && AppointmentStateEnum.safeParse(state).success ? (state as any) : undefined,
      deviceId,
      dateFrom,
      dateTo,
    })
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreateSchema)) body: CreateAppointmentDto) {
    return this.service.create(body)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateSchema)) body: UpdateAppointmentDto) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id)
  }
}
