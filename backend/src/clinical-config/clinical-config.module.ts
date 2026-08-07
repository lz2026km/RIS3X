import { Module } from '@nestjs/common'
import { ClinicalConfigController } from './clinical-config.controller'
import { ClinicalConfigService } from './clinical-config.service'

@Module({
  controllers: [ClinicalConfigController],
  providers: [ClinicalConfigService],
})
export class ClinicalConfigModule {}
