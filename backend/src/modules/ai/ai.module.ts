import { Module } from '@nestjs/common'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'
import { AiDraftService } from './ai-draft.service'

@Module({
  controllers: [AiController],
  providers: [AiService, AiDraftService],
  exports: [AiService, AiDraftService],
})
export class AiModule {}
