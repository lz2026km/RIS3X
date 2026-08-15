import { Module } from '@nestjs/common'
import { AiDraftController } from './ai-draft.controller'
import { AiDraftService } from './ai-draft.service'
import { ReportDraftController } from './report-draft.controller'
import { ReportDraftService } from './report-draft.service'
import { AiDraftAdvancedController } from './ai-draft-advanced.controller'
import { LlmProviderService } from './llm-provider'

@Module({
  controllers: [AiDraftController, ReportDraftController, AiDraftAdvancedController],
  providers: [AiDraftService, ReportDraftService, LlmProviderService],
  exports: [AiDraftService, ReportDraftService],
})
export class AiDraftModule {}
