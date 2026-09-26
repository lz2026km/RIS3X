import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { TriageService, type TriageExamInput } from './triage.service'

// [G005 W6] 生命体征 (BP/HR/Temp/SpO2/RR)
const VitalsSchema = z.object({
  systolicBp: z.number().min(0).max(400).optional(),
  diastolicBp: z.number().min(0).max(300).optional(),
  heartRate: z.number().min(0).max(400).optional(),
  temperature: z.number().min(25).max(45).optional(),
  spo2: z.number().min(0).max(100).optional(),
  respiratoryRate: z.number().min(0).max(80).optional(),
}).optional()

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
  vitals: VitalsSchema,
  nurseId: z.string().optional(),
  nurseName: z.string().optional(),
})

const NurseSchema = z.object({
  examId: z.string().min(1),
  nurseId: z.string().min(1),
  nurseName: z.string().optional(),
})

const UpdateSchema = z.object({
  assignedDoctor: z.string().optional(),
  status: z.enum(['PENDING', 'ASSIGNED', 'COMPLETED']).optional(),
})

const BatchScoreSchema = z.object({
  items: z.array(ScoreAssignSchema).min(1).max(100),
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

  // [G005 Wave1A] aiTriageApi.batchScore → /triage/batch-score
  @Post('batch-score')
  batchScore(@Body(new ZodValidationPipe(BatchScoreSchema)) body: { items: TriageExamInput[] }) {
    return this.service.batchScore(body.items)
  }

  @Post('assign')
  assign(@Body(new ZodValidationPipe(ScoreAssignSchema)) body: TriageExamInput) {
    return this.service.assign(body)
  }

  // [G005 W6] 复评: 重采生命体征重算 ESI/评分 (vitals 越界 → reTriageRecommended)
  @Post('re-triage')
  reTriage(@Body(new ZodValidationPipe(ScoreAssignSchema)) body: TriageExamInput) {
    return this.service.reTriage(body)
  }

  // [G005 W6] 分诊护士指派
  @Post('nurse')
  assignNurse(@Body(new ZodValidationPipe(NurseSchema)) body: z.infer<typeof NurseSchema>) {
    return this.service.assignNurse(body.examId, body.nurseId, body.nurseName)
  }

  @Get('pending')
  getPending() {
    return this.service.getPending()
  }

  // [G005 Wave1A] aiTriageApi.getStats → /triage/stats
  @Get('stats')
  getStats() {
    return this.service.getStats()
  }

  @Put(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateSchema)) body: { assignedDoctor?: string; status?: 'PENDING' | 'ASSIGNED' | 'COMPLETED' }) {
    return this.service.update(id, body)
  }
}
