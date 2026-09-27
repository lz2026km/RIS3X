/**
 * [G005 W12-PatientService] 自助登记模块 (orphan module, DB-less-safe)
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { SelfRegistrationController } from './self-registration.controller'
import { SelfRegistrationService } from './self-registration.service'

@Module({
  imports: [PrismaModule],
  controllers: [SelfRegistrationController],
  providers: [SelfRegistrationService],
  exports: [SelfRegistrationService],
})
export class SelfRegistrationModule {}
