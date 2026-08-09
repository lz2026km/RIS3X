import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { DiagnosisAccuracyService } from './diagnosis-accuracy.service'

// [G005 Wave1B P1] /diagnosis-accuracy — 从 Report 审核结果派生
@ApiTags('diagnosis-accuracy')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('diagnosis-accuracy')
export class DiagnosisAccuracyController {
  constructor(private readonly service: DiagnosisAccuracyService) {}

  @Get()
  @ApiOperation({ summary: '诊断符合率总览 (Report 审核结果派生)' })
  getAccuracy() {
    return this.service.getAccuracy()
  }
}
