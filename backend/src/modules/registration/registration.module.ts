/**
 * G005 放射RIS系统 - 登记工作站模块 (orphan module, DB-less-safe)
 * Prisma 可选注入: 无 DB 时内存 overlay + 确定性 seed 回退。
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { RegistrationController } from './registration.controller'
import { RegistrationService } from './registration.service'

@Module({
  imports: [PrismaModule],
  controllers: [RegistrationController],
  providers: [RegistrationService],
  exports: [RegistrationService],
})
export class RegistrationModule {}
