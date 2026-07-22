import { Body, Controller, Get, Post, Put } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { WorklistSmartService, type SmartScoreInput, type SmartWeightConfig } from './worklist-smart.service'
import { Roles } from '../../common/decorators/roles.decorator'

@ApiTags('worklist-smart')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('worklist-smart')
export class WorklistSmartController {
  constructor(private readonly service: WorklistSmartService) {}

  @Post('score')
  score(@Body() body: SmartScoreInput) {
    return this.service.score(body)
  }

  @Post('reorder')
  reorder(@Body() body: { items: SmartScoreInput[] }) {
    return this.service.reorder(body.items ?? [])
  }

  @Get('weights')
  getWeights(): SmartWeightConfig {
    return this.service.getWeights()
  }

  @Put('weights')
  @Roles('ADMIN')
  setWeights(@Body() body: Partial<SmartWeightConfig>): SmartWeightConfig {
    return this.service.setWeights(body)
  }
}
