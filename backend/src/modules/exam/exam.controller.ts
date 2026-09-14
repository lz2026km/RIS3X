import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ExamService, type CreateExamDto, type UpdateExamDto, type MergeExamsDto, type SplitExamDto } from './exam.service'
import { ListQuerySchema, resolvePagination } from '../../common/dto/pagination.dto'

const CreateExamSchema = z.object({
  patientId: z.string().min(1),
  accessionNumber: z.string().min(1),
  modality: z.string().min(1),
  bodyPart: z.string().min(1),
  scheduledAt: z.string().datetime().optional(),
  deviceId: z.string().optional(),
})

const UpdateExamSchema = z.object({
  state: z.string().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  deviceId: z.string().optional(),
})

// [W4-A] 批量导入: 兼容裸数组与 { items: [] } 两种 body 形状
const ImportExamRowSchema = z.object({
  patientId: z.string().min(1),
  accessionNumber: z.string().min(1),
  modality: z.string().min(1),
  bodyPart: z.string().min(1),
  scheduledAt: z.string().datetime().optional(),
  deviceId: z.string().optional(),
})

const ImportExamsSchema = z.union([
  z.array(ImportExamRowSchema).min(1),
  z.object({ items: z.array(ImportExamRowSchema).min(1) }),
])

// [G005 Wave4B] G-18 检查合并/拆分
const MergeExamsSchema = z.object({
  targetId: z.string().min(1),
  sourceIds: z.array(z.string().min(1)).min(1),
})

const SplitExamSchema = z.object({
  reportIds: z.array(z.string().min(1)).min(1),
})

// [v3.0.6.11-104 Wave 1C] 检查列表查询校验 (统一分页 + patientId/modality/state/日期筛选)
export const ExamListQuerySchema = ListQuerySchema.extend({
  patientId: z.string().max(64).optional(),
  modality: z.string().max(32).optional(),
  state: z.string().max(48).optional(),
})

// [v3.0.6.11-95 Wave1B] GET /exams 放开 TECHINICIAN/DOCTOR/NURSE (技师/医生工作站主数据源);
// 写操作 (create/update/delete/import/merge/split) 方法级保留 ADMIN/DIRECTOR
const READ_ROLES = ['ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN', 'NURSE']
const WRITE_ROLES = ['ADMIN', 'DIRECTOR']

@ApiTags('exams')
@ApiBearerAuth()
@Roles(...READ_ROLES)
@Controller('exams')
export class ExamController {
  constructor(private readonly service: ExamService) {}

  @Get()
  list(@Query(new ZodValidationPipe(ExamListQuerySchema)) query: z.infer<typeof ExamListQuerySchema>) {
    const { skip, take } = resolvePagination(query)
    return this.service.list({
      skip,
      take,
      patientId: query.patientId,
      modality: query.modality,
      state: query.state,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    })
  }

  // [W4-A] CSV 导出 (必须注册在 @Get(':id') 之前, 否则 'export' 被 :id 拦截)
  @Get('export')
  exportCsv(
    @Query('patientId') patientId?: string,
    @Query('modality') modality?: string,
    @Query('state') state?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.exportCsv({ patientId, modality, state, dateFrom, dateTo })
  }

  // [v3.0.6.11-99 Wave 10D] 检查总览 (状态/模态分布/今日量) — 静态子路由先于 :id 注册
  @Get('overview')
  overview() {
    return this.service.getOverview()
  }

  // [v3.0.6.11-99 Wave 10D] 模态维度统计
  @Get('by-modality')
  byModality() {
    return this.service.getByModality()
  }

  // [v3.0.6.11-99 Wave 10D] 近 30 日检查趋势
  @Get('daily-trend')
  dailyTrend(@Query('days') days?: string) {
    return this.service.getDailyTrend(Number(days ?? 30))
  }

  // [v3.0.6.11-99 Wave 10D] 检查完整时间线
  @Get('timeline/:id')
  timeline(@Param('id') id: string) {
    return this.service.getTimeline(id)
  }

  // [v3.0.6.11-99 Wave 10D] 技师备注保存
  @Post(':id/notes')
  notes(@Param('id') id: string, @Body(new ZodValidationPipe(z.object({ note: z.string().min(1).max(2000) }))) body: { note: string }) {
    return this.service.saveNotes(id, body.note)
  }

  // [W4-A] 批量导入 (JSON 数组或 { items }, 无患者则报错列出)
  @Post('import')
  @Roles(...WRITE_ROLES)
  importMany(@Body(new ZodValidationPipe(ImportExamsSchema)) body: unknown) {
    const items = Array.isArray(body) ? body : (body as { items: unknown[] }).items
    return this.service.importMany(items as never)
  }

  // [G005 Wave4B] G-18 检查合并: 同患者多检查 → 目标检查
  @Post('merge')
  @Roles(...WRITE_ROLES)
  merge(@Body(new ZodValidationPipe(MergeExamsSchema)) body: MergeExamsDto) {
    return this.service.merge(body)
  }

  // [G005 Wave4B] G-18 检查拆分: 按报告归属拆分
  @Post(':id/split')
  @Roles(...WRITE_ROLES)
  split(@Param('id') id: string, @Body(new ZodValidationPipe(SplitExamSchema)) body: SplitExamDto) {
    return this.service.split(id, body)
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post()
  @Roles(...WRITE_ROLES)
  create(@Body(new ZodValidationPipe(CreateExamSchema)) body: CreateExamDto) {
    return this.service.create(body)
  }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateExamSchema)) body: UpdateExamDto) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  @Roles(...WRITE_ROLES)
  delete(@Param('id') id: string) {
    return this.service.delete(id)
  }
}
