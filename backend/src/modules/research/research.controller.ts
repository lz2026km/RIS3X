import { Body, Controller, Get, Post, Param } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ResearchService } from './research.service'
import { ResearchExportService, type ExportFormat } from './research-export.service'

// [G005 Wave1B P1] /research — 从 Report/Exam 派生课题数据 + seed 回退
const ProjectSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1),
  leader: z.string().optional(),
  startDate: z.string().optional(),
  status: z.enum(['进行中', '已完成', '已归档']).optional(),
  dataCount: z.number().int().nonnegative().optional(),
  description: z.string().optional(),
  members: z.array(z.string()).optional(),
})

const LabelSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['诊断', '部位', '特征']).optional(),
  color: z.string().optional(),
  useCount: z.number().int().nonnegative().optional(),
})

const IRBSchema = z.object({
  projectName: z.string().min(1),
  pi: z.string().optional(),
  submittedDate: z.string().optional(),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected']).optional(),
  approvedDate: z.string().optional(),
  expiryDate: z.string().optional(),
  consentForm: z.string().optional(),
})

const CohortSchema = z.object({
  name: z.string().min(1),
  criteria: z.string().optional(),
  estimatedSize: z.number().int().nonnegative().optional(),
  createdBy: z.string().optional(),
  createdDate: z.string().optional(),
  lastRun: z.string().optional(),
})

// [G005 v3.0.6.11-103 Wave 18] 科研数据导出中心 Schemas
const DatasetCriteriaSchema = z.object({
  modality: z.string().optional(),
  disease: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  doctor: z.string().optional(),
  result: z.enum(['阳性', '阴性', '全部']).optional(),
})

const BuildDatasetSchema = z.object({
  name: z.string().max(100).optional(),
  criteria: DatasetCriteriaSchema,
})

const CreateExportTaskSchema = z.object({
  name: z.string().min(1).max(100),
  datasetId: z.string().min(1),
  format: z.enum(['CSV', 'JSON', 'EXCEL']),
  fields: z.array(z.string()).max(30).optional(),
  criteria: DatasetCriteriaSchema.optional(),
})

@ApiTags('research')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('research')
export class ResearchController {
  constructor(
    private readonly service: ResearchService,
    private readonly exportCenter: ResearchExportService,
  ) {}

  @Get('projects')
  @ApiOperation({ summary: '科研课题列表 (Report/Exam 派生 + seed)' })
  listProjects() {
    return this.service.listProjects()
  }

  @Post('projects')
  @ApiOperation({ summary: '创建科研课题' })
  createProject(@Body(new ZodValidationPipe(ProjectSchema)) body: z.infer<typeof ProjectSchema>) {
    return this.service.createProject(body)
  }

  @Get('exam-records')
  @ApiOperation({ summary: '科研检查记录 (Exam/Report 派生)' })
  listExamRecords() {
    return this.service.listExamRecords()
  }

  @Get('labels')
  @ApiOperation({ summary: '科研标签列表' })
  listLabels() {
    return this.service.listLabels()
  }

  @Post('labels')
  @ApiOperation({ summary: '创建科研标签' })
  createLabel(@Body(new ZodValidationPipe(LabelSchema)) body: z.infer<typeof LabelSchema>) {
    return this.service.createLabel(body)
  }

  @Get('exports')
  @ApiOperation({ summary: '导出记录 (ExportApproval 派生)' })
  listExportRecords() {
    return this.service.listExportRecords()
  }

  @Get('irb')
  @ApiOperation({ summary: 'IRB 伦理审查列表' })
  listIRBSubmissions() {
    return this.service.listIRBSubmissions()
  }

  @Post('irb')
  @ApiOperation({ summary: '提交 IRB 伦理审查' })
  createIRBSubmission(@Body(new ZodValidationPipe(IRBSchema)) body: z.infer<typeof IRBSchema>) {
    return this.service.createIRBSubmission(body)
  }

  @Get('cohorts')
  @ApiOperation({ summary: '队列定义列表' })
  listCohorts() {
    return this.service.listCohorts()
  }

  @Post('cohorts')
  @ApiOperation({ summary: '创建队列定义' })
  createCohort(@Body(new ZodValidationPipe(CohortSchema)) body: z.infer<typeof CohortSchema>) {
    return this.service.createCohort(body)
  }

  @Get('export-audit')
  @ApiOperation({ summary: '导出审计记录' })
  listExportAudit() {
    return this.service.listExportAudit()
  }

  @Get('quality-scores')
  @ApiOperation({ summary: '数据质量评分' })
  listQualityScores() {
    return this.service.listQualityScores()
  }

  // ════════════ [G005 v3.0.6.11-103 Wave 18] 科研数据导出中心 ════════════

  @Post('datasets/build')
  @ApiOperation({ summary: '构建数据集 (模态/病种/时间/医生筛选)' })
  buildDataset(@Body(new ZodValidationPipe(BuildDatasetSchema)) body: z.infer<typeof BuildDatasetSchema>) {
    return this.exportCenter.buildDataset({ name: body.name, criteria: body.criteria })
  }

  @Get('datasets')
  @ApiOperation({ summary: '数据集列表' })
  listDatasets() {
    return this.exportCenter.listDatasets()
  }

  @Get('export-fields')
  @ApiOperation({ summary: '导出字段定义 (分组)' })
  listExportFields() {
    return this.exportCenter.listFields()
  }

  @Post('export/tasks')
  @ApiOperation({ summary: '创建导出任务 (CSV/JSON/Excel)' })
  createExportTask(@Body(new ZodValidationPipe(CreateExportTaskSchema)) body: z.infer<typeof CreateExportTaskSchema>) {
    return this.exportCenter.createTask({ ...body, format: body.format as ExportFormat })
  }

  @Get('export/tasks')
  @ApiOperation({ summary: '导出任务历史' })
  listExportTasks() {
    return this.exportCenter.listTasks()
  }

  @Get('export/tasks/:id')
  @ApiOperation({ summary: '导出任务详情' })
  getExportTask(@Param('id') id: string) {
    return this.exportCenter.getTask(id)
  }

  @Get('export/tasks/:id/content')
  @ApiOperation({ summary: '导出任务内容预览/下载 (概念)' })
  getExportTaskContent(@Param('id') id: string) {
    return this.exportCenter.getTaskContent(id)
  }

  @Get('export/stats')
  @ApiOperation({ summary: '导出统计 (格式/状态/近7天)' })
  exportStats() {
    return this.exportCenter.stats()
  }
}
