import { Controller, Post, Get, Body, InternalServerErrorException, Logger } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { OlapService } from './olap.service'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'

const OlapQuerySchema = z.object({
  dimensions: z.array(z.string().min(1)).min(1),
  measures: z.array(z.string().min(1)).min(1),
  filters: z.array(z.object({ dimension: z.string().min(1), operator: z.string().min(1), value: z.unknown() })).optional(),
  granularity: z.string().optional(),
  orderBy: z.array(z.object({ dimension: z.string().min(1), direction: z.enum(['asc', 'desc']) })).optional(),
  limit: z.number().int().positive().max(10_000).optional(),
  offset: z.number().int().nonnegative().optional(),
})
import type { DimensionDef, MetricDef } from './olap.service'

@ApiTags('olap')
@Roles('ADMIN', 'DIRECTOR')
@Controller('api/v1/olap')
export class OlapController {
  private readonly logger = new Logger(OlapController.name)
  constructor(private readonly olapService: OlapService) {}

  @Post('query')
  @ApiOperation({ summary: 'Execute OLAP query' })
  async query(@Body(new ZodValidationPipe(OlapQuerySchema)) body: z.infer<typeof OlapQuerySchema>) {
    try {
      return await this.olapService.executeQuery(body)
    } catch (err) {
      this.logger.error(`OLAP query failed: ${(err as Error).message}`, (err as Error).stack)
      throw new InternalServerErrorException('OLAP query failed')
    }
  }

  @Get('metadata')
  @ApiOperation({ summary: 'Get OLAP metrics and dimensions metadata' })
  getMetadata() {
    return this.olapService.getMetadata()
  }
}
