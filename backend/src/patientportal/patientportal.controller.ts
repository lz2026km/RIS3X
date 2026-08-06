import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { PatientPortalService, CreatePortalAppointmentDto, CreatePortalFeedbackDto } from './patientportal.service'

const CreateAppointmentSchema = z.object({
  patientId: z.string().min(1),
  modality: z.string().min(1),
  bodyPart: z.string().optional(),
  scheduledAt: z.string().datetime().or(z.date()),
  deviceId: z.string().optional(),
})

const CreateFeedbackSchema = z.object({
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  category: z.string().optional(),
  comment: z.string().max(2000).optional(),
})

// [W5] 宣教资料写入: POST /patient-portal/education 创建, DELETE /patient-portal/education/:key 删除
const CreateEducationSchema = z.object({
  title: z.string().min(1),
  category: z.enum(['pre_exam', 'post_exam', 'condition', 'medication', 'general']).default('general'),
  contentType: z.enum(['text', 'video', 'audio', 'pdf', 'image']).default('text'),
  content: z.string().min(1),
  summary: z.string().max(500).optional(),
  modality: z.string().optional(),
  bodyPart: z.string().optional(),
  duration: z.number().int().positive().optional(),
  tags: z.array(z.string().min(1)).max(20).optional(),
  language: z.enum(['zh-CN', 'en']).default('zh-CN'),
})

@ApiTags('patient-portal')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN', 'NURSE')
@Controller('patient-portal')
export class PatientPortalController {
  constructor(private readonly svc: PatientPortalService) {}

  @Get('patients')
  listPortalPatients() { return this.svc.listPortalPatients() }

  @Get('patients/:id')
  getPortalPatient(@Param('id') id: string) { return this.svc.getPortalPatient(id) }

  @Get('clinical-data')
  listClinicalData() { return this.svc.listClinicalData() }

  @Get('clinical-data/:id')
  getClinicalData(@Param('id') id: string) { return this.svc.getClinicalData(id) }

  @Get('education')
  listEducation() { return this.svc.listEducation() }

  @Get('education/:id')
  getEducation(@Param('id') id: string) { return this.svc.getEducation(id) }

  @Post('education')
  createEducation(@Body(new ZodValidationPipe(CreateEducationSchema)) body: z.infer<typeof CreateEducationSchema>) {
    return this.svc.createEducation(body)
  }

  @Delete('education/:key')
  deleteEducation(@Param('key') key: string) {
    return this.svc.deleteEducation(key)
  }

  @Get('appointments')
  listAppointments(@Query('patientId') patientId?: string) {
    return this.svc.listAppointments(patientId)
  }

  @Post('appointments')
  createAppointment(@Body(new ZodValidationPipe(CreateAppointmentSchema)) body: CreatePortalAppointmentDto) {
    return this.svc.createAppointment(body)
  }

  @Get('reports')
  listReports(@Query('patientId') patientId?: string) {
    return this.svc.listReports(patientId)
  }

  @Get('reports/:id')
  getReport(@Param('id') id: string) {
    return this.svc.getReport(id)
  }

  @Get('images/:studyUid')
  getImages(@Param('studyUid') studyUid: string) {
    return this.svc.listImages(studyUid)
  }

  @Post('feedback')
  createFeedback(@Body(new ZodValidationPipe(CreateFeedbackSchema)) body: CreatePortalFeedbackDto) {
    return this.svc.createFeedback(body)
  }

  @Get('mobile/patients')
  getPatientMobile() { return this.svc.getPatientMobile() }

  @Get('mobile/doctors')
  getDoctorMobile() { return this.svc.getDoctorMobile() }

  @Get('mobile/nurses')
  getNurseMobile() { return this.svc.getNurseMobile() }

  @Get('mobile/techs')
  getTechMobile() { return this.svc.getTechMobile() }
}
