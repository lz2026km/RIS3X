import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { RemoteReadingService } from './remote-reading.service'

const CreateSessionSchema = z.object({
  studyId: z.string().min(1),
  readingDoctorId: z.string().min(1),
  priority: z.enum(['routine', 'urgent', 'stat']).default('routine'),
  comment: z.string().optional(),
})

const CompleteSchema = z.object({ report: z.string().min(1) })
const ReturnSchema = z.object({ reason: z.string().min(1) })

@ApiTags('remote-reading')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN', 'NURSE')
@Controller('remote-reading')
export class RemoteReadingController {
  constructor(private readonly service: RemoteReadingService) {}

  @Get('sessions')
  @ApiOperation({ summary: 'Remote reading session list (from Report state)' })
  listSessions(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('readingDoctorId') readingDoctorId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.listSessions({
      status,
      priority,
      readingDoctorId,
      startDate,
      endDate,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    })
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Remote reading session detail' })
  getSession(@Param('id') id: string) {
    return this.service.getSession(id)
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Create remote reading session' })
  createSession(@Body(new ZodValidationPipe(CreateSessionSchema)) body: z.infer<typeof CreateSessionSchema>) {
    return this.service.createSession(body)
  }

  @Post('sessions/:id/start')
  @ApiOperation({ summary: 'Start remote reading' })
  startReading(@Param('id') id: string) {
    return this.service.startReading(id)
  }

  @Post('sessions/:id/complete')
  @ApiOperation({ summary: 'Complete remote reading with report' })
  completeReading(@Param('id') id: string, @Body(new ZodValidationPipe(CompleteSchema)) body: z.infer<typeof CompleteSchema>) {
    return this.service.completeReading(id, body.report)
  }

  @Post('sessions/:id/return')
  @ApiOperation({ summary: 'Return remote reading session' })
  returnReading(@Param('id') id: string, @Body(new ZodValidationPipe(ReturnSchema)) body: z.infer<typeof ReturnSchema>) {
    return this.service.returnReading(id, body.reason)
  }

  @Get('stats')
  @ApiOperation({ summary: 'Remote reading stats' })
  getStats() {
    return this.service.getStats()
  }
}
