import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import {
  SafetyService,
  CreateAdverseEventDto,
  UpdateAdverseEventDto,
  CreateRcaDto,
  UpdateRcaDto,
  CreateRiskItemDto,
  UpdateRiskItemDto,
} from './safety.service'

const EventSeverityEnum = z.enum(['near-miss', 'minor', 'moderate', 'severe', 'catastrophic'])
const EventStatusEnum = z.enum(['reported', 'investigating', 'resolved', 'closed'])
const EventCategoryEnum = z.enum([
  'medication-error', 'patient-identification', 'contrast-reaction',
  'radiation-overdose', 'fall', 'specimen-error', 'communication-failure',
  'equipment-malfunction', 'information-loss', 'other',
])

const CapaStatusEnum = z.enum(['open', 'analyzing', 'capa-planned', 'implementing', 'verified', 'closed'])
const RiskCategoryEnum = z.enum(['clinical', 'operational', 'regulatory', 'financial', 'it-security'])
const RiskLevelEnum = z.enum(['very-low', 'low', 'medium', 'high', 'very-high'])
const RiskStatusEnum = z.enum(['identified', 'mitigating', 'monitoring', 'closed'])

export const CreateAdverseEventSchema = z.object({
  eventType: EventCategoryEnum,
  severity: EventSeverityEnum,
  status: EventStatusEnum.optional(),
  description: z.string().min(1),
  department: z.string().min(1),
  reportedBy: z.string().min(1),
  reportedAt: z.string().datetime().or(z.date()).optional(),
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  location: z.string().optional(),
  contributingFactors: z.array(z.string()).optional(),
  actionsTaken: z.array(z.string()).optional(),
  rootCauseIds: z.array(z.string()).optional(),
})

export const UpdateAdverseEventSchema = z.object({
  eventType: EventCategoryEnum.optional(),
  severity: EventSeverityEnum.optional(),
  status: EventStatusEnum.optional(),
  description: z.string().min(1).optional(),
  department: z.string().min(1).optional(),
  reportedBy: z.string().min(1).optional(),
  reportedAt: z.string().datetime().or(z.date()).optional(),
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  location: z.string().optional(),
  contributingFactors: z.array(z.string()).optional(),
  actionsTaken: z.array(z.string()).optional(),
  rootCauseIds: z.array(z.string()).optional(),
  resolvedAt: z.string().datetime().or(z.date()).optional(),
  resolvedBy: z.string().optional(),
  closedAt: z.string().datetime().or(z.date()).optional(),
  closedBy: z.string().optional(),
})

export const CreateRcaSchema = z.object({
  adverseEventId: z.string().min(1),
  eventTitle: z.string().min(1),
  description: z.string().optional(),
  dateOccurred: z.string().datetime().or(z.date()),
  teamMembers: z.array(z.string()).optional(),
  fishboneData: z.array(z.any()).optional(),
  fiveWhys: z.array(z.any()).optional(),
  rootCauses: z.array(z.string()).optional(),
  capaPlans: z.array(z.any()).optional(),
  capaStatus: CapaStatusEnum.optional(),
  conclusion: z.string().optional(),
  lessonsLearned: z.string().optional(),
})

export const UpdateRcaSchema = z.object({
  adverseEventId: z.string().min(1).optional(),
  eventTitle: z.string().min(1).optional(),
  description: z.string().optional(),
  dateOccurred: z.string().datetime().or(z.date()).optional(),
  teamMembers: z.array(z.string()).optional(),
  fishboneData: z.array(z.any()).optional(),
  fiveWhys: z.array(z.any()).optional(),
  rootCauses: z.array(z.string()).optional(),
  capaPlans: z.array(z.any()).optional(),
  capaStatus: CapaStatusEnum.optional(),
  conclusion: z.string().optional(),
  lessonsLearned: z.string().optional(),
  closedAt: z.string().datetime().or(z.date()).optional(),
  closedBy: z.string().optional(),
})

export const CreateRiskItemSchema = z.object({
  riskType: z.string().min(1),
  title: z.string().min(1),
  category: RiskCategoryEnum,
  description: z.string().min(1),
  likelihood: z.number().int().min(1).max(5),
  severity: z.number().int().min(1).max(5),
  rpn: z.number().int().nonnegative().optional(),
  riskLevel: RiskLevelEnum.optional(),
  status: RiskStatusEnum.optional(),
  identifiedBy: z.string().min(1),
  identifiedAt: z.string().datetime().or(z.date()).optional(),
  mitigationPlan: z.string().optional(),
  mitigationOwner: z.string().optional(),
  mitigationDeadline: z.string().optional(),
  residualRpn: z.number().int().nonnegative().optional(),
})

