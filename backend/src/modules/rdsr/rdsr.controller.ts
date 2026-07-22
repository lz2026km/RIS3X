import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { RdsrService } from './rdsr.service'

@ApiTags('rdsr')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'TECHNOLOGIST')
@Controller('rdsr')
export class RdsrController {
  constructor(private readonly svc: RdsrService) {}

  @Post('parse')
  parse(@Body() body: { dicomJson?: Record<string, unknown>; modality?: string }) {
    return this.svc.parse(body)
  }

  @Get('drls')
  getDrls(@Query('modality') modality?: string, @Query('bodyPart') bodyPart?: string) {
    return this.svc.getDrls(modality, bodyPart)
  }

  @Get('stats')
  getStats(@Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string, @Query('modality') modality?: string) {
    return this.svc.getStats(dateFrom, dateTo, modality)
  }
}
