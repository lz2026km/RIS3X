import { Body, Controller, Post } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { AsrService } from './asr.service'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'

const TranscribeSchema = z.object({ audioBase64: z.string().max(70_000_000).optional(), duration: z.number().nonnegative().max(7200).optional() }).refine((value) => value.audioBase64 !== undefined, { message: 'audioBase64 is required' })
const FeedbackSchema = z.object({ transcriptionId: z.string().min(1), correctedText: z.string(), originalText: z.string() })

@ApiTags('asr')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('asr')
export class AsrController {
  constructor(private readonly svc: AsrService) {}

  @Post('transcribe')
  transcribe(@Body(new ZodValidationPipe(TranscribeSchema)) body: { audioBase64?: string; duration?: number }) {
    return this.svc.transcribe(body)
  }

  @Post('feedback')
  feedback(@Body(new ZodValidationPipe(FeedbackSchema)) body: { transcriptionId: string; correctedText: string; originalText: string }) {
    return this.svc.feedback(body)
  }
}
