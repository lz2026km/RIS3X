import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ClinicalPathwayService } from './clinical-pathway.service'

const ToggleSchema = z.object({ status: z.enum(['active', 'paused']).optional() })
const EnrollSchema = z.object({ patientName: z.string().min(1), pathwayName: z.string().min(1) })

@ApiTags('clinical-pathways')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN', 'NURSE')
@Controller('clinical-pathways')
export class ClinicalPathwayController {
  constructor(private readonly service: ClinicalPathwayService) {}

  @Get()
  @ApiOperation({ summary: 'List clinical pathways (from WorkflowDefinition)' })
  listPathways() {
    return this.service.listPathways()
  }

  @Get('stats')
  @ApiOperation({ summary: 'Clinical pathway stats' })
  getStats() {
    return this.service.getStats()
  }

  @Get('patients')
  @ApiOperation({ summary: 'Pathway enrolled patients' })
  listPatients() {
    return this.service.listPatients()
  }

  @Get(':id/steps')
  @ApiOperation({ summary: 'Pathway steps for a patient' })
  getSteps(@Param('id') id: string) {
    return this.service.getSteps(id)
  }

  @Post(':id/toggle')
  @ApiOperation({ summary: 'Toggle pathway active/paused' })
  togglePathway(@Param('id') id: string, @Body(new ZodValidationPipe(ToggleSchema)) body: z.infer<typeof ToggleSchema>) {
    return this.service.togglePathway(id, body.status)
  }

  @Post('enroll')
  @ApiOperation({ summary: 'Enroll patient into a pathway' })
  enrollPatient(@Body(new ZodValidationPipe(EnrollSchema)) body: z.infer<typeof EnrollSchema>) {
    return this.service.enrollPatient(body)
  }
}
