import { Module } from '@nestjs/common'
import { QcExtController } from './qcext.controller'
import { QcExtService } from './qcext.service'

@Module({
  controllers: [QcExtController],
  providers: [QcExtService],
  exports: [QcExtService],
})
export class QcExtModule {}
