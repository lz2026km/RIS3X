import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { AuthGuard } from '@nestjs/passport'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { DicomDimseService } from './dicom-dimse.service'
import { MwlService } from './mwl.service'
import { z } from 'zod'
import { CEchoSchema, CFindMwlSchema, CMoveSchema, CStoreSchema, MppsLinkSchema, NodeTlsSchema, TlsConfigSchema, TransferEnqueueSchema, UploadS3Schema, MwlQuerySchema } from './dto'

@ApiTags('dicom-dimse')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@UseGuards(AuthGuard('jwt'))
@Controller('dicom-dimse')
export class DicomDimseController {
  constructor(
    private readonly service: DicomDimseService,
    private readonly mwl: MwlService,
  ) {}

  @Post('echo')
  async cEcho(@Body(new ZodValidationPipe(CEchoSchema)) body: z.infer<typeof CEchoSchema>) {
    return this.service.cEcho(body)
  }

  @Post('store')
  async cStore(@Body(new ZodValidationPipe(CStoreSchema)) body: z.infer<typeof CStoreSchema>) {
    return this.service.cStore(body)
  }

  @Post('find')
  async cFind(@Body(new ZodValidationPipe(CFindMwlSchema)) body: z.infer<typeof CFindMwlSchema>) {
    return this.service.cFindMwl(body)
  }

  @Post('move')
  async cMove(@Body(new ZodValidationPipe(CMoveSchema)) body: z.infer<typeof CMoveSchema>) {
    return this.service.cMove(body)
  }

  @Post('upload')
  async upload(@Body(new ZodValidationPipe(UploadS3Schema)) body: z.infer<typeof UploadS3Schema>) {
    return this.service.uploadToS3(body)
  }

  // ═══════════ [G005 v3.0.6.11-86 Wave 4B (G-03)] DICOM TLS 配置 ═══════════

  @Get('tls-config')
  @ApiOperation({ summary: 'DICOM DIMSE TLS 全局配置 (内存 + seed 回退)' })
  getTlsConfig() {
    return this.service.getTlsConfig()
  }

  @Put('tls-config')
  @ApiOperation({ summary: '更新 DICOM DIMSE TLS 配置 (enabled/certificate/caCert/port/verifyPeer)' })
  updateTlsConfig(@Body(new ZodValidationPipe(TlsConfigSchema)) body: z.infer<typeof TlsConfigSchema>) {
    return this.service.updateTlsConfig(body)
  }

  @Get('nodes/:id/tls')
  @ApiOperation({ summary: '节点级 TLS 开关 (按 AE Title / node id)' })
  getNodeTls(@Param('id') id: string) {
    return this.service.getNodeTls(id)
  }

  @Put('nodes/:id/tls')
  @ApiOperation({ summary: '设置节点级 TLS 开关' })
  setNodeTls(@Param('id') id: string, @Body(new ZodValidationPipe(NodeTlsSchema)) body: z.infer<typeof NodeTlsSchema>) {
    return this.service.setNodeTls(id, body.enabled)
  }

  // ═══════════ [G005 v3.0.6.11-86 Wave 4B (G-05)] MPPS 进度 ═══════════

  @Post('mpps')
  @ApiOperation({ summary: 'MPPS N-CREATE/N-SET 简化: 记录/更新检查进度 (携带 accessionNumber/requestedProcedureId)' })
  async createMpps(@Body(new ZodValidationPipe(MppsLinkSchema)) body: z.infer<typeof MppsLinkSchema>) {
    return this.service.createOrUpdateMpps(body)
  }

  @Get('mpps')
  @ApiOperation({ summary: 'MPPS 检查进度列表' })
  listMpps() {
    return this.service.listMpps()
  }

  // ═══════════ [G005 W7-Exec] DICOM MWL C-FIND SCP ═══════════

  @Get('mwl/worklist-items')
  @ApiOperation({ summary: 'MWL 工作列表项查询 (modality/date/patientName/stationAE, Exam/Appointment seed + DB 回退)' })
  worklistItems(@Query(new ZodValidationPipe(MwlQuerySchema)) query: z.infer<typeof MwlQuerySchema>) {
    return this.mwl.listWorklistItems(query)
  }

  @Post('mwl/query')
  @ApiOperation({ summary: 'MWL C-FIND 查询: 返回 C-FIND JSON dataset 形状' })
  mwlQuery(@Body(new ZodValidationPipe(MwlQuerySchema)) body: z.infer<typeof MwlQuerySchema>) {
    return this.mwl.query(body)
  }

  // ═══════════ [G005 v3.0.6.11-90 Wave 4A (PACS P0-1)] DICOM C-STORE 传输队列 ═══════════

  @Get('transfers')
  @ApiOperation({ summary: 'DICOM C-STORE 传输队列列表 (内存 + seed)' })
  listTransfers() {
    return this.service.listTransfers()
  }

  @Post('transfers')
  @ApiOperation({ summary: '入队 DICOM C-STORE 传输任务 (studyUid + 目标 AE)' })
  enqueueTransfer(@Body(new ZodValidationPipe(TransferEnqueueSchema)) body: z.infer<typeof TransferEnqueueSchema>) {
    return this.service.enqueueTransfer(body)
  }

  @Get('transfers/stats')
  @ApiOperation({ summary: '传输队列统计 (各状态数量 / 成功率 / 平均进度)' })
  transferStats() {
    return this.service.getTransferStats()
  }

  @Post('transfers/:id/retry')
  @ApiOperation({ summary: '重试失败/暂停的传输任务' })
  retryTransfer(@Param('id') id: string) {
    return this.service.retryTransfer(id)
  }

  @Post('transfers/:id/pause')
  @ApiOperation({ summary: '暂停传输任务' })
  pauseTransfer(@Param('id') id: string) {
    return this.service.pauseTransfer(id)
  }

  @Post('transfers/:id/resume')
  @ApiOperation({ summary: '恢复传输任务' })
  resumeTransfer(@Param('id') id: string) {
    return this.service.resumeTransfer(id)
  }

  @Post('transfers/:id/cancel')
  @ApiOperation({ summary: '取消传输任务' })
  cancelTransfer(@Param('id') id: string) {
    return this.service.cancelTransfer(id)
  }
}
