import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, Patch, Post, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { Response } from 'express'
import { z } from 'zod'
import { CustomReportService, CreateCustomReportDto, ScheduleDto } from './custom-report.service'

// [G005 v3.0.6.11-99 Wave 5A] 自定义报表模块

const CreateSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  description: z.string().optional(),
  fields: z.array(z.string().min(1)).min(1),
  period: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']).optional(),
  dataSource: z.string().optional(),
  schedule: z.string().nullable().optional(),
  recipients: z.array(z.string()).optional(),
  // [v3.0.6.11-100 Wave 4A] 排序/分组设置
  sortBy: z.string().nullable().optional(),
  sortOrder: z.enum(['asc', 'desc']).nullable().optional(),
  groupBy: z.string().nullable().optional(),
})

const UpdateSchema = CreateSchema.partial()

const ScheduleSchema = z.object({
  schedule: z.string().min(1),
  recipients: z.array(z.string().min(1)).min(1),
})

@ApiTags('custom-reports')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('custom-reports')
export class CustomReportController {
  private readonly logger = new Logger(CustomReportController.name)
  constructor(private readonly service: CustomReportService) {}

  @Get()
  @ApiOperation({ summary: '自定义报表定义列表' })
  list() {
    return this.service.list()
  }

  // 静态路由优先于 :id, 避免被捕获为 id
  @Get('fields-catalog')
  @ApiOperation({ summary: '可用字段目录 (按 dataSource 分组: olap/stats/bi)' })
  fieldsCatalog() {
    return this.service.getFieldsCatalog()
  }

  @Post()
  @ApiOperation({ summary: '创建自定义报表定义' })
  create(@Body(new ZodValidationPipe(CreateSchema)) body: z.infer<typeof CreateSchema>) {
    return this.service.create(body as CreateCustomReportDto)
  }

  @Get(':id')
  @ApiOperation({ summary: '自定义报表详情' })
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Patch(':id')
  @ApiOperation({ summary: '编辑自定义报表定义' })
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateSchema)) body: z.infer<typeof UpdateSchema>) {
    return this.service.update(id, body as Partial<CreateCustomReportDto>)
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除自定义报表定义' })
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }

  @Post(':id/run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '执行报表 (按 fields 从 olap/stats/bi 派生数据 → 结果快照缓存)' })
  async run(@Param('id') id: string) {
    try {
      return await this.service.run(id)
    } catch (err) {
      this.logger.error(`[CustomReport] run ${id} failed: ${(err as Error).message}`)
      throw err
    }
  }

  @Get(':id/result')
  @ApiOperation({ summary: '最近一次执行结果快照' })
  result(@Param('id') id: string) {
    return this.service.getResult(id)
  }

  @Get(':id/history')
  @ApiOperation({ summary: '历史执行记录' })
  history(@Param('id') id: string) {
    return this.service.getHistory(id)
  }

  @Post(':id/schedule')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '设置定时规则+订阅人, 保存后联动 notifications/report-generated 推送通知' })
  async schedule(@Param('id') id: string, @Body(new ZodValidationPipe(ScheduleSchema)) body: ScheduleDto) {
    return this.service.setSchedule(id, body)
  }

  @Get(':id/export')
  @ApiOperation({ summary: '导出最近结果 CSV (含 BOM)' })
  async export(@Param('id') id: string, @Res() res: Response) {
    const csv = this.service.exportCsv(id)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="custom-report-${id}-${Date.now()}.csv"`)
    res.send(csv)
  }
}
