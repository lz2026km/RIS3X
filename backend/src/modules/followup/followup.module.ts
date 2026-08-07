import { Module } from '@nestjs/common'
import { FollowUpController } from './followup.controller'
import { FollowUpService } from './followup.service'

@Module({
  controllers: [FollowUpController],
  providers: [FollowUpService],
  exports: [FollowUpService],
})
export class FollowUpModule {}
