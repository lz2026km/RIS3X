import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CadService } from './cad.service'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'

const DetectSchema = z.object({ instanceId: z.string().min(1) })

class DetectDto {
  instanceId!: string
}

@ApiTags('ai/cad')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('ai/cad')
export class CadController {
  constructor(private readonly service: CadService) {}

  @Post('detect')
  detect(@Body(new ZodValidationPipe(DetectSchema)) dto: DetectDto) {
    return this.service.detect(dto.instanceId)
  }

  @Get('result/:instanceId')
  getResult(@Param('instanceId') instanceId: string) {
    return this.service.getResult(instanceId)
  }
}
