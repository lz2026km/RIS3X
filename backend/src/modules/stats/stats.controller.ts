import { Controller, Get } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { StatsService, StatsDashboardData } from './stats.service'

@ApiTags('stats')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('stats')
export class StatsController {
  constructor(private readonly service: StatsService) {}

  @Get('dashboard')
  getDashboard(): Promise<StatsDashboardData> {
    return this.service.getDashboardData()
  }
}
