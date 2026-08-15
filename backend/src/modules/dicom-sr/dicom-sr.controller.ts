import { Body, Controller, Get, Header, NotFoundException, Param, Post, Query, Res } from '@nestjs/common'
import { Response } from 'express'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { DicomSrService, type GenerateSrDto, type FromAiSrDto, type EncapsulatePdfDto } from './dicom-sr.service'

const GenerateSrSchema = z.object({
  reportId: z.string().min(1),
  templateId: z.enum(['tid1500', 'tid2000']),
  findings: z.string().max(5000).optional(),
  impression: z.string().max(5000).optional(),
})

// [G005 Wave4A] G-14 AI 结果 → DICOM SR 封装
const FromAiSchema = z.object({
  studyId: z.string().min(1),
  findings: z
    .array(
      z.object({
        label: z.string().min(1),
        confidence: z.number().min(0).max(1).optional(),
        x: z.number().min(0).max(1).optional(),
        y: z.number().min(0).max(1).optional(),
        width: z.number().min(0).max(1).optional(),
        height: z.number().min(0).max(1).optional(),
        description: z.string().max(1000).optional(),
      }),
    )
    .min(1)
    .max(500),
  templateId: z.enum(['tid1500', 'tid2000']).optional(),
  modelName: z.string().max(200).optional(),
  summary: z.string().max(5000).optional(),
})

// [G005 Wave4B] G-01 Encapsulated PDF 封装
const EncapsulatePdfSchema = z
  .object({
    reportId: z.string().min(1).optional(),
    studyId: z.string().min(1).optional(),
    pdfUrl: z.string().max(2000).optional(),
    pdfBase64: z.string().max(50_000_000).optional(),
  })
  .refine((d) => d.reportId || d.studyId, { message: 'reportId 或 studyId 必填' })

// [G005 Wave 8] DICOM SR → 报告回填: 解析 SR 测量值生成摘要段落
const ToReportSchema = z.object({
  srId: z.string().min(1),
  reportId: z.string().min(1),
})

@ApiTags('dicom-sr')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('dicom-sr')
export class DicomSrController {
  constructor(private readonly service: DicomSrService) {}

  // [G005 Wave 8] DICOM SR 测量值 → 报告回填 (返回 { paragraph, measurements[] }, 前端 insertHtml)
  @Post('to-report')
  toReport(@Body(new ZodValidationPipe(ToReportSchema)) body: z.infer<typeof ToReportSchema>) {
    return this.service.toReport(body)
  }

  @Post('templates')
  getTemplates() {
    return this.service.getTemplates()
  }

  // ── [G005 Wave 10A] 测量模板库 (TID 1500/2000, 20 个完整模板 seed) ──
  // 注意: 静态路径 (categories) 必须先于 :id 声明
  @Get('measurement-templates/categories')
  getMeasurementTemplateCategories() {
    return { success: true, data: this.service.getMeasurementTemplateCategories() }
  }

  @Get('measurement-templates')
  getMeasurementTemplates(@Query('modality') modality?: string, @Query('bodyPart') bodyPart?: string, @Query('category') category?: string) {
    return { success: true, data: this.service.getMeasurementTemplates({ modality, bodyPart, category }) }
  }

  @Get('measurement-templates/:id')
  getMeasurementTemplate(@Param('id') id: string) {
    return { success: true, data: this.service.getMeasurementTemplate(id) }
  }

  @Get()
  list() {
    return this.service.list()
  }

  @Post('generate')
  async generate(@Body(new ZodValidationPipe(GenerateSrSchema)) body: GenerateSrDto) {
    return this.service.generate(body)
  }

  // [G005 Wave4A] G-14 AI 结果 → DICOM SR 封装 (TID 1500/2000)
  @Post('from-ai')
  async fromAi(@Body(new ZodValidationPipe(FromAiSchema)) body: FromAiSrDto) {
    return this.service.fromAi(body)
  }

  // [G005 Wave4B] G-01 DICOM PDF 封装 (Encapsulated PDF Storage)
  @Post('encapsulate-pdf')
  encapsulatePdf(@Body(new ZodValidationPipe(EncapsulatePdfSchema)) body: EncapsulatePdfDto) {
    return this.service.encapsulatePdf(body)
  }

  @Get('encapsulated/:id')
  findEncapsulated(@Param('id') id: string) {
    return this.service.findEncapsulated(id)
  }

  @Get('by-report/:reportId')
  async findByReport(@Param('reportId') reportId: string) {
    const doc = await this.service.findByReportId(reportId)
    if (!doc) throw new NotFoundException(`SR document for report ${reportId} not found`)
    return doc
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const doc = await this.service.findById(id)
    if (!doc) throw new NotFoundException(`SR document ${id} not found`)
    return doc
  }

  @Post(':id/finalize')
  finalize(@Param('id') id: string) {
    return this.service.finalize(id)
  }

  @Post(':id/push-oru')
  pushOru(@Param('id') id: string) {
    return this.service.pushOru(id)
  }

  @Get(':id/download')
  @Header('Content-Type', 'application/dicom')
  async download(@Param('id') id: string, @Res() res: Response) {
    const doc = await this.service.findById(id)
    if (!doc) throw new NotFoundException(`SR document ${id} not found`)
    res.setHeader('Content-Disposition', `attachment; filename="${doc.sopInstanceUid}.sr"`)
    res.send(doc.rawContent)
  }
}
