/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 3B (影像测量 V2 + 标注 V2 双向同步) - 控制器
 *
 * 端点:
 *   - GET  /measurement-v2/types                       类型元数据 (单位/取点数/确定性/公式)
 *   - POST /measurement-v2/compute                     测量数值计算 (确定性)
 *   - GET  /measurement-v2/measurements?studyUid=      测量列表
 *   - POST /measurement-v2/measurements                新建测量 (创建即计算)
 *   - PUT  /measurement-v2/measurements/:id            编辑测量 (版本 +1)
 *   - DELETE /measurement-v2/measurements/:id          删除测量
 *   - GET  /measurement-v2/measurements/:id/versions   历史版本
 *   - POST /measurement-v2/measurements/:id/rollback   回滚版本
 *   - POST /measurement-v2/measurements/:id/link-annotation 标注 ↔ 测量关联
 *   - GET  /measurement-v2/annotations?studyUid=       标注列表 (双向同步来源)
 *   - POST /measurement-v2/annotations                 新建标注 (像素/世界坐标序列化)
 *   - PUT  /measurement-v2/annotations/:id             编辑标注 (版本 +1)
 *   - DELETE /measurement-v2/annotations/:id           删除标注
 *   - GET  /measurement-v2/annotations/:id/versions    标注历史版本
 *   - POST /measurement-v2/annotations/:id/rollback    标注回滚
 *   - POST /measurement-v2/coordinates/convert         像素 ↔ 世界坐标换算
 */
import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import {
  MeasurementV2Service,
  type MeasurementV2Type,
  type AnnotationV2Type,
  type Point2D,
  type ComputeInput,
  type CreateMeasurementDto,
  type CreateAnnotationDto,
  type ConvertCoordinatesInput,
} from './measurement-v2.service'

const MEASURE_TYPES = ['line', 'angle', 'ellipseArea', 'rectangleArea', 'polygonArea', 'polyline', 'cobb', 'calciumScore'] as const
const ANNOTATION_TYPES = ['text', 'arrow', 'rect', 'ellipse', 'freehand'] as const

const PointSchema = z.object({ x: z.number(), y: z.number() })
const SpacingSchema = z.tuple([z.number().positive(), z.number().positive()])

const ComputeSchema = z.object({
  type: z.enum(MEASURE_TYPES),
  points: z.array(PointSchema).min(1).max(400),
  pixelSpacing: SpacingSchema.optional(),
  huValues: z.array(z.number()).optional(),
  huThreshold: z.number().optional(),
})

const CreateMeasurementSchema = z.object({
  studyUid: z.string().min(1),
  seriesUid: z.string().optional(),
  type: z.enum(MEASURE_TYPES),
  points: z.array(PointSchema).min(1).max(400),
  pixelSpacing: SpacingSchema.optional(),
  huValues: z.array(z.number()).optional(),
  huThreshold: z.number().optional(),
  label: z.string().max(200).optional(),
  color: z.string().max(30).optional(),
  visible: z.boolean().optional(),
  createdBy: z.string().max(64).optional(),
})

const UpdateMeasurementSchema = z
  .object({
    points: z.array(PointSchema).min(1).max(400).optional(),
    huValues: z.array(z.number()).optional(),
    label: z.string().max(200).optional(),
    color: z.string().max(30).optional(),
    visible: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: '至少更新一个字段' })

const CreateAnnotationSchema = z.object({
  studyUid: z.string().min(1),
  seriesUid: z.string().optional(),
  type: z.enum(ANNOTATION_TYPES),
  pixelPoints: z.array(PointSchema).min(1).max(400),
  pixelSpacing: SpacingSchema.optional(),
  text: z.string().max(200).optional(),
  color: z.string().max(30).optional(),
  fontSize: z.number().min(8).max(64).optional(),
  visible: z.boolean().optional(),
  locked: z.boolean().optional(),
  measurementId: z.string().optional(),
  createdBy: z.string().max(64).optional(),
})

const UpdateAnnotationSchema = z
  .object({
    pixelPoints: z.array(PointSchema).min(1).max(400).optional(),
    text: z.string().max(200).optional(),
    color: z.string().max(30).optional(),
    fontSize: z.number().min(8).max(64).optional(),
    visible: z.boolean().optional(),
    locked: z.boolean().optional(),
    measurementId: z.string().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: '至少更新一个字段' })

