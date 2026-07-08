import { Module } from '@nestjs/common'
import { EyeService } from './eye.service'
import { EyeController } from './eye.controller'

@Module({
  controllers: [EyeController],
  providers: [EyeService],
})
export class EyeModule {}
