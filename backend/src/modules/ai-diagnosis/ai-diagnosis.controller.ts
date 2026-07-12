import { Controller, Get, Post, Body, Logger } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { AiDiagnosisService, AccuracyRequest } from './ai-diagnosis.service'

@ApiTags('ai-diagnosis')
@Roles('ADMIN', 'DIRECTOR')
@Controller('api/v1/ai-diagnosis')
export class AiDiagnosisController {
  private readonly logger = new Logger(AiDiagnosisController.name)
  constructor(private readonly service: AiDiagnosisService) {}

  @Post('accuracy')
  @ApiOperation({ summary: 'AI diagnosis accuracy metrics' })
  accuracy(@Body() body: AccuracyRequest) {
    return this.service.accuracy(body)
  }

  @Get('trend')
  @ApiOperation({ summary: 'AI accuracy trend' })
  trend(@Body() body: AccuracyRequest) {
    return this.service.trend(body)
  }
}
