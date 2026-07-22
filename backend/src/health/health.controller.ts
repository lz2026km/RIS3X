import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { Public } from '../common/decorators/public.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { CacheService } from '../cache/cache.service'
import { InjectQueue } from '@nestjs/bull'
import type { Queue } from 'bull'
import { version } from '../../package.json'

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @InjectQueue('reportExport') private readonly reportExportQueue: Queue,
    @InjectQueue('hl7Send') private readonly hl7SendQueue: Queue,
    @InjectQueue('aiInference') private readonly aiInferenceQueue: Queue,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  check(): { status: string; version: string; timestamp: number } {
    return {
      status: 'ok',
      version,
      timestamp: Date.now(),
    }
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (incl. DB, Cache, Queue)' })
  async ready(): Promise<{
    status: string
    db: boolean
    cache: boolean
    queues: Record<string, boolean>
    version: string
  }> {
    let db = false
    try {
      await this.prisma.$queryRaw`SELECT 1`
      db = true
    } catch {
      db = false
    }

    let cache = false
    try {
      await this.cache.set('health:ping', 'pong', 10)
      const val = await this.cache.get<string>('health:ping')
      cache = val === 'pong'
    } catch {
      cache = false
    }

    const queueNames: [string, Queue][] = [
      ['reportExport', this.reportExportQueue],
      ['hl7Send', this.hl7SendQueue],
      ['aiInference', this.aiInferenceQueue],
    ]
    const queues: Record<string, boolean> = {}
    for (const [name, q] of queueNames) {
      try {
        await q.isReady()
        queues[name] = true
      } catch {
        queues[name] = false
      }
    }

    const allOk = db && cache && Object.values(queues).every(Boolean)
    return { status: allOk ? 'ok' : 'degraded', db, cache, queues, version }
  }
}
