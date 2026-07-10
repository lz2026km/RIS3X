/**
 * G005 放射RIS系统 v3.0.6.11-7 - IHE 集成层 NestJS 模块
 * PAM / PIX / PDQ 真实实现 + Affinity Domain 配置
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { IheController } from './ihe.controller'
import { IheService } from './ihe.service'

@Module({
  imports: [PrismaModule],
  controllers: [IheController],
  providers: [IheService],
  exports: [IheService],
})
export class IheModule {}
