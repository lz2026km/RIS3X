/**
 * G005 RIS v3.0.6.11-104 Wave 3C - 临床反馈闭环模块 (孤儿模块)
 * 自包含: 纯内存 + seed 回退, 不引用其他业务模块, 无 DB 可启动。
 */
import { Module } from '@nestjs/common'
import { ClinicalFeedbackController } from './clinical-feedback.controller'
import { ClinicalFeedbackService } from './clinical-feedback.service'

@Module({
  controllers: [ClinicalFeedbackController],
  providers: [ClinicalFeedbackService],
  exports: [ClinicalFeedbackService],
})
export class ClinicalFeedbackModule {}
