/**
 * G005 RIS v3.0.6.11-101 Wave 7C - AI 二次检出 V2 模块 (孤儿模块: 无 Prisma, 无外部依赖)
 */
import { Module } from '@nestjs/common'
import { AiSecondReadController } from './ai-second-read.controller'
import { AiSecondReadService } from './ai-second-read.service'

@Module({
  controllers: [AiSecondReadController],
  providers: [AiSecondReadService],
  exports: [AiSecondReadService],
})
export class AiSecondReadModule {}
