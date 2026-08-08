import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { DentalService } from './dental.service'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import {
  AddInventoryItemSchema,
  CreateAiFindingSchema,
  CreateDentalAppointmentSchema,
  CreateDentalInvoiceSchema,
  CreateDentalStudySchema,
  CreateImplantSchema,
  UpdateDentalAppointmentSchema,
  UpdateDentalStudySchema,
  UpdateImplantSchema,
  UpdateInventoryItemSchema,
} from './dental.schema'
import { z } from 'zod'

const LooseBodySchema = z.object({}).passthrough()

type CreateDentalStudyDto = z.infer<typeof CreateDentalStudySchema>
type UpdateDentalStudyDto = z.infer<typeof UpdateDentalStudySchema>
type CreateAiFindingDto = z.infer<typeof CreateAiFindingSchema>
type CreateImplantDto = z.infer<typeof CreateImplantSchema>
type UpdateImplantDto = z.infer<typeof UpdateImplantSchema>
type CreateDentalAppointmentDto = z.infer<typeof CreateDentalAppointmentSchema>
type UpdateDentalAppointmentDto = z.infer<typeof UpdateDentalAppointmentSchema>
type CreateDentalInvoiceDto = z.infer<typeof CreateDentalInvoiceSchema>
type AddInventoryItemDto = z.infer<typeof AddInventoryItemSchema>
type UpdateInventoryItemDto = z.infer<typeof UpdateInventoryItemSchema>

@ApiTags('dental')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('dental')
export class DentalController {
  constructor(private readonly svc: DentalService) {}

  @Get('studies')
  listStudies() { return this.svc.listStudies() }

  @Get('studies/:id')
  getStudy(@Param('id') id: string) { return this.svc.getStudy(id) }

  @Post('studies')
  createStudy(@Body(new ZodValidationPipe(CreateDentalStudySchema)) body: CreateDentalStudyDto) { return this.svc.createStudy(body) }

