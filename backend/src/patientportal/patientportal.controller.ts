import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common'
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
