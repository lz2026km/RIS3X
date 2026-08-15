import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { OccupancyService } from './occupancy.service'

const UpdateStatusSchema = z.object({
  status: z.enum(['idle', 'occupied', 'disinfecting', 'fault']),
})

@ApiTags('occupancy')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'TECHNICIAN')
@Controller('occupancy')
export class OccupancyController {
  constructor(private readonly service: OccupancyService) {}

  @Get('rooms')
  getRooms() {
    return this.service.getRooms()
  }

  // ================= [W10E-3] 扩展端点 (占用总览 / 每日趋势 / 班次对比) =================

  @Get('overview')
  getOverview() {
    return this.service.getOverview()
  }

  @Get('daily-trend')
  getDailyTrend(@Query('days') days?: string) {
    const parsed = Number(days)
    return this.service.getDailyTrend(Number.isFinite(parsed) && parsed > 0 ? parsed : 7)
  }

  @Get('by-shift')
  getByShift() {
    return this.service.getByShift()
  }

  @Get('queue/:roomId')
  getQueue(@Param('roomId') roomId: string) {
    return this.service.getQueue(roomId)
  }

  @Get('trends')
  getTrends() {
    return this.service.getTrends()
  }

  @Post('room/:roomId/status')
  updateStatus(
    @Param('roomId') roomId: string,
    @Body(new ZodValidationPipe(UpdateStatusSchema)) body: { status: string },
  ) {
    return this.service.updateStatus(roomId, body.status)
  }
}