const ConvertSchema = z.object({
  points: z.array(PointSchema).min(1).max(400),
  pixelSpacing: SpacingSchema,
  direction: z.enum(['pixelToWorld', 'worldToPixel']),
})

const VersionSchema = z.object({ version: z.number().int().min(1) })
const LinkSchema = z.object({ annotationId: z.string().min(1) })

@ApiTags('measurement-v2')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('measurement-v2')
export class MeasurementV2Controller {
  constructor(private readonly service: MeasurementV2Service) {}

  // ── 类型元数据 ──

  @Get('types')
  types() {
    return { success: true, data: this.service.listTypes() }
  }

  @Get('seed-study-uids')
  seedStudyUids() {
    return { success: true, data: this.service.seedStudyUids() }
  }

  // ── 计算 ──

  @Post('compute')
  @HttpCode(200)
  compute(@Body(new ZodValidationPipe(ComputeSchema)) body: ComputeInput) {
    return { success: true, data: this.service.compute(body) }
  }

  // ── 坐标换算 ──

  @Post('coordinates/convert')
  @HttpCode(200)
  convert(@Body(new ZodValidationPipe(ConvertSchema)) body: ConvertCoordinatesInput) {
    return { success: true, data: this.service.convertCoordinates(body) }
  }

  // ── 测量 CRUD ──

  @Get('measurements')
  async measurements(@Query('studyUid') studyUid?: string) {
    const uid = String(studyUid ?? '').trim()
    if (!uid) throw new BadRequestException('studyUid 必填')
    return { success: true, data: await this.service.listMeasurements(uid) }
  }

  @Post('measurements')
  @HttpCode(200)
  async createMeasurement(@Body(new ZodValidationPipe(CreateMeasurementSchema)) body: CreateMeasurementDto) {
    return { success: true, data: await this.service.createMeasurement(body) }
  }

  @Put('measurements/:id')
  @HttpCode(200)
  async updateMeasurement(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateMeasurementSchema)) body: Partial<CreateMeasurementDto>,
  ) {
    return { success: true, data: await this.service.updateMeasurement(id, body) }
  }

  @Delete('measurements/:id')
  @HttpCode(200)
  async deleteMeasurement(@Param('id') id: string) {
    return { success: true, data: await this.service.removeMeasurement(id) }
  }

  @Get('measurements/:id/versions')
  versions(@Param('id') id: string) {
    return { success: true, data: this.service.getMeasurementVersions(id) }
  }

  @Post('measurements/:id/rollback')
  @HttpCode(200)
  async rollbackMeasurement(@Param('id') id: string, @Body(new ZodValidationPipe(VersionSchema)) body: { version: number }) {
    return { success: true, data: await this.service.rollbackMeasurement(id, body.version) }
  }

  @Post('measurements/:id/link-annotation')
  @HttpCode(200)
  async linkAnnotation(@Param('id') id: string, @Body(new ZodValidationPipe(LinkSchema)) body: { annotationId: string }) {
    return { success: true, data: await this.service.linkAnnotation(id, body.annotationId) }
  }

  // ── 标注 CRUD (双向同步) ──

  @Get('annotations')
  async annotations(@Query('studyUid') studyUid?: string) {
    const uid = String(studyUid ?? '').trim()
    if (!uid) throw new BadRequestException('studyUid 必填')
    return { success: true, data: await this.service.listAnnotations(uid) }
  }

  @Post('annotations')
  @HttpCode(200)
  async createAnnotation(@Body(new ZodValidationPipe(CreateAnnotationSchema)) body: CreateAnnotationDto) {
    return { success: true, data: await this.service.createAnnotation(body) }
  }

  @Put('annotations/:id')
  @HttpCode(200)
  async updateAnnotation(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAnnotationSchema)) body: Partial<CreateAnnotationDto>,
  ) {
    return { success: true, data: await this.service.updateAnnotation(id, body) }
  }

  @Delete('annotations/:id')
  @HttpCode(200)
  async deleteAnnotation(@Param('id') id: string) {
    return { success: true, data: await this.service.removeAnnotation(id) }
  }

  @Get('annotations/:id/versions')
  annotationVersions(@Param('id') id: string) {
    return { success: true, data: this.service.getAnnotationVersions(id) }
  }

  @Post('annotations/:id/rollback')
  @HttpCode(200)
  async rollbackAnnotation(@Param('id') id: string, @Body(new ZodValidationPipe(VersionSchema)) body: { version: number }) {
    return { success: true, data: await this.service.rollbackAnnotation(id, body.version) }
  }
}
