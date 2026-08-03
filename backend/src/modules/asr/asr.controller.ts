import { Body, Controller, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger'
import { AsrService } from './asr.service'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'

const TranscribeSchema = z
  .object({
    audioBase64: z.string().max(70_000_000).optional(),
    duration: z.number().nonnegative().max(7200).optional(),
    lang: z.string().min(1).max(16).optional(),
    mimeType: z.string().min(1).max(128).optional(),
  })
  .refine((value) => value.audioBase64 !== undefined, { message: 'audioBase64 is required' })
const FeedbackSchema = z.object({ transcriptionId: z.string().min(1), correctedText: z.string(), originalText: z.string() })

@ApiTags('asr')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('asr')
export class AsrController {
  constructor(private readonly svc: AsrService) {}

  @Post('transcribe')
  transcribe(@Body(new ZodValidationPipe(TranscribeSchema)) body: { audioBase64?: string; duration?: number; lang?: string; mimeType?: string }) {
    return this.svc.transcribe(body)
  }

  /** 音频直传:multipart/form-data 字段 audio (Blob), 可选 duration/lang 查询参数 */
  @Post('transcribe/audio')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { audio: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 50 * 1024 * 1024 } }))
  transcribeAudio(
    @UploadedFile() audio: { buffer?: Buffer; mimetype?: string; originalname?: string } | undefined,
    @Query('duration') duration?: string,
    @Query('lang') lang?: string,
  ) {
    const parsedDuration = duration !== undefined && duration !== '' ? Number(duration) : undefined
    return this.svc.transcribe({
      audioBuffer: audio?.buffer,
      duration: parsedDuration !== undefined && Number.isFinite(parsedDuration) ? parsedDuration : undefined,
      lang: lang?.trim() || undefined,
      mimeType: audio?.mimetype,
    })
  }

  @Post('feedback')
  feedback(@Body(new ZodValidationPipe(FeedbackSchema)) body: { transcriptionId: string; correctedText: string; originalText: string }) {
    return this.svc.feedback(body)
  }
}
