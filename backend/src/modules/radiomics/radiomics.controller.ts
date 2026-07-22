import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { RadiomicsService, type ExtractRequest, type CompareRequest } from './radiomics.service'

@ApiTags('radiomics')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('radiomics')
export class RadiomicsController {
  constructor(private readonly service: RadiomicsService) {}

  @Post('extract')
  extract(@Body() body: ExtractRequest) {
    return this.service.extract(body)
  }

  @Get('features/:instanceId')
  getFeatures(@Param('instanceId') instanceId: string) {
    return this.service.getFeatures(instanceId)
  }

  @Post('compare')
  compare(@Body() body: CompareRequest) {
    return this.service.compare(body)
  }
}
