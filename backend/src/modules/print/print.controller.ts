import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { PrintService } from './print.service'

// [G005 Wave1A] DICOM 胶片打印 (前端 printApi 全部方法 + queues/reprint)
// [G005 Wave2A P0] + printers CRUD (POST/PUT/DELETE /print/printers)

const CreateJobSchema = z.object({
  patientName: z.string().optional(),
  patientId: z.string().optional(),
  modality: z.string().optional(),
  examType: z.string().optional(),
  studyDesc: z.string().optional(),
  studyType: z.string().optional(),
  filmSpec: z.string().optional(),
  copies: z.number().int().positive().optional(),
  printer: z.string().optional(),
  filmId: z.string().optional(),
})

const CreatePrinterSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
  status: z.enum(['online', 'offline']).optional(),
  location: z.string().optional(),
  filmSpec: z.string().optional(),
  defaultCopies: z.number().int().positive().optional(),
  dpi: z.number().int().positive().optional(),
  aet: z.string().optional(),
  host: z.string().optional(),
  port: z.number().int().positive().optional(),
  mediumTypes: z.array(z.string()).optional(),
  filmsPerHour: z.number().int().positive().optional(),
})

const UpdatePrinterSchema = CreatePrinterSchema.partial()

@ApiTags('print')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN', 'NURSE')
@Controller('print')
export class PrintController {
  constructor(private readonly service: PrintService) {}

  @Get('jobs')
  @ApiOperation({ summary: '打印任务列表' })
  listJobs(@Query('status') status?: string) {
    return this.service.listJobs(status)
  }

  @Post('jobs')
  @ApiOperation({ summary: '创建打印任务' })
  createJob(@Body(new ZodValidationPipe(CreateJobSchema)) body: z.infer<typeof CreateJobSchema>) {
    return this.service.createJob(body)
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: '打印任务详情' })
  getJob(@Param('id') id: string) {
    return this.service.getJob(id)
  }

  @Post('jobs/:id/cancel')
  @ApiOperation({ summary: '取消打印任务' })
  cancelJob(@Param('id') id: string) {
    return this.service.cancelJob(id)
  }

  @Post('jobs/:id/retry')
  @ApiOperation({ summary: '重试打印任务' })
  retryJob(@Param('id') id: string) {
    return this.service.retryJob(id)
  }

  @Post('jobs/:id/reprint')
  @ApiOperation({ summary: '重新打印 (新建任务)' })
  reprintJob(@Param('id') id: string) {
    return this.service.reprintJob(id)
  }

  @Get('queues')
  @ApiOperation({ summary: '打印队列 (排队/打印中)' })
  listQueues() {
    return this.service.listQueue()
  }

  // 前端 printApi.listQueue 兼容别名
  @Get('queue')
  @ApiOperation({ summary: '打印队列别名 (/print/queue)' })
  listQueueAlias() {
    return this.service.listQueue()
  }

  // 前端 printApi.listHistory 兼容
  @Get('history')
  @ApiOperation({ summary: '打印历史 (已完成/失败)' })
  listHistory() {
    return this.service.listHistory()
  }

  @Get('printers')
  @ApiOperation({ summary: '打印机列表 (Device 派生 + 自定义)' })
  listPrinters() {
    return this.service.listPrinters()
  }

  @Post('printers')
  @ApiOperation({ summary: '新增打印机' })
  createPrinter(@Body(new ZodValidationPipe(CreatePrinterSchema)) body: z.infer<typeof CreatePrinterSchema>) {
    return this.service.createPrinter(body)
  }

  @Put('printers/:id')
  @ApiOperation({ summary: '更新打印机' })
  updatePrinter(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePrinterSchema)) body: z.infer<typeof UpdatePrinterSchema>,
  ) {
    return this.service.updatePrinter(id, body)
  }

  @Delete('printers/:id')
  @ApiOperation({ summary: '删除打印机' })
  deletePrinter(@Param('id') id: string) {
    return this.service.deletePrinter(id)
  }

  @Get('stats')
  @ApiOperation({ summary: '打印统计 (胶片用量/设备/成本)' })
  getStats() {
    return this.service.getStats()
  }
}
