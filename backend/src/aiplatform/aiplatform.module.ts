import { Module } from '@nestjs/common'
import { AiPlatformController } from './aiplatform.controller'
import { AiPlatformService } from './aiplatform.service'

@Module({
  controllers: [AiPlatformController],
  providers: [AiPlatformService],
  exports: [AiPlatformService],
})
export class AiPlatformModule {}
