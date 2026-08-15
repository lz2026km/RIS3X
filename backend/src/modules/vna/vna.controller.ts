/**
 * G005 RIS v3.0.6.11-60 - VNA 厂商中立归档 Controller
 * 端点: objects CRUD / WORM 锁定 / patients 归档视图 / stats / studies
 */
import { Body, Controller, Delete, Get, Param, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { VnaService } from './vna.service'

const CreateObjectSchema = z.object({
  patientId: z.string().max(64).optional(),
  studyUid: z.string().max(128).optional(),
  objectType: z.enum(['document', 'image']).optional(),
  name: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  mimeType: z.string().max(128).optional(),
  size: z.number().int().nonnegative().max(100 * 1024 * 1024).optional(),
})

// [G-26] ILM 生命周期策略 schema
const LifecyclePolicySchema = z.object({
  tier: z.enum(['hot', 'warm', 'cold']),
  retentionDays: z.number().int().min(0).max(36500),
  description: z.string().max(300).optional(),
})

const MigrateSchema = z.object({
  targetTier: z.enum(['hot', 'warm', 'cold']),
  reason: z.string().max(300).optional(),
})

interface UploadedFileShape {
  buffer?: Buffer
  mimetype?: string
  originalname?: string
  size?: number
}

@ApiTags('vna')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('vna')
export class VnaController {
  constructor(private readonly service: VnaService) {}

  @Get('objects')
  @ApiOperation({ summary: '归档对象列表 (DICOM 检查 + 非 DICOM 文档/图像 统一视图, 支持 type/patientId/search 过滤)' })
  listObjects(
    @Query('type') type?: string,
    @Query('patientId') patientId?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listObjects({ type, patientId, search })
  }

  @Post('objects')
  @ApiOperation({ summary: '归档非 DICOM 内容 (multipart 或 JSON)' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, patientId: { type: 'string' }, objectType: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  async createObject(
    @UploadedFile() file: UploadedFileShape | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const parsed = CreateObjectSchema.parse(body)
    if (file) {
      return this.service.createObject({
        patientId: parsed.patientId,
        studyUid: parsed.studyUid,
        objectType: parsed.objectType,
        name: parsed.name,
        description: parsed.description,
        mimeType: parsed.mimeType ?? file.mimetype,
        size: file.size ?? file.buffer?.length,
        buffer: file.buffer,
        originalName: file.originalname,
      })
    }
    return this.service.createObject({
      patientId: parsed.patientId,
      studyUid: parsed.studyUid,
      objectType: parsed.objectType,
      name: parsed.name,
      description: parsed.description,
      mimeType: parsed.mimeType,
      size: parsed.size,
    })
  }

  @Get('objects/:id')
  @ApiOperation({ summary: '归档对象详情 (元数据)' })
  getObject(@Param('id') id: string) {
    return this.service.getObject(id)
  }

  @Get('objects/:id/download')
  @ApiOperation({ summary: '下载/查看归档对象内容' })
  async downloadObject(@Param('id') id: string, @Res() res: Response) {
    const { buffer, mimeType, filename } = await this.service.getObjectContent(id)
    const isImage = mimeType.startsWith('image/')
    res.setHeader('Content-Type', mimeType)
    if (!isImage) {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    } else {
      res.setHeader('Content-Disposition', 'inline')
    }
    res.setHeader('Content-Length', String(buffer.length))
    res.send(buffer)
  }

  @Delete('objects/:id')
  @ApiOperation({ summary: '删除归档对象 (WORM 锁定后 403 拒绝)' })
  deleteObject(@Param('id') id: string) {
    return this.service.deleteObject(id)
  }

  @Post('objects/:id/worm-lock')
  @ApiOperation({ summary: 'WORM 锁定 (一次性不可逆, 幂等)' })
  wormLock(@Param('id') id: string) {
    return this.service.wormLock(id)
  }

  @Get('patients/:patientId')
  @ApiOperation({ summary: '患者归档视图 (DICOM 检查 + 非 DICOM 对象全生命周期)' })
  getPatientArchive(@Param('patientId') patientId: string) {
    return this.service.getPatientArchive(patientId)
  }

  @Get('stats')
  @ApiOperation({ summary: '归档统计 (对象数/容量/DICOM vs 非 DICOM)' })
  getStats() {
    return this.service.getStats()
  }

  // ─────────────────────── [W10E-3] 扩展端点 (总览/存储趋势/分层/校验/重复分析) ───────────────────────

  @Get('overview')
  @ApiOperation({ summary: '归档总览: 对象数/容量/分层分布/近30日增长率' })
  getOverview() {
    return this.service.getOverview()
  }

  @Get('storage-trend')
  @ApiOperation({ summary: '存储增长趋势 (默认 30 日, 累计容量)' })
  getStorageTrend(@Query('days') days?: string) {
    const parsed = Number(days)
    return this.service.getStorageTrend(Number.isFinite(parsed) && parsed > 0 ? parsed : 30)
  }

  @Get('by-tier')
  @ApiOperation({ summary: '分层统计 (hot/warm/cold: 数量/容量/类型)' })
  getByTier() {
    return this.service.getByTier()
  }

  @Post('objects/:id/verify')
  @ApiOperation({ summary: '对象完整性校验 (SHA-256 摘要 + 尺寸比对)' })
  verifyObject(@Param('id') id: string) {
    return this.service.verifyObject(id)
  }

  @Get('duplicate-analysis')
  @ApiOperation({ summary: '重复对象分析 (按 名称+尺寸 分组, 计算浪费容量)' })
  getDuplicateAnalysis() {
    return this.service.getDuplicateAnalysis()
  }

  @Get('studies')
  @ApiOperation({ summary: 'DICOM 检查归档列表 (dicomInstance 按 Study 聚合)' })
  listStudies() {
    return this.service.listStudies()
  }

  // ─────────────────────── G-26 ILM 影像生命周期 (分层存储) ───────────────────────

  @Get('lifecycle-policies')
  @ApiOperation({ summary: '生命周期分层策略列表 (hot/warm/cold + 保留天数, 内存+seed)' })
  listLifecyclePolicies() {
    return this.service.listLifecyclePolicies()
  }

  @Post('lifecycle-policies')
  @ApiOperation({ summary: '新建生命周期分层策略' })
  createLifecyclePolicy(@Body(new ZodValidationPipe(LifecyclePolicySchema)) body: z.infer<typeof LifecyclePolicySchema>) {
    return this.service.createLifecyclePolicy(body)
  }

  @Post('lifecycle-policies/:id')
  @ApiOperation({ summary: '更新生命周期分层策略 (PATCH 语义: 字段可缺省)' })
  updateLifecyclePolicy(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(LifecyclePolicySchema.partial())) body: Partial<z.infer<typeof LifecyclePolicySchema>>,
  ) {
    return this.service.updateLifecyclePolicy(id, body)
  }

  @Delete('lifecycle-policies/:id')
  @ApiOperation({ summary: '删除生命周期分层策略' })
  deleteLifecyclePolicy(@Param('id') id: string) {
    return this.service.deleteLifecyclePolicy(id)
  }

  @Post('objects/:id/migrate')
  @ApiOperation({ summary: '对象分层迁移 (hot/warm/cold), 记录迁移事件' })
  migrateObject(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(MigrateSchema)) body: z.infer<typeof MigrateSchema>,
  ) {
    return this.service.migrateObject(id, body.targetTier, body.reason)
  }

  @Get('lifecycle-events')
  @ApiOperation({ summary: '迁移/过期事件日志 (内存, 含 seed 示例)' })
  listLifecycleEvents(@Query('limit') limit?: string) {
    const parsed = Number(limit)
    return this.service.listLifecycleEvents(Number.isFinite(parsed) && parsed > 0 ? parsed : 100)
  }
}
