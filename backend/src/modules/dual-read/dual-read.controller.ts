import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { DualReadService } from './dual-read.service'

const AssignSchema = z.object({
  studyId: z.string().min(1),
  patientName: z.string().min(1),
  patientId: z.string().min(1),
  modality: z.string().min(1),
})

const ArbitrateSchema = z.object({
  arbitratorId: z.string().min(1),
  arbitratorName: z.string().min(1),
  report: z.string().min(1),
})

// [Wave1B P2] 无 id 变体 (POST /dual-read/arbitrate): id 由 body 携带
const ArbitrateByIdSchema = ArbitrateSchema.extend({
  id: z.string().min(1),
})

const ReaderSchema = z.object({
  readerId: z.string().optional(),
  readerNumber: z.union([z.literal(1), z.literal(2)]),
  report: z.string().min(1),
})

// [W9-QC] 抽查抽样 + 双盲
const CreateSamplingSchema = z.object({
  name: z.string().optional(),
  method: z.enum(['random', 'low_yield', 'stratified']).optional(),
  size: z.number().int().min(1).max(100).optional(),
  modality: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  blind: z.boolean().optional(),
  createdBy: z.string().optional(),
})

const RecordReadingSchema = z.object({
  readerSlot: z.union([z.literal(1), z.literal(2)]),
  readerId: z.string().min(1),
  readerName: z.string().min(1),
  result: z.enum(['positive', 'negative', 'indeterminate']),
  report: z.string().optional(),
})

@ApiTags('dual-read')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('dual-read')
export class DualReadController {
  constructor(private readonly service: DualReadService) {}

  @Post('assign')
  assign(@Body(new ZodValidationPipe(AssignSchema)) body: z.infer<typeof AssignSchema>) {
    return this.service.assign(body.studyId, body.patientName, body.patientId, body.modality)
  }

  @Post('arbitrate')
  arbitrate(
    @Body(new ZodValidationPipe(ArbitrateByIdSchema)) body: z.infer<typeof ArbitrateByIdSchema>,
  ) {
    return this.service.arbitrate(body.id, body.arbitratorId, body.arbitratorName, body.report)
  }

  @Post('arbitrate/:id')
  arbitrateGet(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ArbitrateSchema)) body: z.infer<typeof ArbitrateSchema>,
  ) {
    return this.service.arbitrate(id, body.arbitratorId, body.arbitratorName, body.report)
  }

  @Get('discrepancy')
  discrepancy() {
    return this.service.discrepancyStats()
  }

  @Post(':id/reader')
  submitReader(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ReaderSchema)) body: z.infer<typeof ReaderSchema>,
  ) {
    return this.service.submitReader(id, body.readerNumber, body.report)
  }

  // [W9-QC] 抽查抽样批次 + 双盲 + 一致性
  @Post('sampling/batches')
  createSamplingBatch(@Body(new ZodValidationPipe(CreateSamplingSchema)) body: z.infer<typeof CreateSamplingSchema>) {
    return this.service.createSamplingBatch(body)
  }

  @Get('sampling/batches')
  listSamplingBatches() {
    return this.service.listSamplingBatches()
  }

  @Get('sampling/stats')
  samplingStats() {
    return this.service.getSamplingStats()
  }

  @Get('agreement')
  agreement(@Query('batchId') batchId?: string) {
    return this.service.agreement(batchId)
  }

  @Get('sampling/batches/:id')
  getSamplingBatch(@Param('id') id: string, @Query('unblind') unblind?: string) {
    return this.service.getSamplingBatch(id, unblind === 'true')
  }

  @Post('sampling/batches/:id/items/:itemId/record')
  recordSamplingReading(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body(new ZodValidationPipe(RecordReadingSchema)) body: z.infer<typeof RecordReadingSchema>,
  ) {
    return this.service.recordSamplingReading(id, itemId, body)
  }

  @Post('sampling/batches/:id/close')
  closeSamplingBatch(@Param('id') id: string) {
    return this.service.closeSamplingBatch(id)
  }

  @Get('list')
  list() {
    return this.service.list()
  }

  // [G-21 Wave3C] 双阅完成 → 自动创建/关联报告, 双阅结论写入报告 impression
  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.service.complete(id)
  }

  // [G-21 Wave3C] 关联报告信息查询
  @Get(':id/report-link')
  reportLink(@Param('id') id: string) {
    return this.service.reportLink(id)
  }
}
