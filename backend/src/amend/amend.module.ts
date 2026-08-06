import { Module } from '@nestjs/common'
import { AmendController } from './amend.controller'
import { AmendService } from './amend.service'

@Module({
  controllers: [AmendController],
  providers: [AmendService],
  exports: [AmendService],
})
export class AmendModule {}
