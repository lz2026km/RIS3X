import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger'
import { AsrService, type DictationHotwordInput, type StartDictationDto } from './asr.service'
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

// [v3.0.6.11-103 Wave 17] 听写会话 V2: start/append/end + 术语库 CRUD
const StartDictationSchema = z.object({
  reportId: z.string().max(128).optional(),
  doctorId: z.string().max(64).optional(),
  lang: z.string().max(16).optional(),
})
const AppendDictationSchema = z.object({ text: z.string().max(20_000) })
const HotwordCreateSchema = z.object({
  term: z.string().min(1).max(64),
  category: z.enum(['解剖', '影像', '疾病', '单位', '操作']).optional(),
  priority: z.number().int().min(0).max(10).optional(),
})
const HotwordUpdateSchema = z.object({
  term: z.string().min(1).max(64).optional(),
  category: z.enum(['解剖', '影像', '疾病', '单位', '操作']).optional(),
  priority: z.number().int().min(0).max(10).optional(),
})

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

  // ── [v3.0.6.11-103 Wave 17] 听写会话 V2 ──────────────────────────────────

  @Post('dictation/session')
  startDictation(@Body(new ZodValidationPipe(StartDictationSchema)) body: StartDictationDto) {
    return this.svc.startDictationSession(body)
  }

  @Get('dictation/session/:id')
  getDictation(@Param('id') id: string) {
    return this.svc.getDictationSession(id)
  }

  @Post('dictation/session/:id/append')
  appendDictation(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AppendDictationSchema)) body: { text: string },
  ) {
    return this.svc.appendDictationChunk(id, body.text)
  }

  @Post('dictation/session/:id/end')
  endDictation(@Param('id') id: string) {
    return this.svc.endDictationSession(id)
  }

  @Get('dictation/hotwords')
  listHotwords() {
    return this.svc.listDictationHotwords()
  }

  @Post('dictation/hotwords')
  createHotword(@Body(new ZodValidationPipe(HotwordCreateSchema)) body: DictationHotwordInput) {
    return this.svc.createDictationHotword(body)
  }

  @Patch('dictation/hotwords/:id')
  updateHotword(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(HotwordUpdateSchema)) body: Partial<DictationHotwordInput>,
  ) {
    return this.svc.updateDictationHotword(id, body)
  }

  @Delete('dictation/hotwords/:id')
  deleteHotword(@Param('id') id: string) {
    return this.svc.deleteDictationHotword(id)
  }
}
