import { Controller, Get, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { StatsService, StatsDashboardData } from './stats.service'

@ApiTags('stats')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('stats')
export class StatsController {
  constructor(private readonly service: StatsService) {}

  @Get('dashboard')
  getDashboard(): Promise<StatsDashboardData> {
    return this.service.getDashboardData()
  }
}
