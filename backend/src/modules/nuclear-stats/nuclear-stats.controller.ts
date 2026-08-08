import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { NuclearStatsService } from './nuclear-stats.service'

@ApiTags('nuclear-stats')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('nuclear-stats')
export class NuclearStatsController {
  constructor(private readonly service: NuclearStatsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Nuclear medicine monthly summary (from Exam)' })
  getSummary() {
    return this.service.getSummary()
  }

  @Get('daily')
  @ApiOperation({ summary: 'Nuclear medicine daily trend' })
  getDaily() {
    return this.service.getDaily()
  }

  @Get('monthly')
  @ApiOperation({ summary: 'Nuclear medicine monthly trend' })
  getMonthly() {
    return this.service.getMonthly()
  }

  @Get('devices')
  @ApiOperation({ summary: 'Nuclear medicine device stats' })
  getDevices() {
    return this.service.getDevices()
  }

  @Get('suv')
  @ApiOperation({ summary: 'SUV value statistics' })
  getSuv() {
    return this.service.getSuv()
  }

  @Get('drugs')
  @ApiOperation({ summary: 'Radiopharmaceutical consumption' })
  getDrugs() {
    return this.service.getDrugs()
  }
}
