import { Module } from '@nestjs/common'
import { AiDiagnosisController } from './ai-diagnosis.controller'
import { AiDiagnosisService } from './ai-diagnosis.service'

@Module({
  controllers: [AiDiagnosisController],
  providers: [AiDiagnosisService],
  exports: [AiDiagnosisService],
})
export class AiDiagnosisModule {}
