// [G005 v3.0.6.11-101 Wave 6A F8] 水印签章 V2 模块 (孤儿模块, 无 DB 可启动)
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { ReportWatermarkService } from './report-watermark.service'
import { ReportSignService } from './report-sign.service'
import { ReportSignV2Controller } from './report-sign-v2.controller'

@Module({
  imports: [PrismaModule],
  controllers: [ReportSignV2Controller],
  providers: [ReportWatermarkService, ReportSignService],
  exports: [ReportWatermarkService, ReportSignService],
})
export class ReportSignV2Module {}
