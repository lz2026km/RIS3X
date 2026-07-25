import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CosignService } from './cosign.service'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { ApproveCosignSchema, CreateCosignRuleSchema, RejectCosignSchema } from './cosign.schema'

@ApiTags('cosign')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('cosign')
export class CosignController {
  constructor(private readonly svc: CosignService) {}

  @Get('pending')
  listPendingCosigns() { return this.svc.listPendingCosigns() }

  @Get('pending/:id')
  getPendingCosign(@Param('id') id: string) { return this.svc.getPendingCosign(id) }

  @Post('pending/:id/approve')
  approveCosign(@Body(new ZodValidationPipe(ApproveCosignSchema)) body: Record<string, unknown>) { return this.svc.approveCosign(body) }

  @Post('pending/:id/reject')
  rejectCosign(@Body(new ZodValidationPipe(RejectCosignSchema)) body: Record<string, unknown>) { return this.svc.rejectCosign(body) }

  @Get('history')
  listCosignHistory() { return this.svc.listCosignHistory() }

  @Get('rules')
  listCosignRules() { return this.svc.listCosignRules() }

  @Post('rules')
  createCosignRule(@Body(new ZodValidationPipe(CreateCosignRuleSchema)) body: Record<string, unknown>) { return this.svc.createCosignRule(body) }

  @Get('stats')
  getCosignStats() { return this.svc.getCosignStats() }
}
