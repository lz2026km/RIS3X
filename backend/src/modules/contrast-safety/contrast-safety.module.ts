/**
 * G005 放射RIS系统 v3.0.6.11-104 Wave 3B - 对比剂安全闭环模块
 * 孤儿模块: 无新增 DB 表 (不修改 prisma schema), Prisma 可选注入, 可无 DB 启动
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { ContrastSafetyController } from './contrast-safety.controller'
import { ContrastSafetyService } from './contrast-safety.service'

@Module({
  imports: [PrismaModule],
  controllers: [ContrastSafetyController],
  providers: [ContrastSafetyService],
  exports: [ContrastSafetyService],
})
export class ContrastSafetyModule {}
