import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Ai-platformService } from './ai-platform.service';
@ApiTags('ai-platform')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/ai-platform')
export class Ai-platformController {
  constructor(private readonly svc: Ai-platformService) {}
  @Get('models')
  listAiModels(@Param('id') id: string) {
    return this.svc.listAiModels(id);
  }

  @Get('models/:id')
  getAiModel(@Param('id') id: string) {
    return this.svc.getAiModel(id);
  }

  @Post('models/:id/deploy')
  deployAiModel(@Body() body: any) {
    return this.svc.deployAiModel(body);
  }

  @Get('qc')
  listAiQcResults(@Param('id') id: string) {
    return this.svc.listAiQcResults(id);
  }

  @Get('qc/:id')
  getAiQcResult(@Param('id') id: string) {
    return this.svc.getAiQcResult(id);
  }

  @Get('structured-reports')
  listAiStructuredReports(@Param('id') id: string) {
    return this.svc.listAiStructuredReports(id);
  }

  @Post('structured-reports')
  generateStructuredReport(@Body() body: any) {
    return this.svc.generateStructuredReport(body);
  }

  @Get('medical-devices')
  listAiMedicalDevices(@Param('id') id: string) {
    return this.svc.listAiMedicalDevices(id);
  }

  @Get('orchestration')
  getAiOrchestration(@Param('id') id: string) {
    return this.svc.getAiOrchestration(id);
  }

  @Post('orchestration')
  createAiOrchestration(@Body() body: any) {
    return this.svc.createAiOrchestration(body);
  }

  @Get('fusion')
  getAiFusionWorkspace(@Param('id') id: string) {
    return this.svc.getAiFusionWorkspace(id);
  }

  @Get('assist')
  getAiAssist(@Param('id') id: string) {
    return this.svc.getAiAssist(id);
  }

  @Get('marketplace')
  getAiMarketplace(@Param('id') id: string) {
    return this.svc.getAiMarketplace(id);
  }
}
