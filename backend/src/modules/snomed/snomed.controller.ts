import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { SnomedService } from './snomed.service'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'

const EncodeSchema = z.object({ text: z.string().min(1).max(100_000), modality: z.string().optional() })

@ApiTags('snomed')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('snomed')
export class SnomedController {
  constructor(private readonly svc: SnomedService) {}

  @Post('encode')
  encode(@Body(new ZodValidationPipe(EncodeSchema)) body: { text: string; modality?: string }) {
    return this.svc.encode(body.text, body.modality)
  }

  // [v3.0.6.11-103 Wave 17] 自动编码: 报告文本 → 诊断词 → SNOMED CT + ICD-10 建议
  @Post('auto-encode')
  autoEncode(@Body(new ZodValidationPipe(EncodeSchema)) body: { text: string }) {
    return this.svc.autoEncode(body.text)
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.svc.search(q)
  }
}
