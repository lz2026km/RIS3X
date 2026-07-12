import { Module } from '@nestjs/common'
import { CacheModule } from '../../cache/cache.module'
import { BenchmarkController } from './benchmark.controller'
import { BenchmarkService } from './benchmark.service'

@Module({
  imports: [CacheModule],
  controllers: [BenchmarkController],
  providers: [BenchmarkService],
  exports: [BenchmarkService],
})
export class BenchmarkModule {}
