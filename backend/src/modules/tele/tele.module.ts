import { Module } from '@nestjs/common'
import { TeleController } from './tele.controller'
import { TeleService } from './tele.service'

@Module({
  controllers: [TeleController],
  providers: [TeleService],
  exports: [TeleService],
})
export class TeleModule {}
