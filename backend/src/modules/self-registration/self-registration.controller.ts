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

// [G005 v3.0.6.16-0] 领取凭证: 至少要有一个可识别标识
const VoucherSchema = z
  .object({
    patientId: z.string().optional(),
    patientName: z.string().optional(),
    idCard: z.string().optional(),
    phone: z.string().optional(),
  })
  .refine(
    (v) => Boolean(v.patientId?.trim() || v.patientName?.trim() || v.idCard?.trim() || v.phone?.trim()),
    { message: '需至少提供 patientId / idCard / phone / patientName 之一' },
  )

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

  // [G005 v3.0.6.16-0] 自助影像/报告领取凭证
  // 此前该端点仅存在于 MSW (mock-only), real 模式 404 —— 患者端核心动线断裂。
  @Post('voucher')
  @Public()
  issueVoucher(@Body(new ZodValidationPipe(VoucherSchema)) body: z.infer<typeof VoucherSchema>) {
    return this.service.issueVoucher(body)
  }

  @Get('voucher/:code')
  getVoucher(@Param('code') code: string) {
    const voucher = this.service.getVoucherByCode(code)
    return voucher ?? { found: false }
  }

  @Get('status/:patientId')
  status(@Param('patientId') patientId: string) {
    return this.service.status(patientId)
  }
}
