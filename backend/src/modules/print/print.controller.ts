import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { PrintService } from './print.service'

// [G005 Wave1A] DICOM 胶片打印 (前端 printApi 全部方法 + queues/reprint)

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
  @ApiOperation({ summary: '打印机列表 (Device 派生)' })
  listPrinters() {
    return this.service.listPrinters()
  }

  @Get('stats')
  @ApiOperation({ summary: '打印统计 (胶片用量/设备/成本)' })
  getStats() {
    return this.service.getStats()
  }
}
