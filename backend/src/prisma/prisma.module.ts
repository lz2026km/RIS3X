/**
 * G005 放射RIS系统 v3.0.1 - Prisma Module
 */
import { Global, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
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
  constructor(public readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.prisma.$connect()
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect()
  }
}
