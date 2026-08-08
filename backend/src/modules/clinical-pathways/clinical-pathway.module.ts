import { Module } from '@nestjs/common'
import { ClinicalPathwayController } from './clinical-pathway.controller'
import { ClinicalPathwayService } from './clinical-pathway.service'

@Module({
  controllers: [ClinicalPathwayController],
  providers: [ClinicalPathwayService],
})
export class ClinicalPathwaysModule {}
