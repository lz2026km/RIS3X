/**
 * [G005 W12-PatientService] 自助登记控制器
 */
import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { SelfRegistrationService } from './self-registration.service'

const IdentifySchema = z.object({
  idCard: z.string().optional(),
  phone: z.string().optional(),
  empiId: z.string().optional(),
  name: z.string().optional(),
})

const CheckInSchema = z.object({
  patientId: z.string().min(1),
  visitId: z.string().optional(),
  appointmentId: z.string().optional(),
})

const QuestionnaireSchema = z.object({
  patientId: z.string().min(1),
  allergies: z.array(z.string()).optional(),
  pregnant: z.boolean().optional(),
  fastingConfirmed: z.boolean().optional(),
  implants: z.array(z.string()).optional(),
  contrastHistory: z.boolean().optional(),
  claustrophobia: z.boolean().optional(),
  answers: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
})

const ConsentSchema = z.object({
  patientId: z.string().min(1),
  visitId: z.string().optional(),
  consentType: z.string().optional(),
  procedure: z.string().optional(),
  agreed: z.boolean().optional(),
  signedBy: z.string().optional(),
  witnessName: z.string().optional(),
  signature: z.string().optional(),
})

const QueueSchema = z.object({
  patientId: z.string().min(1),
  visitId: z.string().optional(),
  modality: z.string().optional(),
  priority: z.enum(['NORMAL', 'URGENT', 'EMERGENCY']).optional(),
})

@ApiTags('self-registration')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN', 'NURSE')
@Controller('self-registration')
export class SelfRegistrationController {
  constructor(private readonly service: SelfRegistrationService) {}

  @Post('identify')
  @Public()
  identify(@Body(new ZodValidationPipe(IdentifySchema)) body: z.infer<typeof IdentifySchema>) {
    return this.service.identify(body)
  }

  @Post('check-in')
  @Public()
  checkIn(@Body(new ZodValidationPipe(CheckInSchema)) body: z.infer<typeof CheckInSchema>) {
    return this.service.checkIn(body)
  }

  @Post('questionnaire')
  @Public()
  questionnaire(@Body(new ZodValidationPipe(QuestionnaireSchema)) body: z.infer<typeof QuestionnaireSchema>) {
    return this.service.submitQuestionnaire(body)
  }

  @Get('questionnaire/:patientId')
  getQuestionnaire(@Param('patientId') patientId: string) {
    return this.service.getQuestionnaire(patientId)
  }

  @Post('consent')
  @Public()
  consent(@Body(new ZodValidationPipe(ConsentSchema)) body: z.infer<typeof ConsentSchema>) {
    return this.service.signConsent(body)
  }

  @Get('consent/:patientId')
  listConsents(@Param('patientId') patientId: string) {
    return { items: this.service.listConsents(patientId), total: this.service.listConsents(patientId).length }
  }

  @Post('queue-number')
  @Public()
  queueNumber(@Body(new ZodValidationPipe(QueueSchema)) body: z.infer<typeof QueueSchema>) {
    return this.service.issueQueueNumber(body)
  }

  @Get('queue/:modality')
  listQueue(@Param('modality') modality: string) {
    return { items: this.service.listQueue(modality), total: this.service.listQueue(modality).length }
  }

  @Get('status/:patientId')
  status(@Param('patientId') patientId: string) {
    return this.service.status(patientId)
  }
}
