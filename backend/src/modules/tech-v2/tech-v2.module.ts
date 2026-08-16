/**
 * G005 RIS v3.0.6.11-101 Wave 4A (tech-v2) - 技师工作站 V2: 双检间轮转 + 工作量预测
 * 孤儿模块 (无 Prisma, 无外部依赖, 可无 DB 启动), seed 回退
 */
import { Module } from '@nestjs/common'
import { TechV2Controller } from './tech-v2.controller'
import { TechV2Service } from './tech-v2.service'

@Module({
  controllers: [TechV2Controller],
  providers: [TechV2Service],
  exports: [TechV2Service],
})
export class TechV2Module {}
