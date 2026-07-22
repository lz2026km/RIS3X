import { Module } from '@nestjs/common'
import { AiMarketplaceController } from './ai-marketplace.controller'
import { AiMarketplaceService } from './ai-marketplace.service'

@Module({
  controllers: [AiMarketplaceController],
  providers: [AiMarketplaceService],
  exports: [AiMarketplaceService],
})
export class AiMarketplaceModule {}
