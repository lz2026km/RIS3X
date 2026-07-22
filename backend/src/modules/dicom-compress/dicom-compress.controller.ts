import { Controller, Get, Post, Param, Body, Logger } from '@nestjs/common'
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { DicomCompressService } from './dicom-compress.service'

@ApiTags('dicom-compress')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('api/v1/dicom/compress')
export class DicomCompressController {
  private readonly logger = new Logger(DicomCompressController.name)
  constructor(private readonly service: DicomCompressService) {}

  @Post()
  @ApiOperation({ summary: 'Compress DICOM file with specified transfer syntax' })
  compress(@Body() body: { fileId: string; transferSyntax: string }) {
    return this.service.compress(body.fileId, body.transferSyntax)
  }

  @Get('status/:id')
  @ApiOperation({ summary: 'Get compression task status' })
  getStatus(@Param('id') id: string) {
    return this.service.getStatus(id)
  }

  @Post('decompress')
  @ApiOperation({ summary: 'Decompress DICOM file to original transfer syntax' })
  decompress(@Body() body: { fileId: string }) {
    return this.service.decompress(body.fileId)
  }

  @Get('ratio/:instanceId')
  @ApiOperation({ summary: 'Get compression ratio statistics by instance' })
  getRatio(@Param('instanceId') instanceId: string) {
    return this.service.getRatio(instanceId)
  }

  @Get('syntaxes')
  @ApiOperation({ summary: 'List supported transfer syntaxes' })
  getSupportedSyntaxes() {
    return this.service.getSupportedSyntaxes()
  }
}
