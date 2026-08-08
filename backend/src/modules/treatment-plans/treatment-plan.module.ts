import { Module } from '@nestjs/common'
import { TreatmentPlanController } from './treatment-plan.controller'
import { TreatmentPlanService } from './treatment-plan.service'

@Module({
  controllers: [TreatmentPlanController],
  providers: [TreatmentPlanService],
})
export class TreatmentPlansModule {}
