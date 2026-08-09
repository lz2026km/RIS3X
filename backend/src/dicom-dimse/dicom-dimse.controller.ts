import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { AuthGuard } from '@nestjs/passport'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { DicomDimseService } from './dicom-dimse.service'
import { z } from 'zod'
import { CEchoSchema, CFindMwlSchema, CMoveSchema, CStoreSchema, MppsSchema, NodeTlsSchema, TlsConfigSchema, UploadS3Schema } from './dto'

@ApiTags('dicom-dimse')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@UseGuards(AuthGuard('jwt'))
@Controller('dicom-dimse')
export class DicomDimseController {
  constructor(private readonly service: DicomDimseService) {}

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
  @ApiOperation({ summary: 'MPPS N-CREATE/N-SET 简化: 记录/更新检查进度 (内存 + Exam 派生回退)' })
  async createMpps(@Body(new ZodValidationPipe(MppsSchema)) body: z.infer<typeof MppsSchema>) {
    return this.service.createOrUpdateMpps(body)
  }

  @Get('mpps')
  @ApiOperation({ summary: 'MPPS 检查进度列表' })
  listMpps() {
    return this.service.listMpps()
  }
}
