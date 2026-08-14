// [G005 Wave 3A v3.0.6.11-99] qc-pdca 质控闭环模块
// 12+ 端点: cycles CRUD / advance / phases CRUD / defects 关联 / stats / complete
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { QcPdcaController } from './qc-pdca.controller'
import { QcPdcaService } from './qc-pdca.service'

@Module({
  imports: [PrismaModule],
  controllers: [QcPdcaController],
  providers: [QcPdcaService],
  exports: [QcPdcaService],
})
export class QcPdcaModule {}
