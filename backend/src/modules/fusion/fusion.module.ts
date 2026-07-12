import { Module } from '@nestjs/common'
import { FusionController } from './fusion.controller'
import { FusionService } from './fusion.service'

@Module({
  controllers: [FusionController],
  providers: [FusionService],
  exports: [FusionService],
})
export class FusionModule {}
