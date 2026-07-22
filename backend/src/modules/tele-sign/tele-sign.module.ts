import { Module } from '@nestjs/common'
import { TeleSignController } from './tele-sign.controller'
import { TeleSignService } from './tele-sign.service'

@Module({
  controllers: [TeleSignController],
  providers: [TeleSignService],
  exports: [TeleSignService],
})
export class TeleSignModule {}
