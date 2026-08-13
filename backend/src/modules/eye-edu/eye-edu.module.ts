import { Module } from '@nestjs/common'
import { EyeEduController } from './eye-edu.controller'
import { EyeEduService } from './eye-edu.service'

@Module({
  controllers: [EyeEduController],
  providers: [EyeEduService],
})
export class EyeEduModule {}
