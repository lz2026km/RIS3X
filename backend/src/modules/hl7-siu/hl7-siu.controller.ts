import { Body, Controller, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { Hl7SiuService } from './hl7-siu.service'

const SiuSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  patientSex: z.string().min(1),
  doctorId: z.string().min(1),
  doctorName: z.string().min(1),
  department: z.string().min(1),
  startDateTime: z.string().min(1),
  endDateTime: z.string().min(1),
  reason: z.string().optional(),
  note: z.string().optional(),
})

const ParseSchema = z.object({
  raw: z.string().min(1),
})

@ApiTags('hl7-siu')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('hl7')
export class Hl7SiuController {
  constructor(private readonly service: Hl7SiuService) {}

  @Post('siu')
  generate(@Body(new ZodValidationPipe(SiuSchema)) body: z.infer<typeof SiuSchema>) {
    return this.service.generateS12(body)
  }

  @Post('siu/parse')
  parse(@Body(new ZodValidationPipe(ParseSchema)) body: z.infer<typeof ParseSchema>) {
    return this.service.parse(body.raw)
  }
}
