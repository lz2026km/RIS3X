import { Module } from '@nestjs/common'
import { CrossModalController } from './cross-modal.controller'
import { CrossModalService } from './cross-modal.service'

@Module({
  controllers: [CrossModalController],
  providers: [CrossModalService],
  exports: [CrossModalService],
})
export class CrossModalModule {}
