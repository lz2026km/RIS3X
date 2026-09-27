import { Module } from '@nestjs/common'
import { SecurityCenterModule } from '../security-center/security-center.module'
import { ComplianceController } from './compliance.controller'
import { ComplianceService } from './compliance.service'

@Module({
  imports: [SecurityCenterModule],
  controllers: [ComplianceController],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
