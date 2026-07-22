import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { SnomedService } from './snomed.service'

@ApiTags('snomed')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('snomed')
export class SnomedController {
  constructor(private readonly svc: SnomedService) {}

  @Post('encode')
  encode(@Body() body: { text: string; modality?: string }) {
    return this.svc.encode(body.text, body.modality)
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.svc.search(q)
  }
}
