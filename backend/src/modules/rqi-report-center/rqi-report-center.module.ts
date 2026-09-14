/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 2A - 放射影像质控指标国家上报中心模块
 * 孤儿模块: 不新增 DB 表 (不修改 prisma schema), 内存 overlay + 确定性 seed 回退, 可无 DB 启动。
 * 复用 Rqi2024Module 的指标计算服务 (imports Rqi2024Module)。
 */
import { Module } from '@nestjs/common'
import { Rqi2024Module } from '../rqi-2024/rqi-2024.module'
import { RqiReportCenterController } from './rqi-report-center.controller'
import { RqiReportCenterService } from './rqi-report-center.service'

@Module({
  imports: [Rqi2024Module],
  controllers: [RqiReportCenterController],
  providers: [RqiReportCenterService],
  exports: [RqiReportCenterService],
})
export class RqiReportCenterModule {}
