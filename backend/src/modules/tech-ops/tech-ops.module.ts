/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 4B (tech-ops) - 技师工作站 V2 模块
 * 孤儿模块: 无新增 DB 表, DB 不可用自动回退确定性种子, 可无 DB 启动。
 */
import { Module } from '@nestjs/common'
import { TechOpsController } from './tech-ops.controller'
import { TechOpsService } from './tech-ops.service'

@Module({
  controllers: [TechOpsController],
  providers: [TechOpsService],
  exports: [TechOpsService],
})
export class TechOpsModule {}
