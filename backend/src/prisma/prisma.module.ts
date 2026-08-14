/**
 * G005 放射RIS系统 v3.0.1 - Prisma Module
 */
import { Global, Module, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PrismaService, createPrismaWithTenant } from './prisma.service'

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: () => {
        const base = new PrismaService()
        return createPrismaWithTenant(base) as unknown as PrismaService
      },
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaModule.name)
  constructor(public readonly prisma: PrismaService) {}

  // [W6] DB 不可用时降级启动: 仅告警不抛错, 业务服务走内存 seed/回退路径
  async onModuleInit(): Promise<void> {
    try {
      await this.prisma.$connect()
    } catch (error) {
      this.logger.warn(
        `[W6] DB $connect failed (${error instanceof Error ? error.message : 'unknown error'}); continuing without DB.`,
      )
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.prisma.$disconnect()
    } catch {
      // ignore disconnect errors
    }
  }
}
