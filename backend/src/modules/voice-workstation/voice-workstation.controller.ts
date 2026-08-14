// [Wave 6A v3.0.6.11-99] 语音工作站控制器: 医学词库 CRUD/检索 + 听写流校正 + 纠正反馈 + 会话/统计
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import {
  LEXICON_CATEGORIES,
  VoiceWorkstationService,
  type CorrectionFeedbackDto,
  type CreateLexiconDto,
  type LexiconCategory,
  type TranscribeWorkstationRequest,
  type UpdateLexiconDto,
} from './voice-workstation.service'

const CreateLexiconSchema = z.object({
  term: z.string().min(1).max(64),
  category: z.enum(LEXICON_CATEGORIES as [LexiconCategory, ...LexiconCategory[]]),
  priority: z.number().int().min(0).max(10).optional(),
  aliases: z.array(z.string().max(64)).max(20).optional(),
})

const UpdateLexiconSchema = z.object({
  term: z.string().min(1).max(64).optional(),
  category: z.enum(LEXICON_CATEGORIES as [LexiconCategory, ...LexiconCategory[]]).optional(),
  priority: z.number().int().min(0).max(10).optional(),
  aliases: z.array(z.string().max(64)).max(20).optional(),
})

const TranscribeSchema = z.object({
  audioBase64: z.string().max(70_000_000).optional(),
  text: z.string().max(20_000).optional(),
  reportId: z.string().max(64).optional(),
  duration: z.number().nonnegative().max(7200).optional(),
  doctorId: z.string().max(64).optional(),
  lang: z.string().min(1).max(16).optional(),
  mimeType: z.string().min(1).max(128).optional(),
})

const CorrectionSchema = z.object({
  original: z.string().min(1).max(200),
  corrected: z.string().min(1).max(200),
})

@ApiTags('voice-workstation')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('voice-workstation')
export class VoiceWorkstationController {
  constructor(private readonly service: VoiceWorkstationService) {}

  /** 医学词库列表 */
  @Get('lexicon')
  listLexicon() {
    return this.service.listLexicon()
  }

  /** 词库检索 (?q= 术语/别名/分类) */
  @Get('lexicon/search')
  searchLexicon(@Query('q') q?: string) {
    return this.service.searchLexicon(q ?? '')
  }

  /** 新增词条 */
  @Post('lexicon')
  createLexicon(@Body(new ZodValidationPipe(CreateLexiconSchema)) body: CreateLexiconDto) {
    return this.service.createLexicon(body)
  }

  /** 更新词条 */
  @Patch('lexicon/:id')
  updateLexicon(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateLexiconSchema)) body: UpdateLexiconDto,
  ) {
    return this.service.updateLexicon(id, body)
  }

  /** 删除词条 */
  @Delete('lexicon/:id')
  deleteLexicon(@Param('id') id: string) {
    return this.service.deleteLexicon(id)
  }

  /** 听写会话列表 (从 asr 记录派生) */
  @Get('sessions')
  listSessions() {
    return this.service.listSessions()
  }

  /** 转写 + 词库校正 (audioBase64 或 text) */
  @Post('transcribe')
  transcribe(@Body(new ZodValidationPipe(TranscribeSchema)) body: TranscribeWorkstationRequest) {
    return this.service.transcribe(body)
  }

  /** 提交纠正反馈 (积累词库) */
  @Post('corrections')
  submitCorrection(@Body(new ZodValidationPipe(CorrectionSchema)) body: CorrectionFeedbackDto) {
    return this.service.submitCorrection(body)
  }

  /** 纠正反馈列表 */
  @Get('corrections')
  listCorrections() {
    return this.service.listCorrections()
  }

  /** 统计: 会话数 / 平均时长 / 词库规模 / 纠正数 */
  @Get('stats')
  getStats() {
    return this.service.getStats()
  }
}
