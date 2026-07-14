import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { TriageService, type TriageExamInput } from './triage.service'

const ScoreAssignSchema = z.object({
  examId: z.string().min(1),
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  examType: z.string().min(1),
  symptoms: z.string().optional(),
  referringDept: z.string().optional(),
  referringDoctorLevel: z.string().optional(),
  patientAge: z.number().int().optional(),
  gender: z.string().optional(),
})

const UpdateSchema = z.object({
  assignedDoctor: z.string().optional(),
  status: z.enum(['PENDING', 'ASSIGNED', 'COMPLETED']).optional(),
})

@ApiTags('triage')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('triage')
export class TriageController {
  constructor(private readonly service: TriageService) {}

  @Post('score')
  score(@Body(new ZodValidationPipe(ScoreAssignSchema)) body: TriageExamInput) {
    return this.service.score(body)
  }

  @Post('assign')
  assign(@Body(new ZodValidationPipe(ScoreAssignSchema)) body: TriageExamInput) {
    return this.service.assign(body)
  }

  @Get('pending')
  getPending() {
    return this.service.getPending()
  }

  @Put(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateSchema)) body: { assignedDoctor?: string; status?: 'PENDING' | 'ASSIGNED' | 'COMPLETED' }) {
    return this.service.update(id, body)
  }
}
