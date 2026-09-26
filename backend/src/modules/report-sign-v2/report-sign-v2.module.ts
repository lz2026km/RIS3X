// [G005 v3.0.6.11-101 Wave 6A F8] 水印签章 V2 模块 (孤儿模块, 无 DB 可启动)
// [G005 W8-Report] + 证书注册表 / CRL / TSA / 真实数据签名验签
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { ReportWatermarkService } from './report-watermark.service'
import { ReportSignService } from './report-sign.service'
import { ReportSignV2Controller } from './report-sign-v2.controller'
import { ReportCertificateService } from './report-certificate.service'
import { ReportTsaService } from './report-tsa.service'
import { ReportSigningService } from './report-signing.service'
import { ReportSigningController } from './report-signing.controller'

@Module({
  imports: [PrismaModule],
  controllers: [ReportSignV2Controller, ReportSigningController],
  providers: [ReportWatermarkService, ReportSignService, ReportCertificateService, ReportTsaService, ReportSigningService],
  exports: [ReportWatermarkService, ReportSignService, ReportCertificateService, ReportTsaService, ReportSigningService],
})
export class ReportSignV2Module {}
