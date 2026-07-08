import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Data-reportService } from './data-report.service';
@ApiTags('data-report')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/data-report')
export class Data-reportController {
  constructor(private readonly svc: Data-reportService) {}
  @Get('national-reports')
  listNationalReports(@Param('id') id: string) {
    return this.svc.listNationalReports(id);
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
  listDataReports(@Param('id') id: string) {
    return this.svc.listDataReports(id);
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
  listInsuranceAudits(@Param('id') id: string) {
    return this.svc.listInsuranceAudits(id);
  }

  @Get('insurance-audits/:id')
  getInsuranceAudit(@Param('id') id: string) {
    return this.svc.getInsuranceAudit(id);
  }

  @Get('enterprise-search')
  enterpriseSearch(@Param('id') id: string) {
    return this.svc.enterpriseSearch(id);
  }
}
