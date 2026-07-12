import { Controller, Get, Post, Body, Logger } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { BenchmarkService, CompareRequest, CrossSiteRequest } from './benchmark.service'

@ApiTags('benchmark')
@Roles('ADMIN', 'DIRECTOR')
@Controller('api/v1/benchmark')
export class BenchmarkController {
  private readonly logger = new Logger(BenchmarkController.name)
  constructor(private readonly service: BenchmarkService) {}

  @Get('list')
  @ApiOperation({ summary: 'Available benchmark metrics' })
  list() {
    return this.service.getMetrics()
  }

  @Post('compare')
  @ApiOperation({ summary: 'YoY / QoQ comparison' })
  compare(@Body() body: CompareRequest) {
    return this.service.compare(body)
  }

  @Post('cross-site')
  @ApiOperation({ summary: 'Cross-site comparison' })
  crossSite(@Body() body: CrossSiteRequest) {
    return this.service.crossSite(body)
  }

  @Get('stats')
  @ApiOperation({ summary: 'Hospital-wide stats summary' })
  stats() {
    return this.service.stats()
  }
}
