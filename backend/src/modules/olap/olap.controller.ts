import { Controller, Post, Get, Body, HttpException, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { OlapService } from './olap.service'

@ApiTags('olap')
@Controller('api/v1/olap')
export class OlapController {
  constructor(private readonly olapService: OlapService) {}

  @Post('query')
  @ApiOperation({ summary: 'Execute OLAP query' })
  async query(@Body() body: any) {
    try {
      return await this.olapService.executeQuery(body)
    } catch (err) {
      throw new HttpException(
        { message: (err as Error).message || 'OLAP query failed' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Get('metadata')
  @ApiOperation({ summary: 'Get OLAP metrics and dimensions metadata' })
  getMetadata() {
    return this.olapService.getMetadata()
  }
}
