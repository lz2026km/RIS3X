/**
 * G005 放射RIS系统 v3.0.1 - 健康检查
 */
import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { Public } from '../common/decorators/public.decorator'
import { PrismaService } from '../prisma/prisma.service'

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  check(): { status: string; version: string; timestamp: number } {
    return {
      status: 'ok',
      version: '3.0.1',
      timestamp: Date.now(),
    }
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (incl. DB)' })
  async ready(): Promise<{ status: string; db: boolean; version: string }> {
    let db = false
    try {
      await this.prisma.$queryRaw`SELECT 1`
      db = true
    } catch {
      db = false
    }
    return { status: db ? 'ok' : 'degraded', db, version: '3.0.1' }
  }
}