  @Put('studies/:id')
  updateStudy(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateDentalStudySchema)) body: UpdateDentalStudyDto) { return this.svc.updateStudy(id, body) }

  @Delete('studies/:id')
  deleteStudy(@Param('id') id: string) { return this.svc.deleteStudy(id) }

  @Get('ai-findings')
  listAiFindings() { return this.svc.listAiFindings() }

  @Post('ai-findings')
  createAiFinding(@Body(new ZodValidationPipe(CreateAiFindingSchema)) body: CreateAiFindingDto) { return this.svc.createAiFinding(body) }

  @Get('implants')
  listImplants() { return this.svc.listImplants() }

  @Post('implants')
  createImplant(@Body(new ZodValidationPipe(CreateImplantSchema)) body: CreateImplantDto) { return this.svc.createImplant(body) }

  @Put('implants/:id')
  updateImplant(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateImplantSchema)) body: UpdateImplantDto) { return this.svc.updateImplant(id, body) }

  @Get('appointments')
  listAppointments() { return this.svc.listAppointments() }

  @Post('appointments')
  createAppointment(@Body(new ZodValidationPipe(CreateDentalAppointmentSchema)) body: CreateDentalAppointmentDto) { return this.svc.createAppointment(body) }

  @Put('appointments/:id')
  updateAppointment(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateDentalAppointmentSchema)) body: UpdateDentalAppointmentDto) { return this.svc.updateAppointment(id, body) }

  @Get('invoices')
  listInvoices() { return this.svc.listInvoices() }

  @Post('invoices')
  createInvoice(@Body(new ZodValidationPipe(CreateDentalInvoiceSchema)) body: CreateDentalInvoiceDto) { return this.svc.createInvoice(body) }

  @Get('inventory')
  listInventory() { return this.svc.listInventory() }

  @Post('inventory')
  addInventoryItem(@Body(new ZodValidationPipe(AddInventoryItemSchema)) body: AddInventoryItemDto) { return this.svc.addInventoryItem(body) }

  @Put('inventory/:id')
  updateInventoryItem(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateInventoryItemSchema)) body: UpdateInventoryItemDto) { return this.svc.updateInventoryItem(id, body) }

  // ── [G005-P1] 在用孤儿补齐: 核心 8 个 (DentalStudy/DentalAppointment 表查 + seed) ──

  @Get('cbct/list')
  listCbct() { return this.svc.listCbct() }

  @Get('panoramic/list')
  listPanoramic() { return this.svc.listPanoramic() }

  @Get('periapical/list')
  listPeriapical() { return this.svc.listPeriapical() }

  @Get('scan/list')
  listScan() { return this.svc.listScan() }

  @Get('bitewing/list')
  listBitewing() { return this.svc.listBitewing() }

  @Get('compare/:idA/:idB')
  compareStudies(@Param('idA') idA: string, @Param('idB') idB: string) { return this.svc.compareStudies(idA, idB) }

  @Get('stats')
  getStats() { return this.svc.getStats() }

  @Get('treatments/types')
  listTreatmentTypes() { return this.svc.listTreatmentTypes() }

  @Get('treatments')
  listTreatments(@Query('status') status?: string, @Query('patientId') patientId?: string, @Query('pageSize') pageSize?: string) {
    return this.svc.listTreatments({ status, patientId, pageSize: pageSize ? Number(pageSize) : undefined })
  }

  // ── [G005 W1-A] 在用孤儿补齐: 治疗 CRUD / 状态流转 ──

  @Get('treatments/:id')
  getTreatment(@Param('id') id: string) { return this.svc.getTreatment(id) }

  @Post('treatments')
  createTreatment(@Body(new ZodValidationPipe(LooseBodySchema)) body: Record<string, unknown>) { return this.svc.createTreatment(body) }

  @Put('treatments/:id')
  updateTreatment(@Param('id') id: string, @Body(new ZodValidationPipe(LooseBodySchema)) body: Record<string, unknown>) { return this.svc.updateTreatment(id, body) }

  @Post('treatments/:id/start')
  startTreatment(@Param('id') id: string) { return this.svc.startTreatment(id) }

  @Post('treatments/:id/complete')
  completeTreatment(@Param('id') id: string) { return this.svc.completeTreatment(id) }

  // ── [G005 W1-A] 在用孤儿补齐: 牙椅排班 / 患者 / 医生 ──

  @Get('schedule/chairs')
  listScheduleChairs() { return this.svc.listScheduleChairs() }

  @Get('schedule/appointments')
  listScheduleAppointments(@Query('date') date?: string) { return this.svc.listScheduleAppointments(date) }

  @Post('schedule/appointments')
  createScheduleAppointment(@Body(new ZodValidationPipe(LooseBodySchema)) body: Record<string, unknown>) { return this.svc.createScheduleAppointment(body) }

  @Post('schedule/appointments/:id/status')
  updateScheduleAppointmentStatus(@Param('id') id: string, @Body(new ZodValidationPipe(LooseBodySchema)) body: { status?: string }) { return this.svc.updateScheduleAppointmentStatus(id, body) }

  @Get('schedule/stats')
  getScheduleStats() { return this.svc.getScheduleStats() }

  @Get('patients')
  listDentalPatients() { return this.svc.listDentalPatients() }

  @Get('dentists')
  listDentists() { return this.svc.listDentists() }

  @Get('chart/:patientId/psr')
  listPsrRecords(@Param('patientId') patientId: string) { return this.svc.listPsrRecords(patientId) }

  @Post('chart/:patientId/psr')
  createPsrRecord(@Param('patientId') patientId: string, @Body(new ZodValidationPipe(LooseBodySchema)) body: Record<string, unknown>) { return this.svc.createPsrRecord(patientId, body) }

  // ── [G005 W1-A] 在用孤儿补齐: 转诊 / 远程会诊 ──

  @Get('referrals')
  listReferrals() { return this.svc.listReferrals() }

  @Post('referrals')
  createReferral(@Body(new ZodValidationPipe(LooseBodySchema)) body: Record<string, unknown>) { return this.svc.createReferral(body) }

  @Post('referrals/:id/accept')
  acceptReferral(@Param('id') id: string) { return this.svc.acceptReferral(id) }

  @Get('tele/sessions')
  listTeleSessions() { return this.svc.listTeleSessions() }

  @Post('tele/sessions')
  createTeleSession(@Body(new ZodValidationPipe(LooseBodySchema)) body: Record<string, unknown>) { return this.svc.createTeleSession(body) }

  @Delete('tele/sessions/:id')
  endTeleSession(@Param('id') id: string) { return this.svc.endTeleSession(id) }

  // ── [G005 W1-A] 在用孤儿补齐: CAD/CAM ──

  @Get('cad/materials')
  getCadMaterials() { return this.svc.getCadMaterials() }

  @Get('cad/shades')
  getCadShades() { return this.svc.getCadShades() }

  @Get('cad/milling-units')
  getCadMillingUnits() { return this.svc.getCadMillingUnits() }

  @Get('cad/templates')
  getCadTemplates() { return this.svc.getCadTemplates() }

  @Post('cad/design')
  createCadDesign(@Body(new ZodValidationPipe(LooseBodySchema)) body: Record<string, unknown>) { return this.svc.createCadDesign(body) }

  @Get('cad/design/:id')
  getCadDesign(@Param('id') id: string) { return this.svc.getCadDesign(id) }

  @Get('cad/designs')
  listCadDesigns(@Query('patientId') patientId?: string) { return this.svc.listCadDesigns(patientId) }

  @Put('cad/design/:id/margin-line')
  saveMarginLine(@Param('id') id: string, @Body(new ZodValidationPipe(LooseBodySchema)) body: { marginLine?: number[][] }) { return this.svc.saveMarginLine(id, body) }

  @Put('cad/design/:id/anatomy')
  saveAnatomy(@Param('id') id: string, @Body(new ZodValidationPipe(LooseBodySchema)) body: Record<string, unknown>) { return this.svc.saveAnatomy(id, body) }

  @Post('cad/design/:id/preview')
  previewCadDesign(@Param('id') id: string) { return this.svc.previewCadDesign(id) }

  @Post('cad/design/:id/export-stl')
  exportCadStl(@Param('id') id: string) { return this.svc.exportCadStl(id) }

  @Put('cad/design/:id/status')
  updateCadStatus(@Param('id') id: string, @Body(new ZodValidationPipe(LooseBodySchema)) body: { status?: string }) { return this.svc.updateCadStatus(id, body) }

  @Post('cad/design/:id/submit-mill')
  submitMill(@Param('id') id: string, @Body(new ZodValidationPipe(LooseBodySchema)) body: { millingUnit?: string }) { return this.svc.submitMill(id, body) }

  // ── [G005 W1-A] 在用孤儿补齐: 种植 3D 规划 ──

  @Get('implant/inventory/brands')
  getImplantBrands() { return this.svc.getImplantBrands() }

  @Get('implant/inventory/models')
  getImplantModels(@Query('brandId') brandId?: string, @Query('toothNo') toothNo?: string) { return this.svc.getImplantModels(brandId, toothNo ? Number(toothNo) : undefined) }

  @Get('implant/inventory/sleeves')
  getGuideSleeves(@Query('brand') brand?: string) { return this.svc.getGuideSleeves(brand) }

  @Post('implant/plan-3d')
  createImplantPlan3d(@Body(new ZodValidationPipe(LooseBodySchema)) body: Record<string, unknown>) { return this.svc.createImplantPlan3d(body) }

  @Get('implant/plan-3d')
  listImplantPlans3d() { return this.svc.listImplantPlans3d() }

  @Get('implant/plan-3d/:id')
  getImplantPlan3d(@Param('id') id: string) { return this.svc.getImplantPlan3d(id) }

  @Put('implant/plan-3d/:id/placement')
  updateImplantPlacement(@Param('id') id: string, @Body(new ZodValidationPipe(LooseBodySchema)) body: Record<string, unknown>) { return this.svc.updateImplantPlacement(id, body) }

  @Put('implant/plan-3d/:id/implant')
  updateImplantModel(@Param('id') id: string, @Body(new ZodValidationPipe(LooseBodySchema)) body: { brand?: string; model?: string }) { return this.svc.updateImplantModel(id, body) }

  @Get('implant/plan-3d/:id/nerve-distance')
  getImplantNerveDistance(@Param('id') id: string) { return this.svc.getImplantNerveDistance(id) }

  @Post('implant/plan-3d/:id/bone-density-roi')
  getImplantBoneDensityRoi(@Param('id') id: string, @Body(new ZodValidationPipe(LooseBodySchema)) body: Record<string, unknown>) { return this.svc.getImplantBoneDensityRoi(id, body) }

  @Post('implant/plan-3d/:id/nerve-mark')
  markImplantNerve(@Param('id') id: string, @Body(new ZodValidationPipe(LooseBodySchema)) body: { points?: unknown[] }) { return this.svc.markImplantNerve(id, body) }

  @Post('implant/plan-3d/:id/validate')
  validateImplantPlan(@Param('id') id: string) { return this.svc.validateImplantPlan(id) }

  @Post('implant/plan-3d/:id/approve')
  approveImplantPlan(@Param('id') id: string) { return this.svc.approveImplantPlan(id) }

  // ── [G005 W1-A] 在用孤儿补齐: 导板 / 口扫模型 / 口腔 AI ──

  @Get('guide/materials')
  getGuideMaterials() { return this.svc.getGuideMaterials() }

  @Get('guide/list')
  listSurgicalGuides() { return this.svc.listSurgicalGuides() }

  @Post('guide')
  createSurgicalGuide(@Body(new ZodValidationPipe(LooseBodySchema)) body: Record<string, unknown>) { return this.svc.createSurgicalGuide(body) }

  @Post('guide/:id/export')
  exportSurgicalGuide(@Param('id') id: string) { return this.svc.exportSurgicalGuide(id) }

  @Get('scan/:id/model')
  getScanModel(@Param('id') id: string) { return this.svc.getScanModel(id) }

  @Post('ai/caries-detection')
  detectCaries() { return this.svc.detectCaries() }

  @Post('ai/periapical-grading')
  gradePeriapical() { return this.svc.gradePeriapical() }

  @Post('ai/bone-loss')
  measureBoneLoss() { return this.svc.measureBoneLoss() }

  @Post('ai/root-canal-detection')
  detectRootCanal() { return this.svc.detectRootCanal() }

  @Post('ai/oral-cavity-screening')
  screenOralCavity() { return this.svc.screenOralCavity() }
}
