import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { DicomShareService } from './dicom-share.service'

const CreateShareSchema = z.object({
  studyId: z.string().min(1),
  patientName: z.string().optional(),
  toDept: z.string().min(1),
  protocol: z.enum(['dicom-tls', 'wado']).default('dicom-tls'),
  password: z.string().optional(),
  expiresAt: z.string().optional(),
  sizeMb: z.number().optional(),
})

@ApiTags('dicom-share')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('dicom-share')
export class DicomShareController {
  constructor(private readonly service: DicomShareService) {}

  @Get('shares')
  @ApiOperation({ summary: 'DICOM cross-department share records' })
  list() {
    return this.service.list()
  }

  @Get('shares/:id')
  @ApiOperation({ summary: 'Share record detail' })
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post('shares')
  @ApiOperation({ summary: 'Create DICOM share' })
  create(@Body(new ZodValidationPipe(CreateShareSchema)) body: z.infer<typeof CreateShareSchema>) {
    return this.service.create(body)
  }

  @Delete('shares/:id')
  @ApiOperation({ summary: 'Remove DICOM share' })
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }

  @Post('shares/:id/copy-link')
  @ApiOperation({ summary: 'Copy share link' })
  copyLink(@Param('id') id: string) {
    return this.service.copyLink(id)
  }

  @Get('stats')
  @ApiOperation({ summary: 'DICOM share statistics' })
  getStats() {
    return this.service.getStats()
  }
}
