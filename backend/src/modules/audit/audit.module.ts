import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { SecurityCenterModule } from '../security-center/security-center.module'
import { AuditController } from './audit.controller'
import { AuditService } from './audit.service'

@Module({
  imports: [PrismaModule, SecurityCenterModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
