import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { FhirService } from './fhir.service'

@ApiTags('fhir')
@Controller('fhir/r4')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
export class FhirController {
  constructor(private readonly service: FhirService) {}

  // 鈹€鈹€ Patient 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  @Get('Patient/:id')
  readPatient(@Param('id') id: string) {
    return this.service.readPatient(id)
  }

  @Get('Patient')
  searchPatient(
    @Query('name') name?: string,
    @Query('identifier') identifier?: string,
    @Query('birthdate') birthdate?: string,
    @Query('_count') _count?: string,
  ) {
    return this.service.searchPatient({ name, identifier, birthdate, _count })
  }

  @Post('Patient')
  @HttpCode(HttpStatus.CREATED)
  createPatient(@Body() body: any) {
    return this.service.createPatient(body)
  }

  @Put('Patient/:id')
  updatePatient(@Param('id') id: string, @Body() body: any) {
    return this.service.updatePatient(id, body)
  }

  @Delete('Patient/:id')
  deletePatient(@Param('id') id: string) {
    return this.service.deletePatient(id)
  }

  @Get('Patient/:id/$everything')
  patientEverything(@Param('id') id: string) {
    return this.service.patientEverything(id)
  }

  // 鈹€鈹€ Observation 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  @Get('Observation/:id')
  readObservation(@Param('id') id: string) {
    return this.service.readObservation(id)
  }

  @Get('Observation')
  searchObservation(@Query('patient') patient?: string, @Query('_count') _count?: string) {
    return this.service.searchObservation({ patient, _count })
  }

  // 鈹€鈹€ DiagnosticReport 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  @Get('DiagnosticReport/:id')
  readDiagnosticReport(@Param('id') id: string) {
    return this.service.readDiagnosticReport(id)
  }

  @Get('DiagnosticReport')
  searchDiagnosticReport(
    @Query('patient') patient?: string,
    @Query('status') status?: string,
    @Query('_count') _count?: string,
  ) {
    return this.service.searchDiagnosticReport({ patient, status, _count })
  }

  // 鈹€鈹€ ImagingStudy 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  @Get('ImagingStudy/:id')
  readImagingStudy(@Param('id') id: string) {
    return this.service.readImagingStudy(id)
  }

  @Get('ImagingStudy')
  searchImagingStudy(
    @Query('patient') patient?: string,
    @Query('modality') modality?: string,
    @Query('_count') _count?: string,
  ) {
    return this.service.searchImagingStudy({ patient, modality, _count })
  }

  // 鈹€鈹€ Subscription 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  @Post('Subscription')
  @HttpCode(HttpStatus.CREATED)
  createSubscription(@Body() body: any) {
    return this.service.createSubscription(body)
  }

  @Get('Subscription/:id')
  getSubscription(@Param('id') id: string) {
    return this.service.getSubscription(id)
  }

  @Get('Subscription')
  searchSubscription() {
    return this.service.searchSubscription()
  }

  @Delete('Subscription/:id')
  deleteSubscription(@Param('id') id: string) {
    return this.service.deleteSubscription(id)
  }

  // 鈹€鈹€ Bulk Data Export 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  @Get('$export')
  async bulkExport(
    @Query('_outputFormat') _outputFormat?: string,
    @Query('_since') _since?: string,
    @Query('_type') _type?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const { jobId } = await this.service.bulkExport(_outputFormat, _since, _type)
    if (res) {
      res.status(202)
      res.setHeader('Content-Location', `/fhir/r4/$export-status/${jobId}`)
    }
    return { jobId }
  }

  @Get('$export-status/:jobId')
  async bulkExportStatus(@Param('jobId') jobId: string, @Res({ passthrough: true }) res: Response) {
    const result = await this.service.bulkExportStatus(jobId)
    if (typeof result === 'string') {
      res.setHeader('Content-Type', 'application/fhir+ndjson')
      res.setHeader('Content-Disposition', 'attachment; filename="export.ndjson"')
      return result
    }
    return result
  }
}
