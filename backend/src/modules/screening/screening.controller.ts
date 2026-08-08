import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ScreeningService } from './screening.service'

const MarkSchema = z.object({ screenType: z.string().min(1).optional(), doctor: z.string().min(1).optional() })
const StatusSchema = z.object({ status: z.string().min(1), result: z.string().optional() })
const CreateSchema = z.object({
  examId: z.string().optional(),
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  age: z.number().optional(),
  gender: z.string().optional(),
  phone: z.string().optional(),
  screenType: z.string().optional(),
  screenDate: z.string().optional(),
  status: z.string().optional(),
  result: z.string().optional(),
  rads: z.string().optional(),
  institution: z.string().optional(),
  markDoctor: z.string().optional(),
  markedAt: z.string().optional(),
})

type MarkBody = z.infer<typeof MarkSchema>

@ApiTags('screening')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN', 'NURSE')
@Controller('screening')
export class ScreeningController {
  constructor(private readonly service: ScreeningService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Screening statistics (from Exam)' })
  getStats() {
    return this.service.getStats()
  }

  @Get('queue')
  @ApiOperation({ summary: 'Screening queue list' })
  listQueue(@Query('status') status?: string, @Query('screenType') screenType?: string, @Query('keyword') keyword?: string) {
    return this.service.listQueue({ status, screenType, keyword })
  }

  @Post('queue/:id/mark')
  @ApiOperation({ summary: 'Mark screening record' })
  markScreening(@Param('id') id: string, @Body(new ZodValidationPipe(MarkSchema)) body: MarkBody) {
    return this.service.markScreening(id, body)
  }

  @Post('queue/:id/status')
  @ApiOperation({ summary: 'Update screening record status' })
  updateStatus(@Param('id') id: string, @Body(new ZodValidationPipe(StatusSchema)) body: z.infer<typeof StatusSchema>) {
    return this.service.updateStatus(id, body)
  }

  @Get('trend')
  @ApiOperation({ summary: 'Screening monthly trend' })
  getTrend() {
    return this.service.getTrend()
  }

  @Post('queue')
  @ApiOperation({ summary: 'Create screening record' })
  create(@Body(new ZodValidationPipe(CreateSchema)) body: z.infer<typeof CreateSchema>) {
    return this.service.create(body)
  }
}
