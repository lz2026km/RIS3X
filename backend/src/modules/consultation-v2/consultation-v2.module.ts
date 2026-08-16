/**
 * G005 RIS v3.0.6.11-101 Wave 7C - 委员会会诊 V2 模块 (孤儿模块: 无 Prisma, 无外部依赖)
 * 注意: consultations (Wave1A) 模块保持只读不动, 本模块独立实现 Wave 2A 会诊能力升级版。
 */
import { Module } from '@nestjs/common'
import { ConsultationV2Controller } from './consultation-v2.controller'
import { ConsultationV2Service } from './consultation-v2.service'

@Module({
  controllers: [ConsultationV2Controller],
  providers: [ConsultationV2Service],
  exports: [ConsultationV2Service],
})
export class ConsultationV2Module {}
