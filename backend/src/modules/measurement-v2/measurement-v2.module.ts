/**
 * G005 RIS v3.0.6.11-101 Wave 3B - 影像测量 V2 + 标注 V2 模块 (孤儿模块)
 * 自包含: 仅依赖全局 PrismaService (可无 DB 启动, seed 回退), 不引用其他业务模块。
 */
import { Module } from '@nestjs/common'
import { MeasurementV2Controller } from './measurement-v2.controller'
import { MeasurementV2Service } from './measurement-v2.service'

@Module({
  controllers: [MeasurementV2Controller],
  providers: [MeasurementV2Service],
  exports: [MeasurementV2Service],
})
export class MeasurementV2Module {}
