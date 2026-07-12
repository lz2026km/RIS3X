import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { CriticalsService, NotifyDto, EscalateDto } from './criticals.service'

const ChannelEnum = z.enum(['SMS', 'WECHAT', 'PHONE', 'DINGTALK', 'APP'])
const CategoryEnum = z.enum(['LIFE_THREATENING', 'URGENT', 'IMPORTANT'])

const NotifySchema = z.object({
  criticalId: z.string().min(1),
  patientName: z.string().min(1),
  patientId: z.string().min(1),
  category: CategoryEnum,
  finding: z.string().min(1),
  channels: z.array(ChannelEnum).min(1),
  recipientName: z.string().min(1),
  recipientDept: z.string().min(1),
  recipientPhone: z.string().min(1),
})

const EscalateSchema = z.object({
  criticalId: z.string().min(1),
  reason: z.string().min(1),
  newRecipients: z.array(z.object({ name: z.string(), dept: z.string(), phone: z.string() })).min(1),
})

const CreateCriticalSchema = z.object({
  examId: z.string().optional(),
  description: z.string().min(1),
  severity: z.enum(['LOW', 'HIGH', 'URGENT', 'CRITICAL']).default('HIGH'),
  method: z.enum(['PHONE', 'SMS', 'SYSTEM', 'EMAIL', 'WECHAT']).default('SYSTEM'),
})

const UpdateCriticalSchema = z.object({
  description: z.string().optional(),
  severity: z.enum(['LOW', 'HIGH', 'URGENT', 'CRITICAL']).optional(),
  state: z.enum(['FOUND', 'NOTIFIED', 'ACKNOWLEDGED', 'RESOLVING', 'RESOLVED']).optional(),
  notifiedTo: z.string().optional(),
  ackedBy: z.string().optional(),
  resolvedBy: z.string().optional(),
})

@ApiTags('criticals')
@ApiBearerAuth()
@Roles('DOCTOR', 'DIRECTOR', 'ADMIN')
@Controller('criticals')
export class CriticalsController {
  constructor(private readonly service: CriticalsService) {}

  @Get()
  list(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('state') state?: string,
    @Query('severity') severity?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.list({
      skip: Number(skip ?? 0),
      take: Number(take ?? 50),
      state, severity, dateFrom, dateTo,
    })
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreateCriticalSchema)) body: z.infer<typeof CreateCriticalSchema>) {
    return this.service.create(body)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateCriticalSchema)) body: z.infer<typeof UpdateCriticalSchema>) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id)
  }

  @Post('notify')
  notify(@Body(new ZodValidationPipe(NotifySchema)) body: NotifyDto) {
    return this.service.notify(body)
  }

  @Post('escalate')
  escalate(@Body(new ZodValidationPipe(EscalateSchema)) body: EscalateDto) {
    return this.service.escalate(body)
  }

  @Get(':criticalId/history')
  listHistory(@Param('criticalId') criticalId: string) {
    return this.service.listHistory(criticalId)
  }
}
