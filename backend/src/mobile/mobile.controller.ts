import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Public } from '../common/decorators/public.decorator'
import { MobileService } from './mobile.service'

@ApiTags('mobile')
@Public()
@Controller('mobile')
export class MobileController {
  constructor(private readonly mobile: MobileService) {}

  @Get('jscode2session')
  jscode2session(@Query('code') code: string) {
    return this.mobile.jscode2session(code)
  }
}
