import { Module } from '@nestjs/common'
import { PatientPortalController } from './patientportal.controller'
import { PatientPortalService } from './patientportal.service'

@Module({
  controllers: [PatientPortalController],
  providers: [PatientPortalService],
  exports: [PatientPortalService],
})
export class PatientPortalModule {}
