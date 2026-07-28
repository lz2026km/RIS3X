import { Body, Controller, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { WorklistService } from './worklist.service'

@ApiTags('worklist')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('worklist')
export class WorklistController {
  constructor(private readonly service: WorklistService) {}

  @Post(':id/checkin')
  checkIn(@Param('id') id: string) {
    return this.service.checkIn(id)
  }

  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.service.start(id)
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.service.complete(id)
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.service.cancel(id, body?.reason)
  }
}
