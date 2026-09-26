import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { AuthGuard } from '@nestjs/passport'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { z } from 'zod'
import { DicomDimseService } from './dicom-dimse.service'
import { TechExecutionService } from './tech-execution.service'
import {
  ExamProtocolSetSchema,
  ProtocolSchema,
  SeriesQcSchema,
  SeriesRegisterSchema,
  DoseWritebackSchema,
} from './dto'

const READ_ROLES = ['ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN', 'NURSE']
const WRITE_ROLES = ['ADMIN', 'DIRECTOR', 'TECHNICIAN']

@ApiTags('protocols')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('protocols')
export class ProtocolsController {
  constructor(private readonly service: TechExecutionService) {}

  @Get()
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: '扫描协议列表 (DB-less-safe 内存 + seed)' })
  list(@Query('modality') modality?: string, @Query('bodyPart') bodyPart?: string) {
    return this.service.listProtocols({ modality, bodyPart })
  }

  @Post()
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: '新建扫描协议' })
  create(@Body(new ZodValidationPipe(ProtocolSchema)) body: z.infer<typeof ProtocolSchema>) {
    return this.service.createProtocol(body)
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: '扫描协议详情' })
  get(@Param('id') id: string) {
    return this.service.getProtocol(id)
  }
}

@ApiTags('exam-execution')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('exam')
export class ExamTechController {
  constructor(
    private readonly service: TechExecutionService,
    private readonly dicom: DicomDimseService,
  ) {}

  @Get(':accessionNumber/mpps')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'MPPS ↔ accession 关联: 该检查号的 MPPS 记录 + MWL 状态' })
  getMpps(@Param('accessionNumber') accessionNumber: string) {
    return this.dicom.getMppsByAccession(accessionNumber)
  }

  @Get(':id/protocol')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: '检查协议/序列/曝光参数/剂量/序列 QC 执行总览 (含 expectedImages 校验)' })
  getProtocol(@Param('id') id: string) {
    return this.service.getExamProtocol(id)
  }

  @Put(':id/protocol')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: '设置/更新检查协议与扫描参数 (protocolId/expectedImages/exposureParams/scanRange/contrastProtocolId)' })
  setProtocol(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ExamProtocolSetSchema)) body: z.infer<typeof ExamProtocolSetSchema>,
  ) {
    return this.service.setExamProtocol(id, body)
  }

  @Get(':id/series')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: '检查已采集序列列表' })
  listSeries(@Param('id') id: string) {
    const items = this.service.listSeries(id)
    return { items, total: items.length }
  }

  @Post(':id/series')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: '登记检查序列 (imageCount 用于 expectedImages 校验)' })
  registerSeries(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SeriesRegisterSchema)) body: z.infer<typeof SeriesRegisterSchema>,
  ) {
    return this.service.registerSeries(id, body)
  }

  @Get(':id/series-qc')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: '序列级 QC 评分记录 (quality pass/reject + reason)' })
  listSeriesQc(@Param('id') id: string) {
    const items = this.service.listSeriesQc(id)
    return { items, total: items.length }
  }

  @Post(':id/series-qc')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: '提交序列级 QC 评分 (REJECT 触发 retakeCount+1, 与检查级重拍区分)' })
  submitSeriesQc(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SeriesQcSchema)) body: z.infer<typeof SeriesQcSchema>,
  ) {
    return this.service.submitSeriesQc(id, body)
  }

  @Get(':id/dose')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: '检查剂量记录 (DLP/CTDIvol/SSDE)' })
  getDose(@Param('id') id: string) {
    return this.service.getDose(id)
  }

  @Post(':id/dose')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'RDSR 解析剂量回写 (DLP/CTDIvol/SSDE, DB-less-safe)' })
  writeDose(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(DoseWritebackSchema)) body: z.infer<typeof DoseWritebackSchema>,
  ) {
    return this.service.writeDose(id, body)
  }

  @Get(':id/execution')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: '检查执行聚合 (协议/序列/校验/QC/剂量/重拍)' })
  getExecution(@Param('id') id: string) {
    return this.service.getExamProtocol(id)
  }
}