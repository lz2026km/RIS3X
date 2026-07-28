import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { FhirService } from './fhir.service'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { CreatePatientSchema, CreateSubscriptionSchema, UpdatePatientSchema } from './fhir.schema'
import { z } from 'zod'

type CreatePatientDto = z.infer<typeof CreatePatientSchema>
type UpdatePatientDto = z.infer<typeof UpdatePatientSchema>
type CreateSubscriptionDto = z.infer<typeof CreateSubscriptionSchema>

@ApiTags('fhir')
@Controller('fhir/r4')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
export class FhirController {
  constructor(private readonly service: FhirService) {}

  // --- Patient ---
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
  createPatient(@Body(new ZodValidationPipe(CreatePatientSchema)) body: CreatePatientDto) {
    return this.service.createPatient(body)
  }

  @Put('Patient/:id')
  updatePatient(@Param('id') id: string, @Body(new ZodValidationPipe(UpdatePatientSchema)) body: UpdatePatientDto) {
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

  // --- Observation ---
  @Get('Observation/:id')
  readObservation(@Param('id') id: string) {
    return this.service.readObservation(id)
  }

  @Get('Observation')
  searchObservation(@Query('patient') patient?: string, @Query('_count') _count?: string) {
    return this.service.searchObservation({ patient, _count })
  }

  // --- DiagnosticReport ---
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

  // --- ImagingStudy ---
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

  // --- Subscription ---
  @Post('Subscription')
  @HttpCode(HttpStatus.CREATED)
  createSubscription(@Body(new ZodValidationPipe(CreateSubscriptionSchema)) body: CreateSubscriptionDto) {
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

  // --- Bulk Data Export ---
  @Get('$export')
  async bulkExport(
    @Query('_outputFormat') _outputFormat?: string,
    @Query('_since') _since?: string,
    @Query('_type') _type?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const { jobId } = await this.service.bulkExport(_outputFormat, _since, _type)
    if (res) {
      res.setHeader('Content-Location', `/fhir/r4/$export-status/${jobId}`)
    }
    return { jobId, statusCode: 202 }
  }

  @Get('$export-status/:jobId')
  async bulkExportStatus(@Param('jobId') jobId: string, @Res({ passthrough: true }) res: Response) {
    const result = await this.service.bulkExportStatus(jobId)
    res.setHeader('Content-Type', typeof result === 'string' ? 'application/fhir+ndjson' : 'application/json')
    if (typeof result === 'string') {
      res.setHeader('Content-Disposition', 'attachment; filename="export.ndjson"')
    }
    return result
  }
}
