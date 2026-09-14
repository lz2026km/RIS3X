import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { PatientService, type CreatePatientDto, type UpdatePatientDto } from './patient.service'
import { ListQuerySchema, resolvePagination } from '../../common/dto/pagination.dto'

const CreatePatientSchema = z.object({
  name: z.string().min(1).max(64),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  birthDate: z.string().datetime().optional(),
  idCard: z.string().length(18).optional(),
  phone: z.string().regex(/^1[3-9]\d{9}$/).optional(),
  type: z.enum(['OUTPATIENT', 'INPATIENT', 'EMERGENCY', 'PHYSICAL']).default('OUTPATIENT'),
})

const UpdatePatientSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  birthDate: z.string().datetime().optional(),
  idCard: z.string().length(18).optional(),
  phone: z.string().regex(/^1[3-9]\d{9}$/).optional(),
  type: z.enum(['OUTPATIENT', 'INPATIENT', 'EMERGENCY', 'PHYSICAL']).optional(),
})

// [W2-4] 患者合并: sourceId 关联数据迁至 targetId 后软删 sourceId
const MergePatientSchema = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
})

// [W4-A] 批量导入: 兼容裸数组与 { items: [] } 两种 body 形状
const ImportPatientRowSchema = z.object({
  name: z.string().min(1).max(64),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', '男', '女']).optional(),
  birthDate: z.string().datetime().optional(),
  idCard: z.string().optional(),
  phone: z.string().optional(),
  type: z.enum(['OUTPATIENT', 'INPATIENT', 'EMERGENCY', 'PHYSICAL']).optional(),
})

const ImportPatientsSchema = z.union([
  z.array(ImportPatientRowSchema).min(1),
  z.object({ items: z.array(ImportPatientRowSchema).min(1) }),
])

// [v3.0.6.11-104 Wave 1C] 患者列表查询校验 (统一分页 + name/phone/gender/type 筛选)
export const PatientListQuerySchema = ListQuerySchema.extend({
  name: z.string().max(64).optional(),
  phone: z.string().max(32).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  type: z.enum(['OUTPATIENT', 'INPATIENT', 'EMERGENCY', 'PHYSICAL']).optional(),
})

@ApiTags('patients')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('patients')
export class PatientController {
  constructor(private readonly service: PatientService) {}

  @Get()
  list(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('name') name?: string,
    @Query('phone') phone?: string,
  ) {
    return this.service.list({
      skip: Number(skip ?? 0),
      take: Number(take ?? 50),
      name,
      phone,
    })
  }

  // [W4-A] CSV 导出 (必须注册在 @Get(':id') 之前, 否则 'export' 被 :id 拦截)
  @Get('export')
  exportCsv(@Query('name') name?: string, @Query('phone') phone?: string) {
    return this.service.exportCsv({ name, phone })
  }

  // [W4-A] 批量导入 (JSON 数组或 { items }, 逐条创建 + 冲突跳过)
  @Post('import')
  importMany(@Body(new ZodValidationPipe(ImportPatientsSchema)) body: unknown) {
    const items = Array.isArray(body) ? body : (body as { items: unknown[] }).items
    return this.service.importMany(items as never)
  }

  // [v3.0.6.11-99 Wave 10D] 患者总览 (总数/今日新增/活跃) — 静态子路由先于 :id 注册
  @Get('overview')
  overview() {
    return this.service.getOverview()
  }

  // [v3.0.6.11-99 Wave 10D] 年龄分布统计
  @Get('age-distribution')
  ageDistribution() {
    return this.service.getAgeDistribution()
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreatePatientSchema)) body: CreatePatientDto) {
    return this.service.create(body)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdatePatientSchema)) body: UpdatePatientDto) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id)
  }

  // [W2-4] 患者合并 (sourceId → targetId): 事务迁移 exam/report/appointment/critical 关联后软删源患者
  //   ⚠️ 必须注册在 @Post() 之前由 Nest 精确匹配 /patients/merge, 与 @Post() 根路径互不冲突
  @Post('merge')
  merge(@Body(new ZodValidationPipe(MergePatientSchema)) body: { sourceId: string; targetId: string }) {
    return this.service.merge(body.sourceId, body.targetId)
  }

  @Get(':id/reports')
  getReports(@Param('id') id: string) {
    return this.service.getReports(id)
  }

  @Get(':id/exams')
  getExams(@Param('id') id: string) {
    return this.service.getExams(id)
  }

  @Get(':id/timeline')
  getTimeline(@Param('id') id: string) {
    return this.service.getTimeline(id)
  }

  // [v3.0.6.11-99 Wave 10D] 患者综合摘要 (检查/报告/随访/费用/危急值)
  @Get(':id/summary')
  getSummary(@Param('id') id: string) {
    return this.service.getSummary(id)
  }

  // [v3.0.6.11-99 Wave 10D] 就诊历史时间线
  @Get(':id/visit-history')
  getVisitHistory(@Param('id') id: string) {
    return this.service.getVisitHistory(id)
  }
}
