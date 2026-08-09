import { Module } from '@nestjs/common'
import { DiagnosisAccuracyController } from './diagnosis-accuracy.controller'
import { DiagnosisAccuracyService } from './diagnosis-accuracy.service'

@Module({
  controllers: [DiagnosisAccuracyController],
  providers: [DiagnosisAccuracyService],
})
export class DiagnosisAccuracyModule {}
