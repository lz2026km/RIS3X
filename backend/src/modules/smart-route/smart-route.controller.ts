import { Body, Controller, Get, Post, Put } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { SmartRouteService } from './smart-route.service'
import type { RoutingRule } from './smart-route.service'

const AssignSchema = z.object({
  studyId: z.string().min(1),
  patientName: z.string().min(1),
  modality: z.string().min(1),
  bodyPart: z.string().min(1),
  patientStatus: z.string().min(1),
})

const RoutingRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  modality: z.string().min(1),
  bodyPart: z.string().min(1),
  patientStatus: z.string().min(1),
  maxLoad: z.number().int().nonnegative(),
  priority: z.number().int(),
  enabled: z.boolean(),
})
const UpdateRulesSchema = z.object({ rules: z.array(RoutingRuleSchema) })

@ApiTags('smart-route')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('smart-route')
export class SmartRouteController {
  constructor(private readonly service: SmartRouteService) {}

  @Post('assign')
  assign(@Body(new ZodValidationPipe(AssignSchema)) body: z.infer<typeof AssignSchema>) {
    return this.service.assign(body.studyId, body.patientName, body.modality, body.bodyPart, body.patientStatus)
  }

  @Get('rules')
  getRules() {
    return this.service.getRules()
  }

  @Get('qualifications')
  getQualifications() {
    return this.service.getQualifications()
  }

  @Put('rules')
  updateRules(@Body(new ZodValidationPipe(UpdateRulesSchema)) body: { rules: RoutingRule[] }) {
    return this.service.updateRules(body.rules)
  }

  @Get('history')
  getHistory() {
    return this.service.getHistory()
  }

  @Get('stats')
  stats() {
    return this.service.stats()
  }
}
