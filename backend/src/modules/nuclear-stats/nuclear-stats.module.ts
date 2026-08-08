import { Module } from '@nestjs/common'
import { NuclearStatsController } from './nuclear-stats.controller'
import { NuclearStatsService } from './nuclear-stats.service'

@Module({
  controllers: [NuclearStatsController],
  providers: [NuclearStatsService],
})
export class NuclearStatsModule {}
