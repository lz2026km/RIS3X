import { Controller, Get, Post, Body, Logger } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { BenchmarkService, CompareRequest, CrossSiteRequest } from './benchmark.service'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'

const TimeRangeSchema = z.object({ start: z.string().datetime(), end: z.string().datetime() })
const CompareSchema = z.object({
  metricCode: z.string().min(1),
  timeRange: TimeRangeSchema,
  compareMode: z.enum(['yoy', 'qoq']),
  dimension: z.enum(['dept', 'site', 'time']).optional(),
  dimensionValues: z.array(z.string().min(1)).optional(),
})
const CrossSiteSchema = z.object({ metricCodes: z.array(z.string().min(1)).min(1), siteIds: z.array(z.string().min(1)).min(1), timeRange: TimeRangeSchema })

@ApiTags('benchmark')
@Roles('ADMIN', 'DIRECTOR')
@Controller('benchmark')
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
  compare(@Body(new ZodValidationPipe(CompareSchema)) body: CompareRequest) {
    return this.service.compare(body)
  }

  @Post('cross-site')
  @ApiOperation({ summary: 'Cross-site comparison' })
  crossSite(@Body(new ZodValidationPipe(CrossSiteSchema)) body: CrossSiteRequest) {
    return this.service.crossSite(body)
  }

  @Get('stats')
  @ApiOperation({ summary: 'Hospital-wide stats summary' })
  stats() {
    return this.service.stats()
  }
}
