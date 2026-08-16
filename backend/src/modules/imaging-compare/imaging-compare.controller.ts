import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ImagingCompareService } from './imaging-compare.service'

const num = (key: string, fallback: number): number => {
  const raw = process.env[key]
  const n = raw === undefined ? NaN : Number(raw)
  return Number.isFinite(n) ? n : fallback
}

const SeriesGroupSchema = z.object({
  seriesInstanceUid: z.string().min(1),
  label: z.string().optional(),
  modality: z.string().optional(),
})

const CreateSessionSchema = z.object({
  patientId: z.string().min(1),
  name: z.string().max(120).optional(),
  seriesGroups: z.array(SeriesGroupSchema).min(2).max(4),
})

const SyncUpdateSchema = z.object({
  panZoom: z.boolean().optional(),
  wwwl: z.boolean().optional(),
  frame: z.boolean().optional(),
}).refine((v) => v.panZoom !== undefined || v.wwwl !== undefined || v.frame !== undefined, {
  message: '至少提供一个同步开关',
})

const DifferenceSchema = z.object({
  seriesA: z.string().min(1),
  seriesB: z.string().min(1),
  sliceIndex: z.number().int().min(0).default(0),
  threshold: z.number().min(1).max(1024).default(num('IMAGING_COMPARE_DIFF_THRESHOLD', 24)),
})

@ApiTags('imaging-compare')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('imaging-compare')
export class ImagingCompareController {
  constructor(private readonly svc: ImagingCompareService) {}

  @Get('patients')
  @ApiOperation({ summary: '患者列表 (Patient+Exam 聚合, 空库回退 seed)' })
  listPatients(@Query('keyword') keyword?: string) {
    return this.svc.listPatients(keyword)
  }

  @Get('patients/:patientId/studies')
  @ApiOperation({ summary: '同患者检查列表: 按 patientId 聚合检查/序列 (多时点/多序列/多模态)' })
  getPatientStudies(@Param('patientId') patientId: string) {
    return this.svc.getPatientStudies(patientId)
  }

  @Get('sessions')
  @ApiOperation({ summary: '对比会话列表 (内存 + seed)' })
  listSessions(@Query('patientId') patientId?: string) {
    return this.svc.listSessions(patientId)
  }

  @Post('sessions')
  @ApiOperation({ summary: '创建对比会话 (2-4 序列分组: 同患者多时点/同模态多序列/多模态并排)' })
  createSession(@Body(new ZodValidationPipe(CreateSessionSchema)) dto: z.infer<typeof CreateSessionSchema>) {
    return this.svc.createSession(dto)
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: '对比会话详情' })
  getSession(@Param('id') id: string) {
    return this.svc.getSession(id)
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: '删除对比会话' })
  deleteSession(@Param('id') id: string) {
    return this.svc.deleteSession(id)
  }

  @Get('sessions/:id/sync')
  @ApiOperation({ summary: '会话级同步状态 (平移/缩放/窗宽窗位/翻页联动开关)' })
  getSyncState(@Param('id') id: string) {
    return this.svc.getSyncState(id)
  }

  @Patch('sessions/:id/sync')
  @ApiOperation({ summary: '更新会话级同步开关' })
  updateSyncState(@Param('id') id: string, @Body(new ZodValidationPipe(SyncUpdateSchema)) dto: z.infer<typeof SyncUpdateSchema>) {
    return this.svc.updateSyncState(id, dto)
  }

  @Post('sessions/:id/difference')
  @ApiOperation({ summary: '影像级差异指标: 直方图/均值/方差差异 + 像素差热区占比' })
  computeDifference(@Param('id') id: string, @Body(new ZodValidationPipe(DifferenceSchema)) dto: z.infer<typeof DifferenceSchema>) {
    return this.svc.computeDifference(id, dto.seriesA, dto.seriesB, dto.sliceIndex, dto.threshold)
  }
}
