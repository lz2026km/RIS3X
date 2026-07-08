import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Patient-portalService } from './patient-portal.service';
@ApiTags('patient-portal')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/patient-portal')
export class Patient-portalController {
  constructor(private readonly svc: Patient-portalService) {}
  @Get('patients')
  listPortalPatients(@Param('id') id: string) {
    return this.svc.listPortalPatients(id);
  }

  @Get('patients/:id')
  getPortalPatient(@Param('id') id: string) {
    return this.svc.getPortalPatient(id);
  }

  @Get('clinical-data')
  listClinicalData(@Param('id') id: string) {
    return this.svc.listClinicalData(id);
  }

  @Get('clinical-data/:id')
  getClinicalData(@Param('id') id: string) {
    return this.svc.getClinicalData(id);
  }

  @Get('education')
  listEducation(@Param('id') id: string) {
    return this.svc.listEducation(id);
  }

  @Get('education/:id')
  getEducation(@Param('id') id: string) {
    return this.svc.getEducation(id);
  }

  @Get('mobile/patients')
  getPatientMobile(@Param('id') id: string) {
    return this.svc.getPatientMobile(id);
  }

  @Get('mobile/doctors')
  getDoctorMobile(@Param('id') id: string) {
    return this.svc.getDoctorMobile(id);
  }

  @Get('mobile/nurses')
  getNurseMobile(@Param('id') id: string) {
    return this.svc.getNurseMobile(id);
  }

  @Get('mobile/techs')
  getTechMobile(@Param('id') id: string) {
    return this.svc.getTechMobile(id);
  }
}
