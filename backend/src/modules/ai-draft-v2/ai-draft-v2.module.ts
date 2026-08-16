/**
 * G005 RIS v3.0.6.11-101 Wave 7A — AI 报告助理 V2 模块 (孤儿模块: DB 不可用可启动, seed 回退)
 */
import { Module } from '@nestjs/common'
import { AiDraftV2Controller } from './ai-draft-v2.controller'
import { AiDraftV2Service } from './ai-draft-v2.service'

@Module({
  controllers: [AiDraftV2Controller],
  providers: [AiDraftV2Service],
  exports: [AiDraftV2Service],
})
export class AiDraftV2Module {}
