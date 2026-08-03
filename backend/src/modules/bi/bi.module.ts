import { Module } from '@nestjs/common'
import { CacheModule } from '../../cache/cache.module'
import { PrismaModule } from '../../prisma/prisma.module'
import { BiController } from './bi.controller'
import { BiService } from './bi.service'

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [BiController],
  providers: [BiService],
  exports: [BiService],
})
export class BiModule {}
