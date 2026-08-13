import { Module } from '@nestjs/common'
import { EmergencyChannelController } from './emergency-channel.controller'
import { EmergencyChannelService } from './emergency-channel.service'

@Module({
  controllers: [EmergencyChannelController],
  providers: [EmergencyChannelService],
  exports: [EmergencyChannelService],
})
export class EmergencyChannelModule {}
