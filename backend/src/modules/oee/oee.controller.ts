import { Controller, Get, Param } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { OeeService } from './oee.service'

@ApiTags('oee')
@ApiBearerAuth()
@Controller('oee')
export class OeeController {
  constructor(private readonly service: OeeService) {}

  @Get('list')
  list() { return this.service.getList() }

  @Get('detail/:deviceId')
  detail(@Param('deviceId') deviceId: string) { return this.service.getDetail(deviceId) }

  @Get('trend/:deviceId')
  trend(@Param('deviceId') deviceId: string) { return this.service.getTrend(deviceId) }

  @Get('stats')
  stats() { return this.service.getStats() }
}
