/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 1C - 质量指标库镜像模块
 * 孤儿模块: 无新增 DB 表 (不修改 prisma schema), 常量镜像, 可无 DB 启动
 */
import { Module } from '@nestjs/common'
import { QualityIndicatorsController } from './quality-indicators.controller'
import { QualityIndicatorsService } from './quality-indicators.service'

@Module({
  controllers: [QualityIndicatorsController],
  providers: [QualityIndicatorsService],
  exports: [QualityIndicatorsService],
})
export class QualityIndicatorsModule {}
