import { Body, Controller, Get, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { TeleSignService } from './tele-sign.service'

const CreateSessionSchema = z.object({
  reportId: z.string().min(1),
  reportTitle: z.string().min(1),
  patientName: z.string().min(1),
  signerId: z.string().min(1),
  signerName: z.string().min(1),
})

const ApproveSchema = z.object({
  id: z.string().min(1),
  signatureData: z.string().min(1),
  comment: z.string().optional(),
})

const RejectSchema = z.object({
  id: z.string().min(1),
  comment: z.string().min(1),
})

@ApiTags('tele-sign')
@ApiBearerAuth()
@Controller('tele-sign')
export class TeleSignController {
  constructor(private readonly service: TeleSignService) {}

  @Post('session')
  create(@Body(new ZodValidationPipe(CreateSessionSchema)) body: z.infer<typeof CreateSessionSchema>) {
    return this.service.create(body.reportId, body.reportTitle, body.patientName, body.signerId, body.signerName)
  }

  @Post('approve')
  approve(@Body(new ZodValidationPipe(ApproveSchema)) body: z.infer<typeof ApproveSchema>) {
    return this.service.approve(body.id, body.signatureData, body.comment)
  }

  @Post('reject')
  reject(@Body(new ZodValidationPipe(RejectSchema)) body: z.infer<typeof RejectSchema>) {
    return this.service.reject(body.id, body.comment)
  }

  @Get('sessions')
  list() {
    return this.service.list()
  }
}
