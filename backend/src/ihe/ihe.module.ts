/**
 * G005 放射RIS系统 v3.0.6.13 - IHE 集成层 NestJS 模块
 * XDS.b/XCA/XDR 真实实现 + PAM / PIX / PDQ 真实实现 + Affinity Domain 配置
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { IheController } from './ihe.controller'
import { IheService } from './ihe.service'
import { XdsController } from './xds.controller'
import { XdsService } from './xds.service'

@Module({
  imports: [PrismaModule],
  controllers: [IheController, XdsController],
  providers: [IheService, XdsService],
  exports: [IheService, XdsService],
})
export class IheModule {}
