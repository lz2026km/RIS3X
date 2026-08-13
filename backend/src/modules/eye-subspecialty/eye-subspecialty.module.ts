import { Module } from '@nestjs/common'
import { EyeSubspecialtyController, EyeLowVisionController } from './eye-subspecialty.controller'
import { EyeSubspecialtyService } from './eye-subspecialty.service'

@Module({
  controllers: [EyeSubspecialtyController, EyeLowVisionController],
  providers: [EyeSubspecialtyService],
})
export class EyeSubspecialtyModule {}
