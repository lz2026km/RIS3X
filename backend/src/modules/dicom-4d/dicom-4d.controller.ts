import { Controller, Post, Get, Param, Body, Logger } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { Dicom4dService } from './dicom-4d.service'

@ApiTags('dicom-4d')
@Controller('dicom/4d')
export class Dicom4dController {
  private readonly logger = new Logger(Dicom4dController.name)
  constructor(private readonly service: Dicom4dService) {}

  @Post('list')
  @ApiOperation({ summary: 'List 4D series' })
  list() {
    return this.service.list()
  }

  @Post('frames')
  @ApiOperation({ summary: 'Get 4D frame sequence' })
  getFrames(@Body() body: { seriesUid: string }) {
    return this.service.getFrames(body.seriesUid)
  }

  @Get('phase/:seriesUid')
  @ApiOperation({ summary: 'Get cardiac/respiratory phase for 4D series' })
  getPhase(@Param('seriesUid') seriesUid: string) {
    return this.service.getPhase(seriesUid)
  }
}
