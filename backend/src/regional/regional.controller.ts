import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RegionalService } from './regional.service';
@ApiTags('regional')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/regional')
export class RegionalController {
  constructor(private readonly svc: RegionalService) {}
  @Get('imaging')
  listRegionalImaging(@Param('id') id: string) {
    return this.svc.listRegionalImaging(id);
  }

  @Get('imaging/:id')
  getRegionalImaging(@Param('id') id: string) {
    return this.svc.getRegionalImaging(id);
  }

  @Get('reports')
  listRegionalReports(@Param('id') id: string) {
    return this.svc.listRegionalReports(id);
  }

  @Get('reports/:id')
  getRegionalReport(@Param('id') id: string) {
    return this.svc.getRegionalReport(id);
  }

  @Get('schedule')
  getDepartmentSchedule(@Param('id') id: string) {
    return this.svc.getDepartmentSchedule(id);
  }

  @Put('schedule/:id')
  updateSchedule(@Param('id') id: string, @Body() body: any) {
    return this.svc.updateSchedule(id, body);
  }

  @Get('departments')
  listDepartments(@Param('id') id: string) {
    return this.svc.listDepartments(id);
  }

  @Get('medical-alliance')
  listMedicalAlliance(@Param('id') id: string) {
    return this.svc.listMedicalAlliance(id);
  }

  @Get('integration/fhir')
  getFhirStatus(@Param('id') id: string) {
    return this.svc.getFhirStatus(id);
  }

  @Get('integration/ihe')
  getIheStatus(@Param('id') id: string) {
    return this.svc.getIheStatus(id);
  }

  @Get('integration/mllp')
  getMllpStatus(@Param('id') id: string) {
    return this.svc.getMllpStatus(id);
  }
}
