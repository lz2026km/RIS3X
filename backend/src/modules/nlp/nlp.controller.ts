import { Body, Controller, Post } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { NlpService } from './nlp.service'

@ApiTags('nlp')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('nlp')
export class NlpController {
  constructor(private readonly svc: NlpService) {}

  @Post('spellcheck')
  spellcheck(@Body() body: { text: string }) {
    return this.svc.spellcheck(body.text)
  }

  @Post('terminology')
  terminology(@Body() body: { text: string }) {
    return this.svc.terminology(body.text)
  }
}
