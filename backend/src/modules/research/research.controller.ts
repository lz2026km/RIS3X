import { Body, Controller, Get, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ResearchService } from './research.service'

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

@ApiTags('research')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('research')
export class ResearchController {
  constructor(private readonly service: ResearchService) {}

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
}
