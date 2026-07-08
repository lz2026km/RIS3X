import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Qc-extService } from './qc-ext.service';
@ApiTags('qc-ext')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/qc-ext')
export class Qc-extController {
  constructor(private readonly svc: Qc-extService) {}
  @Get('dashboard')
  getQcDashboard(@Param('id') id: string) {
    return this.svc.getQcDashboard(id);
  }

  @Get('dashboard/:id')
  getQcDashboardItem(@Param('id') id: string) {
    return this.svc.getQcDashboardItem(id);
  }

  @Get('image')
  listQcImages(@Param('id') id: string) {
    return this.svc.listQcImages(id);
  }

  @Get('image/:id')
  getQcImage(@Param('id') id: string) {
    return this.svc.getQcImage(id);
  }

  @Post('image/:id/rate')
  rateQcImage(@Body() body: any) {
    return this.svc.rateQcImage(body);
  }

  @Get('radiologist-annual')
  listRadiologistAnnual(@Param('id') id: string) {
    return this.svc.listRadiologistAnnual(id);
  }

  @Get('radiologist-annual/:id')
  getRadiologistAnnual(@Param('id') id: string) {
    return this.svc.getRadiologistAnnual(id);
  }

  @Get('defect')
  listQcDefects(@Param('id') id: string) {
    return this.svc.listQcDefects(id);
  }

  @Post('defect')
  reportQcDefect(@Body() body: any) {
    return this.svc.reportQcDefect(body);
  }

  @Get('stats')
  getQcStats(@Param('id') id: string) {
    return this.svc.getQcStats(id);
  }

  @Get('scores')
  listQcScores(@Param('id') id: string) {
    return this.svc.listQcScores(id);
  }
}
