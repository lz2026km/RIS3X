import { Module } from '@nestjs/common'
import { FollowUpController, FollowUpTemplateController, FollowUpTriggerRulesController } from './followup.controller'
import { FollowUpService } from './followup.service'

@Module({
  controllers: [FollowUpController, FollowUpTemplateController, FollowUpTriggerRulesController],
  providers: [FollowUpService],
  exports: [FollowUpService],
})
export class FollowUpModule {}
