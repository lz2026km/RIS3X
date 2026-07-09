import { Module } from '@nestjs/common'
import { CacheModule } from '../../cache/cache.module'
import { StatsController } from './stats.controller'
import { StatsService } from './stats.service'

@Module({
  imports: [CacheModule],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
