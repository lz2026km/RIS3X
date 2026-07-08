import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { FhirService } from './fhir.service'

@ApiTags('fhir')
@Controller('fhir')
export class FhirController {
  constructor(private readonly service: FhirService) {}

  // Patient ──────────────────────────────────────────────
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

  // Observation ──────────────────────────────────────────
  @Get('Observation/:id')
  readObservation(@Param('id') id: string) {
    return this.service.readObservation(id)
  }

  @Get('Observation')
  searchObservation(@Query('patient') patient?: string, @Query('_count') _count?: string) {
    return this.service.searchObservation({ patient, _count })
  }

  // DiagnosticReport ─────────────────────────────────────
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

  // ImagingStudy ─────────────────────────────────────────
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
}
