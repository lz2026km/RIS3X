import { Module } from '@nestjs/common'
import { CacheModule } from '../../cache/cache.module'
import { PrismaModule } from '../../prisma/prisma.module'
import { StatsController } from './stats.controller'
import { StatsService } from './stats.service'

@Module({
  imports: [CacheModule, PrismaModule],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
