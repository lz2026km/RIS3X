import { Body, Controller, Post } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { AsrService } from './asr.service'

@ApiTags('asr')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('asr')
export class AsrController {
  constructor(private readonly svc: AsrService) {}

  @Post('transcribe')
  transcribe(@Body() body: { audioBase64?: string; duration?: number }) {
    return this.svc.transcribe(body)
  }

  @Post('feedback')
  feedback(@Body() body: { transcriptionId: string; correctedText: string; originalText: string }) {
    return this.svc.feedback(body)
  }
}
