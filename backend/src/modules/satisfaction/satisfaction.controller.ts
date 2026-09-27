/**
 * [G005 W12-PatientService] 满意度分析控制器
 */
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { SatisfactionService, type Sentiment, type SurveyStatus, type SurveyType } from './satisfaction.service'

const QuestionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  type: z.enum(['rating', 'nps', 'text']),
  max: z.number().optional(),
})

const CreateSurveySchema = z.object({
  title: z.string().min(1),
  type: z.enum(['APPOINTMENT', 'EXAM', 'REPORT', 'GENERAL']).optional(),
  department: z.string().optional(),
  modality: z.string().optional(),
  questions: z.array(QuestionSchema).optional(),
  status: z.enum(['OPEN', 'CLOSED']).optional(),
})

const RespondSchema = z.object({
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  answers: z.array(z.object({ questionId: z.string(), value: z.union([z.string(), z.number()]) })).optional(),
  rating: z.number().min(1).max(5).optional(),
  npsScore: z.number().min(0).max(10).optional(),
  comment: z.string().max(2000).optional(),
})

@ApiTags('satisfaction')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN', 'NURSE')
@Controller('satisfaction')
export class SatisfactionController {
  constructor(private readonly service: SatisfactionService) {}

  @Get('surveys')
  listSurveys(
    @Query('department') department?: string,
    @Query('status') status?: SurveyStatus,
    @Query('type') type?: SurveyType,
  ) {
    return this.service.listSurveys({ department, status, type })
  }

  @Post('surveys')
  createSurvey(@Body(new ZodValidationPipe(CreateSurveySchema)) body: z.infer<typeof CreateSurveySchema>) {
    return this.service.createSurvey(body)
  }

  @Get('responses')
  listResponses(
    @Query('surveyId') surveyId?: string,
    @Query('department') department?: string,
    @Query('sentiment') sentiment?: Sentiment,
  ) {
    return this.service.listResponses({ surveyId, department, sentiment })
  }

  @Get('analytics')
  analytics(@Query('department') department?: string, @Query('modality') modality?: string) {
    return this.service.analytics({ department, modality })
  }

  @Get('surveys/:id')
  getSurvey(@Param('id') id: string) {
    return this.service.getSurvey(id)
  }

  @Post('surveys/:id/respond')
  @Public()
  respond(@Param('id') id: string, @Body(new ZodValidationPipe(RespondSchema)) body: z.infer<typeof RespondSchema>) {
    return this.service.respond(id, body)
  }
}
