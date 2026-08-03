import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AiMarketplaceController } from './ai-marketplace.controller'
import { AiMarketplaceService } from './ai-marketplace.service'

@Module({
  imports: [PrismaModule],
  controllers: [AiMarketplaceController],
  providers: [AiMarketplaceService],
  exports: [AiMarketplaceService],
})
export class AiMarketplaceModule {}
