import { Module } from '@nestjs/common'
import { InsuranceAuditsController } from './insurance-audits.controller'
import { InsuranceAuditsService } from './insurance-audits.service'

@Module({
  controllers: [InsuranceAuditsController],
  providers: [InsuranceAuditsService],
})
export class InsuranceAuditsModule {}
