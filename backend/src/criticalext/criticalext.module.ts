import { Module } from '@nestjs/common'
import { CriticalExtController } from './criticalext.controller'
import { CriticalExtService } from './criticalext.service'

@Module({
  controllers: [CriticalExtController],
  providers: [CriticalExtService],
  exports: [CriticalExtService],
})
export class CriticalExtModule {}
