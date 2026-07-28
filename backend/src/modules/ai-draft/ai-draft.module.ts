import { Module } from '@nestjs/common'
import { AiDraftController } from './ai-draft.controller'
import { AiDraftService } from './ai-draft.service'

@Module({
  controllers: [AiDraftController],
  providers: [AiDraftService],
  exports: [AiDraftService],
})
export class AiDraftModule {}
