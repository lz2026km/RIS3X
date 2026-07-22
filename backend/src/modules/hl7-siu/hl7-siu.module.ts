import { Module } from '@nestjs/common'
import { Hl7SiuController } from './hl7-siu.controller'
import { Hl7SiuService } from './hl7-siu.service'

@Module({
  controllers: [Hl7SiuController],
  providers: [Hl7SiuService],
  exports: [Hl7SiuService],
})
export class Hl7SiuModule {}
