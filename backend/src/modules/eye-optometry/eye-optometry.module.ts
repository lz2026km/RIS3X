import { Module } from '@nestjs/common'
import { EyeOptometryController } from './eye-optometry.controller'
import { EyeOptometryService } from './eye-optometry.service'

@Module({
  controllers: [EyeOptometryController],
  providers: [EyeOptometryService],
})
export class EyeOptometryModule {}
