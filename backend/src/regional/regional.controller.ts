import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { RegionalService } from './regional.service'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { UpdateScheduleSchema } from './regional.schema'

@ApiTags('regional')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
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
