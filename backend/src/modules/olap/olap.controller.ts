import { Controller, Post, Get, Body, InternalServerErrorException, Logger } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { OlapService } from './olap.service'
import type { DimensionDef, MetricDef } from './olap.service'

@ApiTags('olap')
@Roles('ADMIN', 'DIRECTOR')
@Controller('api/v1/olap')
export class OlapController {
  private readonly logger = new Logger(OlapController.name)
  constructor(private readonly olapService: OlapService) {}

  @Post('query')
  @ApiOperation({ summary: 'Execute OLAP query' })
  async query(@Body() body: any) {
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
