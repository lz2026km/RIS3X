import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Public } from '../common/decorators/public.decorator'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { MobileService, DeviceTokenDto } from './mobile.service'

const DeviceTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['android', 'ios', 'web']).default('android'),
  deviceId: z.string().optional(),
  userId: z.string().optional(),
})

const AckSchema = z.object({
  ackedBy: z.string().optional(),
})

@ApiTags('mobile')
@Public()
@Controller('mobile')
export class MobileController {
  constructor(private readonly mobile: MobileService) {}

  @Get('jscode2session')
  jscode2session(@Query('code') code: string) {
    return this.mobile.jscode2session(code)
  }

  @Get('today-summary')
  todaySummary() {
    return this.mobile.todaySummary()
  }

  @Get('worklist')
  worklist(@Query('status') status?: string) {
    return this.mobile.worklist(status)
  }

  @Get('critical-values')
  criticalValues() {
    return this.mobile.criticalValues()
  }

  @Post('critical-values/:id/ack')
  ackCriticalValue(@Param('id') id: string, @Body(new ZodValidationPipe(AckSchema)) body: { ackedBy?: string }) {
    return this.mobile.ackCriticalValue(id, body)
  }

  @Get('reports/latest')
  latestReports(@Query('limit') limit?: string) {
    return this.mobile.latestReports(limit ? Number(limit) : 10)
  }

  @Post('device-token')
  registerDeviceToken(@Body(new ZodValidationPipe(DeviceTokenSchema)) body: DeviceTokenDto) {
    return this.mobile.registerDeviceToken(body)
  }
}
