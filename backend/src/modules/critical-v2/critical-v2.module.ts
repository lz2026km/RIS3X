import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { CriticalV2Controller } from './critical-v2.controller'
import { CriticalV2Service } from './critical-v2.service'

/**
 * G005 v3.0.6.11-101 - 危急值管理 V2 (孤儿模块: 不注册进 app.module,
 * 由 spec 直接注入测试; 服务内置 seed 回退, 可独立运行)。
 */
@Module({
  imports: [PrismaModule],
  controllers: [CriticalV2Controller],
  providers: [CriticalV2Service],
  exports: [CriticalV2Service],
})
export class CriticalV2Module {}
