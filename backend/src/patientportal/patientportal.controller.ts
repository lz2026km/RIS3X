import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { PatientPortalService } from './patientportal.service'

@ApiTags('patient-portal')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
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

  @Get('mobile/patients')
  getPatientMobile() { return this.svc.getPatientMobile() }

  @Get('mobile/doctors')
  getDoctorMobile() { return this.svc.getDoctorMobile() }

  @Get('mobile/nurses')
  getNurseMobile() { return this.svc.getNurseMobile() }

  @Get('mobile/techs')
  getTechMobile() { return this.svc.getTechMobile() }
}
