import { Controller, Post, Get, Body, InternalServerErrorException, Logger, Res } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { Response } from 'express'
import { OlapService } from './olap.service'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'

const OlapQuerySchema = z.object({
  dimensions: z.array(z.string().min(1)).min(1),
  measures: z.array(z.string().min(1)).min(1),
  filters: z.array(z.object({ dimension: z.string().min(1), operator: z.string().min(1), value: z.unknown() })).optional(),
  granularity: z.string().optional(),
  // 兼容前端字符串 orderBy 与后端对象数组两种形状
  orderBy: z.union([
    z.array(z.object({ dimension: z.string().min(1), direction: z.enum(['asc', 'desc']) })),
    z.string(),
  ]).optional(),
  limit: z.number().int().positive().max(10_000).optional(),
  offset: z.number().int().nonnegative().optional(),
})
const OlapDrillDownSchema = z.object({
  cube: z.string().min(1),
  dimension: z.string().min(1),
  value: z.union([z.string(), z.number()]).transform((v) => String(v)),
  measures: z.array(z.string().min(1)).optional(),
})
import type { DimensionDef, MetricDef } from './olap.service'

@ApiTags('olap')
@Roles('ADMIN', 'DIRECTOR')
@Controller('olap')
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

  // [G005 Wave1B P1] OLAP 4 扩展
  @Get('cubes')
  @ApiOperation({ summary: 'OLAP cube list (预定义立方体)' })
  listCubes() {
    return this.olapService.listCubes()
  }

  @Post('drill-down')
  @ApiOperation({ summary: 'OLAP drill-down (追加维度值过滤后查询)' })
  drillDown(@Body(new ZodValidationPipe(OlapDrillDownSchema)) body: z.infer<typeof OlapDrillDownSchema>) {
    return this.olapService.drillDown(body)
  }

  @Post('chart')
  @ApiOperation({ summary: 'OLAP chart data (labels + datasets)' })
  chart(@Body(new ZodValidationPipe(OlapQuerySchema)) body: z.infer<typeof OlapQuerySchema>) {
    return this.olapService.chartData(body)
  }

  @Post('export/csv')
  @ApiOperation({ summary: 'OLAP query result export as CSV' })
  async exportCsv(@Body(new ZodValidationPipe(OlapQuerySchema)) body: z.infer<typeof OlapQuerySchema>, @Res() res: Response) {
    const csv = await this.olapService.exportCsv(body)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="olap-${body.dimensions[0]}-${Date.now()}.csv"`)
    res.send(csv)
  }
}
