// [G005 Wave1A P0] 眼科教学病例库 controller — /eye/edu/*
// 形状与 MSW eyeHandlers.ts eyeCaseLibraryModule 对齐 (success/data/meta)
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { EyeEduService } from './eye-edu.service'
import { z } from 'zod'

const CreateEduCaseSchema = z.object({
  patientName: z.string().min(1),
  patientId: z.string().min(1),
  modality: z.string().optional(),
  bodyPart: z.string().optional(),
  chiefComplaint: z.string().optional(),
  diagnosis: z.string().optional(),
  status: z.string().optional(),
  studyDate: z.string().optional(),
})

const AnnotateSchema = z.object({
  annotationType: z.enum(['roi', 'segmentation', 'measurement', 'text', 'arrow']).optional(),
  coordinates: z.any().optional(),
  label: z.string().optional(),
  color: z.string().optional(),
}).passthrough()

const CreateProjectSchema = z.object({
  name: z.string().min(1),
  total: z.number().int().positive().optional(),
  completed: z.number().int().nonnegative().optional(),
})

const CohortSchema = z.object({
  criteria: z.object({
    disease: z.string().optional(),
    ageMin: z.number().optional(),
    ageMax: z.number().optional(),
    gender: z.string().optional(),
    modality: z.string().optional(),
  }).optional(),
})

const DeidentifySchema = z.object({
  caseId: z.string().min(1),
  level: z.enum(['minimal', 'basic', 'strict']).optional(),
})

const ExportSrSchema = z.object({
  caseId: z.string().optional(),
  annotations: z.array(z.any()).optional(),
  format: z.enum(['sr-tid1500', 'json', 'xml']).optional(),
})

@ApiTags('eye-edu')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('eye/edu')
export class EyeEduController {
  constructor(private readonly svc: EyeEduService) {}

  @Get('cases')
  @ApiOperation({ summary: '教学病例列表 (Report 派生 + seed)' })
  listCases(@Query('search') search?: string, @Query('disease') disease?: string, @Query('pageSize') pageSize?: string) {
    return this.svc.listCases({ search, disease, pageSize: pageSize ? Number(pageSize) : 20 })
  }

  @Get('cases/:id')
  @ApiOperation({ summary: '教学病例详情' })
  getCase(@Param('id') id: string) {
    return this.svc.getCase(id)
  }

  @Post('cases')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建教学病例 (内存)' })
  createCase(@Body(new ZodValidationPipe(CreateEduCaseSchema)) body: z.infer<typeof CreateEduCaseSchema>) {
    return this.svc.createCase(body)
  }

  @Post('cases/:id/annotate')
  @ApiOperation({ summary: '保存 DICOM 标注 (内存)' })
  annotate(@Param('id') id: string, @Body(new ZodValidationPipe(AnnotateSchema)) body: z.infer<typeof AnnotateSchema>) {
    return this.svc.annotate(id, body)
  }

  @Get('annotation-projects')
  @ApiOperation({ summary: '教学标注项目列表' })
  listProjects() {
    return this.svc.listProjects()
  }

  @Post('annotation-projects')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建教学标注项目 (内存)' })
  createProject(@Body(new ZodValidationPipe(CreateProjectSchema)) body: z.infer<typeof CreateProjectSchema>) {
    return this.svc.createProject(body)
  }

  @Post('cohort')
  @ApiOperation({ summary: '科研队列筛选' })
  cohort(@Body(new ZodValidationPipe(CohortSchema)) body: z.infer<typeof CohortSchema>) {
    return this.svc.cohort(body.criteria ?? {})
  }

  @Post('deidentify')
  @ApiOperation({ summary: 'DICOM PS 3.15 脱敏任务 (内存)' })
  deidentify(@Body(new ZodValidationPipe(DeidentifySchema)) body: z.infer<typeof DeidentifySchema>) {
    return this.svc.deidentify(body.caseId, body.level ?? 'basic')
  }

  @Post('export-sr')
  @ApiOperation({ summary: '导出 DICOM-SR TID 1500' })
  exportSr(@Body(new ZodValidationPipe(ExportSrSchema)) body: z.infer<typeof ExportSrSchema>) {
    return this.svc.exportSr(body)
  }

  @Get('stats')
  @ApiOperation({ summary: '科研统计报告' })
  stats(@Query('cohortId') cohortId?: string) {
    return this.svc.stats(cohortId)
  }
}
