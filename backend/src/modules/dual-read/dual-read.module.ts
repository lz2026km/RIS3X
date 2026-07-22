import { Module } from '@nestjs/common'
import { DualReadController } from './dual-read.controller'
import { DualReadService } from './dual-read.service'

@Module({
  controllers: [DualReadController],
  providers: [DualReadService],
  exports: [DualReadService],
})
export class DualReadModule {}
