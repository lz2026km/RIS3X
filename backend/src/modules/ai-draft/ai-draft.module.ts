import { Module } from '@nestjs/common'
import { AiDraftController } from './ai-draft.controller'
import { AiDraftService } from './ai-draft.service'
import { ReportDraftController } from './report-draft.controller'
import { ReportDraftService } from './report-draft.service'

@Module({
  controllers: [AiDraftController, ReportDraftController],
  providers: [AiDraftService, ReportDraftService],
  exports: [AiDraftService, ReportDraftService],
})
export class AiDraftModule {}
