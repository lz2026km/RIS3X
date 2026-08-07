import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ExamService, type CreateExamDto, type UpdateExamDto } from './exam.service'

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

@ApiTags('exams')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('exams')
export class ExamController {
  constructor(private readonly service: ExamService) {}

  @Get()
  list(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('patientId') patientId?: string,
    @Query('modality') modality?: string,
    @Query('state') state?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.list({
      skip: Number(skip ?? 0),
      take: take === undefined || take === '' ? undefined : Number(take),
      patientId, modality, state, dateFrom, dateTo,
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

  // [W4-A] 批量导入 (JSON 数组或 { items }, 无患者则报错列出)
  @Post('import')
  importMany(@Body(new ZodValidationPipe(ImportExamsSchema)) body: unknown) {
    const items = Array.isArray(body) ? body : (body as { items: unknown[] }).items
    return this.service.importMany(items as never)
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreateExamSchema)) body: CreateExamDto) {
    return this.service.create(body)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateExamSchema)) body: UpdateExamDto) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id)
  }
}
