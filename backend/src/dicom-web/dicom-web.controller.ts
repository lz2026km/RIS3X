/**
 * G005 RIS v3.0.6.11-33 - DICOMweb Controller
 * v3.0.6.11-91 Wave 4A (PACS P0-2): + POST /dicom-web/prefetch / GET /dicom-web/prefetch/status
 */
import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { DicomWebService } from './dicom-web.service'

const StoreSchema = z.object({
  studyInstanceUid: z.string().min(1),
  seriesInstanceUid: z.string().min(1),
  sopInstanceUid: z.string().min(1),
  modality: z.string().min(1),
  sopClassUid: z.string().min(1),
  patientId: z.string().optional(),
  sizeBytes: z.number().int().nonnegative(),
  storagePath: z.string().min(1),
})

const PrefetchSchema = z.object({
  studyUids: z.array(z.string().min(1)).max(500),
})

@ApiTags('dicom-web')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('dicom-web')
export class DicomWebController {
  constructor(private readonly service: DicomWebService) {}

  @Get('capabilities')
  capabilities() {
    return this.service.getCapabilities()
  }

  @Get('studies')
  async searchStudies(
    @Query('PatientID') PatientID?: string,
    @Query('Modality') Modality?: string,
    @Query('StudyInstanceUID') StudyInstanceUID?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    return this.service.searchStudies({
      PatientID,
      Modality,
      StudyInstanceUID,
      limit: Number(limit ?? 50),
      offset: Number(offset ?? 0),
    })
  }

  @Get('studies/:study/series')
  async searchSeries(@Param('study') study: string) {
    return this.service.searchSeries(study)
  }

  @Get('studies/:study/instances')
  async searchInstances(@Param('study') study: string, @Query('series') series?: string) {
    return this.service.searchInstances(study, series)
  }

  // [G005 W3-BackendParity] WADO-RS study / series 级元数据 (DICOM JSON)
  @Get('studies/:study/series/:series')
  async seriesMetadata(@Param('study') study: string, @Param('series') series: string) {
    return this.service.getSeriesMetadata(study, series)
  }

  @Get('studies/:study')
  async studyMetadata(@Param('study') study: string) {
    return this.service.getStudyMetadata(study)
  }

  @Get('studies/:study/series/:series/instances/:sop')
  async retrieve(@Param('sop') sop: string, @Res({ passthrough: true }) res: Response) {
    const r = await this.service.retrieveInstance(sop)
    res.setHeader('Content-Type', 'application/dicom')
    res.setHeader('Content-Length', r.buffer.length.toString())
    return r.buffer
  }

  @Get('studies/:study/series/:series/instances/:sop/metadata')
  metadata(@Param('sop') sop: string) {
    return this.service.retrieveMetadata(sop)
  }

  @Post('prefetch')
  prefetch(
    @Body(new ZodValidationPipe(PrefetchSchema)) body: z.infer<typeof PrefetchSchema>
  ) {
    return this.service.prefetchStudies(body.studyUids)
  }

  @Get('prefetch/status')
  prefetchStatus() {
    return this.service.getPrefetchStatus()
  }

  @Post('studies/:study')
  store(
    @Param('study') study: string,
    @Body(new ZodValidationPipe(StoreSchema)) body: z.infer<typeof StoreSchema>
  ) {
    return this.service.storeInstance(
      body.studyInstanceUid ?? study,
      body.seriesInstanceUid,
      body.sopInstanceUid,
      body.modality,
      body.sopClassUid,
      body.sizeBytes,
      body.storagePath,
      body.patientId
    )
  }
}
