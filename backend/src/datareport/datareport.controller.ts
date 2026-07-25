import { Controller, Get, HttpCode, HttpStatus, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DataReportService } from './datareport.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CreateDataReportSchema, CreateNationalReportSchema } from './datareport.schema';
@ApiTags('data-report')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('api/data-report')
export class DataReportController {
  constructor(private readonly svc: DataReportService) {}
  @Get('national-reports')
  listNationalReports() {
    return this.svc.listNationalReports();
  }

  @Get('national-reports/:id')
  getNationalReport(@Param('id') id: string) {
    return this.svc.getNationalReport(id);
  }

  @Post('national-reports')
  @HttpCode(HttpStatus.CREATED)
  createNationalReport(@Body(new ZodValidationPipe(CreateNationalReportSchema)) body: Record<string, unknown>) {
    return this.svc.createNationalReport(body);
  }

  @Get('data-reports')
  listDataReports() {
    return this.svc.listDataReports();
  }

  @Get('data-reports/:id')
  getDataReport(@Param('id') id: string) {
    return this.svc.getDataReport(id);
  }

  @Post('data-reports')
  @HttpCode(HttpStatus.CREATED)
  createDataReport(@Body(new ZodValidationPipe(CreateDataReportSchema)) body: Record<string, unknown>) {
    return this.svc.createDataReport(body);
  }

  @Get('insurance-audits')
  listInsuranceAudits() {
    return this.svc.listInsuranceAudits();
  }

  @Get('insurance-audits/:id')
  getInsuranceAudit(@Param('id') id: string) {
    return this.svc.getInsuranceAudit(id);
  }

  @Get('enterprise-search')
  enterpriseSearch(@Query('q') q: string) {
    return this.svc.enterpriseSearch(q);
  }
}
