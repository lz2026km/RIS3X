import { Module } from '@nestjs/common'
import { SnomedController } from './snomed.controller'
import { SnomedService } from './snomed.service'

@Module({
  controllers: [SnomedController],
  providers: [SnomedService],
  exports: [SnomedService],
})
export class SnomedModule {}
