import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { EyeService } from './eye.service'
import { CreateEyeStudySchema } from './dto/create-eye.dto'
import type { CreateEyeStudyDto } from './dto/create-eye.dto'
import { UpdateEyeStudySchema } from './dto/update-eye.dto'
import type { UpdateEyeStudyDto } from './dto/update-eye.dto'
import { CreateIolItemSchema, IolOutSchema, IolTransferSchema, IolAdjustSchema, CreateContactLensSchema, UpdateContactLensSchema, ContactLensFittingSchema, OkLensDesignSchema } from './dto/materials.dto'
import { z } from 'zod'

const UpdateEmrSchema = z.object({ notes: z.string().optional() })
const AiInferenceSchema = z.object({
  studyId: z.string().min(1),
  modelId: z.string().min(1),
  diagnosis: z.string().min(1),
  confidence: z.number().min(0).max(1),
  heatmapUrl: z.string().url().optional(),
})
const IolCalculationSchema = z.object({ lensId: z.string().min(1), axialLength: z.number().positive(), keratometry: z.number().positive() })
const GenerateReportSchema = z.object({ studyId: z.string().min(1), template: z.string().optional() })

type CreateIolItemDto = z.infer<typeof CreateIolItemSchema>
type IolOutDto = z.infer<typeof IolOutSchema>
type IolTransferDto = z.infer<typeof IolTransferSchema>
type IolAdjustDto = z.infer<typeof IolAdjustSchema>
type CreateContactLensDto = z.infer<typeof CreateContactLensSchema>
type UpdateContactLensDto = z.infer<typeof UpdateContactLensSchema>
type ContactLensFittingDto = z.infer<typeof ContactLensFittingSchema>
type OkLensDesignDto = z.infer<typeof OkLensDesignSchema>

@ApiTags('eye')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('eye')
export class EyeController {
  constructor(private readonly eye: EyeService) {}

  // ── [G005-P1] PACS 在用孤儿 (demo 演示级) ──

  @Get('pacs/studies')
  listPacsStudies(@Query('modality') modality?: string, @Query('skip') skip?: string, @Query('take') take?: string) {
    return this.eye.listPacsStudies({ modality, skip: skip ? Number(skip) : undefined, take: take ? Number(take) : undefined })
  }

  @Get('pacs/measurements')
  listPacsMeasurements(@Query('studyId') studyId?: string) {
    return this.eye.listPacsMeasurements({ studyId })
  }

  // ── [G005-P1] AI 在用孤儿 ──

  @Get('ai/inferences')
  listAiInferences(@Query('studyId') studyId?: string, @Query('modelId') modelId?: string) {
    return this.eye.listAiInferences({ studyId, modelId })
  }

  @Get('ai/inferences/:id')
  getAiInference(@Param('id') id: string) {
    return this.eye.getAiInference(id)
  }

  // ── [G005-P1] EMR 在用孤儿 (静态路径必须在 emr/:patientId 之前) ──

  @Get('emr/records')
  listEmrRecords(@Query('patientId') patientId?: string) {
    return this.eye.listEmrRecords({ patientId })
  }

  @Get('emr/:patientId')
  getEmr(@Param('patientId') patientId: string) {
    return this.eye.getEmr(patientId)
  }

  @Put('emr/:patientId')
  updateEmr(@Param('patientId') patientId: string, @Body(new ZodValidationPipe(UpdateEmrSchema)) data: { notes?: string }) {
    return this.eye.updateEmr(patientId, data)
  }

  // ── [G005-P1] Report 在用孤儿 ──

  @Get('report/reports')
  listReportReports(@Query('patientId') patientId?: string) {
    return this.eye.listReportReports({ patientId })
  }

  @Get('report/drafts')
  listReportDrafts() {
    return this.eye.listReportDrafts()
  }

  @Get('report/templates')
  listReportTemplates(@Query('specialty') specialty?: string) {
    return this.eye.listReportTemplates({ specialty })
  }

  // ── [G005-P1] RIS 在用孤儿 (seed) ──

  @Get('ris/appointments/today')
  listTodayAppointments() {
    return this.eye.listTodayAppointments()
  }

  @Get('ris/appointments')
  listRisAppointments(@Query('date') date?: string) {
    return this.eye.listRisAppointments({ date })
  }

  @Get('ris/follow-ups')
  listRisFollowups() {
    return this.eye.listRisFollowups()
  }

  @Get('ris/surgeries')
  listRisSurgeries() {
    return this.eye.listRisSurgeries()
  }

  @Get('ris/referrals')
  listRisReferrals() {
    return this.eye.listRisReferrals()
  }

  // ── [G005-P1] 眼料: IOL 库存 (low-stock/expiring 必须在 :id 之前) ──

  @Get('iol/inventory/low-stock')
  listIolLowStock(@Query('threshold') threshold?: string) {
    return this.eye.listIolLowStock(threshold ? Number(threshold) : 5)
  }

  @Get('iol/inventory/expiring')
  listIolExpiring(@Query('days') days?: string) {
    return this.eye.listIolExpiring(days ? Number(days) : 90)
  }

