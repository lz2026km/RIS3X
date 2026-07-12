import { Body, Controller, Get, Param, Post } from '@nestjs/common'
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