export const UpdateRiskItemSchema = z.object({
  riskType: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  category: RiskCategoryEnum.optional(),
  description: z.string().min(1).optional(),
  likelihood: z.number().int().min(1).max(5).optional(),
  severity: z.number().int().min(1).max(5).optional(),
  rpn: z.number().int().nonnegative().optional(),
  riskLevel: RiskLevelEnum.optional(),
  status: RiskStatusEnum.optional(),
  identifiedBy: z.string().min(1).optional(),
  identifiedAt: z.string().datetime().or(z.date()).optional(),
  mitigationPlan: z.string().optional(),
  mitigationOwner: z.string().optional(),
  mitigationDeadline: z.string().optional(),
  residualRpn: z.number().int().nonnegative().optional(),
  closedAt: z.string().datetime().or(z.date()).optional(),
  closedBy: z.string().optional(),
})

const IdParamSchema = z.string().min(1)

@ApiTags('safety')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('safety')
export class SafetyController {
  constructor(private readonly service: SafetyService) {}

  // 鈹€鈹€ AdverseEvent 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  @Post('adverse-events')
  createAdverseEvent(
    @Body(new ZodValidationPipe(CreateAdverseEventSchema)) body: CreateAdverseEventDto,
  ) {
    return this.service.createAdverseEvent(body)
  }

  @Get('adverse-events')
  getAdverseEvents(
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('eventType') eventType?: string,
  ) {
    return this.service.getAdverseEvents({ status, severity, eventType })
  }

  @Get('adverse-events/:id')
  getAdverseEvent(@Param('id') id: string) {
    const parsed = IdParamSchema.parse(id)
    return this.service.getAdverseEvent(parsed)
  }

  @Put('adverse-events/:id')
  updateAdverseEvent(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAdverseEventSchema)) body: UpdateAdverseEventDto,
  ) {
    const parsed = IdParamSchema.parse(id)
    return this.service.updateAdverseEvent(parsed, body)
  }

  @Delete('adverse-events/:id')
  deleteAdverseEvent(@Param('id') id: string) {
    const parsed = IdParamSchema.parse(id)
    return this.service.deleteAdverseEvent(parsed)
  }

  // 鈹€鈹€ RcaInvestigation 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  @Post('rca-investigations')
  createRcaInvestigation(
    @Body(new ZodValidationPipe(CreateRcaSchema)) body: CreateRcaDto,
  ) {
    return this.service.createRcaInvestigation(body)
  }

  @Get('rca-investigations')
  getRcaInvestigations(@Query('capaStatus') capaStatus?: string) {
    return this.service.getRcaInvestigations({ capaStatus })
  }

  @Get('rca-investigations/:id')
  getRcaInvestigation(@Param('id') id: string) {
    const parsed = IdParamSchema.parse(id)
    return this.service.getRcaInvestigation(parsed)
  }

  @Put('rca-investigations/:id')
  updateRcaInvestigation(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateRcaSchema)) body: UpdateRcaDto,
  ) {
    const parsed = IdParamSchema.parse(id)
    return this.service.updateRcaInvestigation(parsed, body)
  }

  @Delete('rca-investigations/:id')
  deleteRcaInvestigation(@Param('id') id: string) {
    const parsed = IdParamSchema.parse(id)
    return this.service.deleteRcaInvestigation(parsed)
  }

  // 鈹€鈹€ RiskItem 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  @Post('risk-items')
  createRiskItem(
    @Body(new ZodValidationPipe(CreateRiskItemSchema)) body: CreateRiskItemDto,
  ) {
    return this.service.createRiskItem(body)
  }

  @Get('risk-items')
  getRiskItems(
    @Query('riskLevel') riskLevel?: string,
    @Query('status') status?: string,
  ) {
    return this.service.getRiskItems({ riskLevel, status })
  }

  @Get('risk-items/:id')
  getRiskItem(@Param('id') id: string) {
    const parsed = IdParamSchema.parse(id)
    return this.service.getRiskItem(parsed)
  }

  @Put('risk-items/:id')
  updateRiskItem(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateRiskItemSchema)) body: UpdateRiskItemDto,
  ) {
    const parsed = IdParamSchema.parse(id)
    return this.service.updateRiskItem(parsed, body)
  }

  @Delete('risk-items/:id')
  deleteRiskItem(@Param('id') id: string) {
    const parsed = IdParamSchema.parse(id)
    return this.service.deleteRiskItem(parsed)
  }
}
