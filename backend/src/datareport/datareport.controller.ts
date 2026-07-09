import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DataReportService } from './datareport.service';
@ApiTags('data-report')
@ApiBearerAuth()
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
  createNationalReport(@Body() body: any) {
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
  createDataReport(@Body() body: any) {
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
