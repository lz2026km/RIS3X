import { Module } from '@nestjs/common'
import { FollowUpController, FollowUpTemplateController } from './followup.controller'
import { FollowUpService } from './followup.service'

@Module({
  controllers: [FollowUpController, FollowUpTemplateController],
  providers: [FollowUpService],
  exports: [FollowUpService],
})
export class FollowUpModule {}
