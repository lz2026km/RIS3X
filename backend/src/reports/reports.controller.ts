import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../common/decorators/roles.decorator'
import type { Request } from 'express'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { ReportsService } from './reports.service'

const ReportStateEnum = z.enum([
  'PENDING_ASSIGNMENT', 'ASSIGNED', 'WRITING', 'SUBMITTED', 'REVIEWING',
  'REVIEWED', 'SIGNING', 'SIGNED', 'PUBLISHED', 'AMENDING', 'AMENDED',
  'WITHDRAWN', 'REJECTED', 'ARCHIVED',
])

const CreateReportSchema = z.object({
  patientId: z.string().min(1),
  examId: z.string().optional(),
  radiologistId: z.string().optional(),
  findings: z.string().default(''),
  conclusion: z.string().default(''),
})

const UpdateReportSchema = z.object({
  findings: z.string().optional(),
  conclusion: z.string().optional(),
  state: ReportStateEnum.optional(),
})

@ApiTags('reports')
@ApiBearerAuth()
@Roles('DOCTOR', 'DIRECTOR', 'ADMIN', 'TECHNICIAN')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  list(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('state') state?: string,
  ) {
    const parsedState = state && ReportStateEnum.safeParse(state).success
      ? (state as z.infer<typeof ReportStateEnum>)
      : undefined
    return this.reports.list({ skip: Number(skip ?? 0), take: Number(take ?? 20), state: parsedState })
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.reports.get(id)
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreateReportSchema)) body: z.infer<typeof CreateReportSchema>) {
    return this.reports.create(body)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateReportSchema)) body: z.infer<typeof UpdateReportSchema>) {
    return this.reports.update(id, body)
  }

  @Delete(':id')
  delete(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(z.object({ reason: z.string().min(1) }))) body: { reason: string },
    @Req() req: Request,
  ) {
    const actorId = (req.user as { id?: string } | undefined)?.id ?? 'unknown'
    return this.reports.delete(id, body.reason, actorId)
  }

  @Post(':id/transition')
  transition(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(z.object({ to: ReportStateEnum, actorId: z.string().min(1) })))
    body: { to: z.infer<typeof ReportStateEnum>; actorId: string }
  ) {
    return this.reports.transition(id, body.to, body.actorId)
  }
}
