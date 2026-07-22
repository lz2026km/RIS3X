import { Module } from '@nestjs/common'
import { RadiomicsController } from './radiomics.controller'
import { RadiomicsService } from './radiomics.service'

@Module({
  controllers: [RadiomicsController],
  providers: [RadiomicsService],
  exports: [RadiomicsService],
})
export class RadiomicsModule {}
