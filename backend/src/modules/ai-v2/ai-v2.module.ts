/**
 * G005 RIS v3.0.6.11-101 Wave 3C - AI 增强模块 (孤儿模块: 无 Prisma, 无外部依赖)
 */
import { Module } from '@nestjs/common'
import { AiV2Controller } from './ai-v2.controller'
import { AiV2Service } from './ai-v2.service'

@Module({
  controllers: [AiV2Controller],
  providers: [AiV2Service],
  exports: [AiV2Service],
})
export class AiV2Module {}
