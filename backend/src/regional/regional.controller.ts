import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { RegionalService } from './regional.service'

@ApiTags('regional')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('regional')
export class RegionalController {
  constructor(private readonly svc: RegionalService) {}

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
  updateSchedule(@Param('id') id: string, @Body() body: any) { return this.svc.updateSchedule(id, body) }

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
