import { Body, Controller, Get, Header, NotFoundException, Param, Post, Res } from '@nestjs/common'
import { Response } from 'express'
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

  @Get()
  list() {
    return this.service.list()
  }

  @Post('generate')
  async generate(@Body(new ZodValidationPipe(GenerateSrSchema)) body: GenerateSrDto) {
    return this.service.generate(body)
  }

  @Get('by-report/:reportId')
  async findByReport(@Param('reportId') reportId: string) {
    const doc = await this.service.findByReportId(reportId)
    if (!doc) throw new NotFoundException(`SR document for report ${reportId} not found`)
    return doc
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const doc = await this.service.findById(id)
    if (!doc) throw new NotFoundException(`SR document ${id} not found`)
    return doc
  }

  @Post(':id/finalize')
  finalize(@Param('id') id: string) {
    return this.service.finalize(id)
  }

  @Post(':id/push-oru')
  pushOru(@Param('id') id: string) {
    return this.service.pushOru(id)
  }

  @Get(':id/download')
  @Header('Content-Type', 'application/dicom')
  async download(@Param('id') id: string, @Res() res: Response) {
    const doc = await this.service.findById(id)
    if (!doc) throw new NotFoundException(`SR document ${id} not found`)
    res.setHeader('Content-Disposition', `attachment; filename="${doc.sopInstanceUid}.sr"`)
    res.send(doc.rawContent)
  }
}
