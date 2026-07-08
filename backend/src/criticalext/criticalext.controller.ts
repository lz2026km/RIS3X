import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CriticalExtService } from './criticalext.service'

@ApiTags('critical-ext')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('critical-ext')
export class CriticalExtController {
  constructor(private readonly svc: CriticalExtService) {}

  @Get('rules')
  listCriticalRules() { return this.svc.listCriticalRules() }

  @Post('rules')
  createCriticalRule(@Body() body: any) { return this.svc.createCriticalRule(body) }

  @Put('rules/:id')
  updateCriticalRule(@Param('id') id: string, @Body() body: any) { return this.svc.updateCriticalRule(id, body) }

  @Delete('rules/:id')
  deleteCriticalRule(@Param('id') id: string) { return this.svc.deleteCriticalRule(id) }

  @Get('stats')
  getCriticalStats() { return this.svc.getCriticalStats() }

  @Get('stats/summary')
  getCriticalSummary() { return this.svc.getCriticalSummary() }

  @Get('stats/timeline')
  getCriticalTimeline() { return this.svc.getCriticalTimeline() }

  @Get('center')
  listCriticalCenter() { return this.svc.listCriticalCenter() }

  @Get('center/:id')
  getCriticalCenterItem(@Param('id') id: string) { return this.svc.getCriticalCenterItem(id) }

  @Post('auto-detect')
  autoDetectCritical(@Body() body: any) { return this.svc.autoDetectCritical(body) }

  @Post('close-loop')
  closeCriticalLoop(@Body() body: any) { return this.svc.closeCriticalLoop(body) }

  @Get('receiver')
  getReceiverPortal() { return this.svc.getReceiverPortal() }
}
