// [G005 W13-Security] OCSP 响应器端点: POST /ocsp + GET /ocsp/:serial
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Roles } from '../../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { OcspService } from './ocsp.service'

const OcspRequestSchema = z.object({
  serial: z.string().min(1).max(128).optional(),
  serials: z.array(z.string().min(1).max(128)).max(100).optional(),
  request: z.object({ serial: z.string().min(1).max(128) }).optional(),
})

@ApiTags('ocsp')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('ocsp')
export class OcspController {
  constructor(private readonly ocsp: OcspService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  post(@Body(new ZodValidationPipe(OcspRequestSchema)) body: z.infer<typeof OcspRequestSchema>) {
    return this.ocsp.handleRequest(body)
  }

  @Get(':serial')
  get(@Param('serial') serial: string) {
    return this.ocsp.respond(serial)
  }
}
