/**
 * [v3.0.6.11-101 Wave 2C] 影像分割深化 — 分割结果管理端点
 *
 * - POST   /segmentation-v2/run                     分割执行 (5 算法 + 参数 → mask + 统计)
 * - GET    /segmentation-v2/segments?seriesUID=     结果列表 (摘要)
 * - GET    /segmentation-v2/segments/:id            结果详情 (含 RLE 掩码)
 * - PATCH  /segmentation-v2/segments/:id            结果标注 (标签/颜色/器官分类)
 * - DELETE /segmentation-v2/segments/:id            结果删除
 * - GET    /segmentation-v2/history?seriesUID=      分割历史 (含已删除)
 * - POST   /segmentation-v2/segments/:id/measurement 测量联动 (体积 → 病灶追踪)
 */
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { z } from 'zod'
import {
  SegmentationV2Service,
  type SegmentationV2Segment,
  type SegmentSummary,
  type HistoryItem,
} from './segmentation-v2.service'
import type { SegmentationAlgorithm, ThresholdMode, OrganClass } from './segmentation-v2.algorithms'

const ALGORITHMS = ['region_grow', 'threshold', 'edge_canny', 'kmeans', 'active_contour'] as const
const THRESHOLD_MODES = ['otsu', 'manual'] as const
const ORGAN_CLASSES = ['结节', '骨骼', '肝脏', '肺', '血管', '软组织', '其他'] as const

const ParamsSchema = z.object({
  thresholdLo: z.number().min(-32768).max(32767).optional(),
  thresholdHi: z.number().min(-32768).max(32767).optional(),
  thresholdMode: z.enum(THRESHOLD_MODES).optional(),
  seed: z.object({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite() }).nullable().optional(),
  sigma: z.number().positive().max(10).optional(),
  edgeLow: z.number().nonnegative().max(100000).optional(),
  edgeHigh: z.number().nonnegative().max(100000).optional(),
  iterations: z.number().int().min(0).max(50).optional(),
  minVoxels: z.number().int().nonnegative().optional(),
})

const RunSchema = z.object({
  seriesUID: z.string().min(1),
  algorithm: z.enum(ALGORITHMS),
  params: ParamsSchema.optional(),
})

const AnnotateSchema = z.object({
  label: z.string().min(1).max(64).optional(),
  color: z.string().min(4).max(16).optional(),
  organClass: z.enum(ORGAN_CLASSES).optional(),
})

const LinkMeasurementSchema = z.object({
  patientId: z.string().min(1).optional(),
  lesionId: z.string().min(1).optional(),
  sizeMm: z.number().positive().optional(),
  date: z.string().min(1).optional(),
  notes: z.string().max(200).optional(),
})

@ApiTags('segmentation-v2')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('segmentation-v2')
export class SegmentationV2Controller {
  constructor(private readonly svc: SegmentationV2Service) {}

  @Post('run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '分割执行 (区域生长/阈值/Canny/K-means/活动轮廓 → mask + 统计)' })
  run(@Body(new ZodValidationPipe(RunSchema)) body: z.infer<typeof RunSchema>): Promise<SegmentationV2Segment> {
    return this.svc.run({
      seriesUID: body.seriesUID,
      algorithm: body.algorithm as SegmentationAlgorithm,
      params: body.params,
    })
  }

  @Get('segments')
  @ApiOperation({ summary: '分割结果列表 (seriesUID)' })
  list(@Query('seriesUID') seriesUID: string): Promise<SegmentSummary[]> {
    return this.svc.list(seriesUID ?? '')
  }

  @Get('segments/:id')
  @ApiOperation({ summary: '分割结果详情 (含 RLE 掩码与切片)' })
  get(@Param('id') id: string): Promise<SegmentationV2Segment> {
    return this.svc.get(id)
  }

  @Patch('segments/:id')
  @ApiOperation({ summary: '分割结果标注 (标签/颜色/器官分类)' })
  annotate(@Param('id') id: string, @Body(new ZodValidationPipe(AnnotateSchema)) body: z.infer<typeof AnnotateSchema>): Promise<SegmentationV2Segment> {
    return this.svc.annotate(id, body as { label?: string; color?: string; organClass?: OrganClass })
  }

  @Delete('segments/:id')
  @ApiOperation({ summary: '删除分割结果 (历史保留)' })
  remove(@Param('id') id: string): Promise<{ id: string; deleted: boolean }> {
    return this.svc.remove(id)
  }

  @Get('history')
  @ApiOperation({ summary: '分割历史 (含已删除记录)' })
  history(@Query('seriesUID') seriesUID: string): Promise<HistoryItem[]> {
    return this.svc.history(seriesUID ?? '')
  }

  @Post('segments/:id/measurement')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '测量联动: 分割体积 → 等效球直径 → 病灶追踪测量' })
  linkMeasurement(@Param('id') id: string, @Body(new ZodValidationPipe(LinkMeasurementSchema)) body: z.infer<typeof LinkMeasurementSchema>): Promise<SegmentationV2Segment> {
    return this.svc.linkMeasurement(id, body)
  }
}

export type { SegmentationAlgorithm, ThresholdMode }
