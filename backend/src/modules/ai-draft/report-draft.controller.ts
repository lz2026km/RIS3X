import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import {
  ReportDraftService,
  type GenerateReportDraftRequest,
} from './report-draft.service'
import { ReportStyleSchema } from '../../aiplatform/report-templates'

const GenerateDraftSchema = z.object({
  reportId: z.string().min(1),
  patientId: z.string().optional(),
  examId: z.string().optional(),
  modality: z.string().min(1),
  bodyPart: z.string().min(1),
  clinicalInfo: z.string().optional(),
  findings: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  style: ReportStyleSchema.optional(),
})

const ModifyDraftSchema = z.object({
  draftText: z.string().min(1),
})

@ApiTags('ai')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('ai/report-draft')
export class ReportDraftController {
  constructor(private readonly service: ReportDraftService) {}

  /** v3.0.6.11-61: 环境式 AI 报告草稿生成 */
  @Post()
  generateDraft(@Body(new ZodValidationPipe(GenerateDraftSchema)) body: GenerateReportDraftRequest) {
    return this.service.generateReportDraft(body)
  }

  /** 医生接受: 草稿 → 正式, 落 reports 表 */
  @Post(':id/accept')
  acceptDraft(@Param('id') id: string) {
    return this.service.acceptDraft(id)
  }

  /** 医生修改后保存 */
  @Post(':id/modify')
  modifyDraft(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ModifyDraftSchema)) body: { draftText: string },
  ) {
    return this.service.modifyDraft(id, body.draftText)
  }

  /** 按报告查最新草稿 */
  @Get(':reportId')
  getDraftByReport(@Param('reportId') reportId: string) {
    return this.service.getDraftByReport(reportId)
  }
}
