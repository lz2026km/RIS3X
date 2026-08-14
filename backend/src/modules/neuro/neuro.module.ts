import { Module } from '@nestjs/common'
import { NeuroController } from './neuro.controller'
import { NeuroService } from './neuro.service'

@Module({
  controllers: [NeuroController],
  providers: [NeuroService],
})
export class NeuroModule {}
