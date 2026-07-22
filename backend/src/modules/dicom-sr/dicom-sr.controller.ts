import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { DicomSrService, type GenerateSrDto } from './dicom-sr.service'

const GenerateSrSchema = z.object({
  reportId: z.string().min(1),
  templateId: z.enum(['tid1500', 'tid2000']),
  findings: z.string().max(5000).optional(),
  impression: z.string().max(5000).optional(),
})

@ApiTags('dicom-sr')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('dicom-sr')
export class DicomSrController {
  constructor(private readonly service: DicomSrService) {}

  @Post('templates')
  getTemplates() {
    return this.service.getTemplates()
  }

  @Post('generate')
  generate(@Body(new ZodValidationPipe(GenerateSrSchema)) body: GenerateSrDto) {
    return this.service.generate(body)
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    const doc = this.service.findById(id)
    if (!doc) throw new NotFoundException(`SR document ${id} not found`)
    return doc
  }
}
