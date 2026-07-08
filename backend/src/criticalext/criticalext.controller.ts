import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Critical-extService } from './critical-ext.service';
@ApiTags('critical-ext')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/critical-ext')
export class Critical-extController {
  constructor(private readonly svc: Critical-extService) {}
  @Get('rules')
  listCriticalRules(@Param('id') id: string) {
    return this.svc.listCriticalRules(id);
  }

  @Post('rules')
  createCriticalRule(@Body() body: any) {
    return this.svc.createCriticalRule(body);
  }

  @Put('rules/:id')
  updateCriticalRule(@Param('id') id: string, @Body() body: any) {
    return this.svc.updateCriticalRule(id, body);
  }

  @Delete('rules/:id')
  deleteCriticalRule(@Param('id') id: string) {
    return this.svc.deleteCriticalRule(id);
  }

  @Get('stats')
  getCriticalStats(@Param('id') id: string) {
    return this.svc.getCriticalStats(id);
  }

  @Get('stats/summary')
  getCriticalSummary(@Param('id') id: string) {
    return this.svc.getCriticalSummary(id);
  }

  @Get('stats/timeline')
  getCriticalTimeline(@Param('id') id: string) {
    return this.svc.getCriticalTimeline(id);
  }

  @Get('center')
  listCriticalCenter(@Param('id') id: string) {
    return this.svc.listCriticalCenter(id);
  }

  @Get('center/:id')
  getCriticalCenterItem(@Param('id') id: string) {
    return this.svc.getCriticalCenterItem(id);
  }

  @Post('auto-detect')
  autoDetectCritical(@Body() body: any) {
    return this.svc.autoDetectCritical(body);
  }

  @Post('close-loop')
  closeCriticalLoop(@Body() body: any) {
    return this.svc.closeCriticalLoop(body);
  }

  @Get('receiver')
  getReceiverPortal(@Param('id') id: string) {
    return this.svc.getReceiverPortal(id);
  }
}
