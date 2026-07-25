import { Module } from '@nestjs/common'
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager'
import { CacheService } from './cache.service'

@Module({
  imports: [
    NestCacheModule.registerAsync({
      useFactory: () => ({
        store: 'redis' as any,
        host: process.env['REDIS_HOST'] ?? 'localhost',
        port: parseInt(process.env['REDIS_PORT'] ?? '6379'),
        password: process.env['REDIS_PASSWORD'] || undefined,
        db: parseInt(process.env['REDIS_DB'] ?? '0'),
        tls: process.env['REDIS_TLS'] === 'true' ? {} : undefined,
        ttl: 300,
      }),
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