  @Get('iol/inventory')
  listIolInventory(@Query('type') type?: string, @Query('status') status?: string, @Query('supplier') supplier?: string) {
    return this.eye.listIolInventory({ type, status, supplier })
  }

  @Get('iol/inventory/:id')
  getIolInventoryItem(@Param('id') id: string) {
    return this.eye.getIolInventoryItem(id)
  }

  @Post('iol/inventory')
  @HttpCode(HttpStatus.CREATED)
  createIolInventoryItem(@Body(new ZodValidationPipe(CreateIolItemSchema)) body: CreateIolItemDto) {
    return this.eye.createIolInventoryItem(body)
  }

  @Post('iol/inventory/:id/out')
  iolOutStock(@Param('id') id: string, @Body(new ZodValidationPipe(IolOutSchema)) body: IolOutDto) {
    return this.eye.iolOutStock(id, body)
  }

  @Post('iol/inventory/:id/transfer')
  iolTransfer(@Param('id') id: string, @Body(new ZodValidationPipe(IolTransferSchema)) body: IolTransferDto) {
    return this.eye.iolTransfer(id, body)
  }

  @Post('iol/inventory/:id/adjust')
  iolAdjust(@Param('id') id: string, @Body(new ZodValidationPipe(IolAdjustSchema)) body: IolAdjustDto) {
    return this.eye.iolAdjust(id, body)
  }

  // ── [G005-P1] 眼料: 接触镜库 ──

  @Get('contact-lens/inventory')
  listContactLensInventory(@Query('type') type?: string, @Query('brand') brand?: string) {
    return this.eye.listContactLensInventory({ type, brand })
  }

  @Get('contact-lens/inventory/:id')
  getContactLens(@Param('id') id: string) {
    return this.eye.getContactLens(id)
  }

  @Post('contact-lens/inventory')
  @HttpCode(HttpStatus.CREATED)
  createContactLens(@Body(new ZodValidationPipe(CreateContactLensSchema)) body: CreateContactLensDto) {
    return this.eye.createContactLens(body)
  }

  @Put('contact-lens/inventory/:id')
  updateContactLens(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateContactLensSchema)) body: UpdateContactLensDto) {
    return this.eye.updateContactLens(id, body)
  }

  @Delete('contact-lens/inventory/:id')
  deleteContactLens(@Param('id') id: string) {
    return this.eye.deleteContactLens(id)
  }

  @Post('contact-lens/fitting')
  contactLensFitting(@Body(new ZodValidationPipe(ContactLensFittingSchema)) body: ContactLensFittingDto) {
    return this.eye.contactLensFitting(body)
  }

  @Post('optometry/ok-lens/design')
  okLensDesign(@Body(new ZodValidationPipe(OkLensDesignSchema)) body: OkLensDesignDto) {
    return this.eye.okLensDesign(body)
  }

  // ── 原有用例 ──

  @Get('studies')
  listStudies(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.eye.listStudies(Number(skip ?? 0), Number(take ?? 20))
  }

  @Get('studies/:id')
  getStudy(@Param('id') id: string) {
    return this.eye.getStudy(id)
  }

  @Post('studies')
  @HttpCode(HttpStatus.CREATED)
  createStudy(@Body(new ZodValidationPipe(CreateEyeStudySchema)) body: CreateEyeStudyDto) {
    return this.eye.createStudy(body)
  }

  @Put('studies/:id')
  updateStudy(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateEyeStudySchema)) body: UpdateEyeStudyDto) {
    return this.eye.updateStudy(id, body)
  }

  @Delete('studies/:id')
  deleteStudy(@Param('id') id: string) {
    return this.eye.deleteStudy(id)
  }

  @Get('patients/:patientId/studies')
  listStudiesByPatient(@Param('patientId') patientId: string) {
    return this.eye.listStudiesByPatient(patientId)
  }

  @Get('ai/models')
  listAiModels() {
    return this.eye.listAiModels()
  }

  @Post('ai/inferences')
  @HttpCode(HttpStatus.CREATED)
  createAiInference(@Body(new ZodValidationPipe(AiInferenceSchema)) data: { studyId: string; modelId: string; diagnosis: string; confidence: number; heatmapUrl?: string }) {
    return this.eye.createAiInference(data)
  }

  @Get('iol/lenses')
  listIolLenses() {
    return this.eye.listIolLenses()
  }

  @Post('iol/calculate/barrett')
  calculateBarrett(@Body(new ZodValidationPipe(IolCalculationSchema)) data: { lensId: string; axialLength: number; keratometry: number }) {
    return this.eye.calculateBarrett(data)
  }

  @Post('iol/calculate/kane')
  calculateKane(@Body(new ZodValidationPipe(IolCalculationSchema)) data: { lensId: string; axialLength: number; keratometry: number }) {
    return this.eye.calculateKane(data)
  }

  @Get('reports')
  listReports() {
    return this.eye.listReports()
  }

  @Post('reports')
  @HttpCode(HttpStatus.CREATED)
  generateReport(@Body(new ZodValidationPipe(GenerateReportSchema)) data: { studyId: string; template?: string }) {
    return this.eye.generateReport(data)
  }
}
