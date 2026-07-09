import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CosignService } from './cosign.service'

@ApiTags('cosign')
@ApiBearerAuth()
@Controller('cosign')
export class CosignController {
  constructor(private readonly svc: CosignService) {}

  @Get('pending')
  listPendingCosigns() { return this.svc.listPendingCosigns() }

  @Get('pending/:id')
  getPendingCosign(@Param('id') id: string) { return this.svc.getPendingCosign(id) }

  @Post('pending/:id/approve')
  approveCosign(@Body() body: any) { return this.svc.approveCosign(body) }

  @Post('pending/:id/reject')
  rejectCosign(@Body() body: any) { return this.svc.rejectCosign(body) }

  @Get('history')
  listCosignHistory() { return this.svc.listCosignHistory() }

  @Get('rules')
  listCosignRules() { return this.svc.listCosignRules() }

  @Post('rules')
  createCosignRule(@Body() body: any) { return this.svc.createCosignRule(body) }

  @Get('stats')
  getCosignStats() { return this.svc.getCosignStats() }
}
