// [G005 W13-Security] 安全与合规中心模块 (孤儿模块, 无 DB 可启动)。
// 组合: RA/OCSP/HSM/字段加密/灾难恢复/审计链/安全信号。
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { ReportSignV2Module } from '../report-sign-v2/report-sign-v2.module'
import { AuditChainService } from './audit-chain/audit-chain.service'
import { DisasterRecoveryService } from './disaster-recovery/disaster-recovery.service'
import { FieldEncryptionService } from './field-encryption/field-encryption.service'
import { HsmService } from './hsm/hsm.service'
import { OcspController } from './ocsp/ocsp.controller'
import { OcspService } from './ocsp/ocsp.service'
import { RaService } from './ra/ra.service'
import { SecurityCenterController } from './security-center.controller'
import { SecuritySignalsService } from './security-signals.service'

@Module({
  imports: [PrismaModule, ReportSignV2Module],
  controllers: [SecurityCenterController, OcspController],
  providers: [
    HsmService,
    OcspService,
    RaService,
    FieldEncryptionService,
    DisasterRecoveryService,
    AuditChainService,
    SecuritySignalsService,
  ],
  exports: [
    HsmService,
    OcspService,
    RaService,
    FieldEncryptionService,
    DisasterRecoveryService,
    AuditChainService,
    SecuritySignalsService,
  ],
})
export class SecurityCenterModule {}
