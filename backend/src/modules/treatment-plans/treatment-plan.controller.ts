import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { TreatmentPlanService, type PlanStatus, type TreatmentPlanInput } from './treatment-plan.service'

const CreatePlanSchema = z.object({
  patientId: z.string().optional(),
  patient: z.string().optional(),
  type: z.string().optional(),
  department: z.string().or(z.array(z.string())).optional(),
  startDate: z.string().optional(),
  desc: z.string().optional(),
  outcome: z.string().optional(),
  timeline: z.array(z.object({ step: z.string(), date: z.string(), status: z.string() })).optional(),
})

const UpdatePlanSchema = CreatePlanSchema.partial()
const TransitionSchema = z.object({ status: z.enum(['planned', 'in_progress', 'completed', 'pending']) })

@ApiTags('treatment-plans')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN', 'NURSE')
@Controller('treatment-plans')
export class TreatmentPlanController {
  constructor(private readonly service: TreatmentPlanService) {}

  @Get()
  @ApiOperation({ summary: 'Cross-department treatment plan list' })
  list() {
    return this.service.list()
  }

  @Post()
  @ApiOperation({ summary: 'Create treatment plan' })
  create(@Body(new ZodValidationPipe(CreatePlanSchema)) body: TreatmentPlanInput) {
    return this.service.create(body)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update treatment plan' })
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdatePlanSchema)) body: TreatmentPlanInput) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete treatment plan' })
  remove(@Param('id') id: string) {
    this.service.remove(id)
    return { id, deleted: true }
  }

  @Post(':id/transition')
  @ApiOperation({ summary: 'Transition treatment plan status' })
  transition(@Param('id') id: string, @Body(new ZodValidationPipe(TransitionSchema)) body: { status: PlanStatus }) {
    return this.service.transition(id, body.status)
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Treatment plan timeline' })
  getTimeline(@Param('id') id: string) {
    return this.service.getTimeline(id)
  }
}
