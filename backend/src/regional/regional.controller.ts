import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { RegionalService } from './regional.service'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { UpdateScheduleSchema, CreateAccessApplicationSchema, CreateConsultationRequestSchema } from './regional.schema'

@ApiTags('regional')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('regional')
export class RegionalController {
  constructor(private readonly svc: RegionalService) {}

  // ── 医联体影像页 (静态子路由必须声明在 imaging/:id 之前) ──

  @Get('imaging/applications')
  listApplications() { return this.svc.listAccessApplications() }

  @Post('imaging/applications')
  createApplication(@Body(new ZodValidationPipe(CreateAccessApplicationSchema)) body: Record<string, unknown>) { return this.svc.createAccessApplication(body) }

  @Post('imaging/applications/:id/approve')
  approveApplication(@Param('id') id: string) { return this.svc.approveAccessApplication(id) }

  @Post('imaging/applications/:id/reject')
  rejectApplication(@Param('id') id: string) { return this.svc.rejectAccessApplication(id) }

  @Get('imaging/consultations')
  listConsultationRequests() { return this.svc.listConsultationRequests() }

  @Post('imaging/consultations')
  createConsultationRequest(@Body(new ZodValidationPipe(CreateConsultationRequestSchema)) body: Record<string, unknown>) { return this.svc.createConsultationRequest(body) }

  @Get('imaging/access-records')
  listAccessRecords() { return this.svc.listAccessRecords() }

  @Get('imaging/institutions')
  listInstitutions() { return this.svc.listInstitutions() }

  @Get('imaging/cross-query')
  crossInstitutionQuery(@Query('institutionId') institutionId?: string, @Query('queryType') queryType?: string, @Query('queryValue') queryValue?: string) {
    return this.svc.crossInstitutionQuery({ institutionId, queryType, queryValue })
  }

  @Get('imaging/document-registry')
  listDocumentRegistry() { return this.svc.listDocumentRegistry() }

  @Get('imaging/pix')
  pixQuery(@Query('patientId') patientId: string) { return this.svc.pixQuery(patientId) }

  @Get('imaging/audit-trail')
  listAuditTrail() { return this.svc.listAuditTrail() }

  // ── 医联体报告页在用孤儿 ──

  @Get('institutions')
  listRegionalInstitutions() { return this.svc.listRegionalInstitutions() }

  @Get('consultations')
  listConsultations() { return this.svc.listConsultations() }

  @Get('report-records')
  listReportRecords() { return this.svc.listReportRecords() }

  @Get('critical-values')
  listCriticalValues() { return this.svc.listCriticalValues() }

  @Get('remote-diagnoses')
  listRemoteDiagnoses() { return this.svc.listRemoteDiagnoses() }

  @Get('co-sign-records')
  listCoSignRecords() { return this.svc.listCoSignRecords() }

  // ── [G005 Wave1A W9] 多站点/多院区仪表板 (前端 regionalApi listSites / listSiteSyncEvents / listSiteRoutingRules) ──

  @Get('sites')
  listSites() { return this.svc.listSites() }

  @Get('sites/sync-events')
  listSiteSyncEvents() { return this.svc.listSiteSyncEvents() }

  @Get('sites/routing-rules')
  listSiteRoutingRules() { return this.svc.listSiteRoutingRules() }

  // ── 原有用例 ──

  @Get('imaging')
  listRegionalImaging() { return this.svc.listRegionalImaging() }

  @Get('imaging/:id')
  getRegionalImaging(@Param('id') id: string) { return this.svc.getRegionalImaging(id) }

  @Get('reports')
  listRegionalReports() { return this.svc.listRegionalReports() }

  @Get('reports/:id')
  getRegionalReport(@Param('id') id: string) { return this.svc.getRegionalReport(id) }

  @Get('schedule')
  getDepartmentSchedule() { return this.svc.getDepartmentSchedule() }

  @Put('schedule/:id')
  updateSchedule(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateScheduleSchema)) body: Record<string, unknown>) { return this.svc.updateSchedule(id, body) }

  @Get('departments')
  listDepartments() { return this.svc.listDepartments() }

  @Get('medical-alliance')
  listMedicalAlliance() { return this.svc.listMedicalAlliance() }

  @Get('integration/fhir')
  getFhirStatus() { return this.svc.getFhirStatus() }

  @Get('integration/ihe')
  getIheStatus() { return this.svc.getIheStatus() }

  @Get('integration/mllp')
  getMllpStatus() { return this.svc.getMllpStatus() }
}
