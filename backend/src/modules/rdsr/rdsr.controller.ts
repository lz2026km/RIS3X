import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { RdsrService } from './rdsr.service'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'

const ParseSchema = z.object({ dicomJson: z.record(z.unknown()).optional(), modality: z.string().min(1).optional(), patientId: z.string().optional(), patientName: z.string().optional(), examDate: z.string().optional() }).refine((value) => value.dicomJson !== undefined || value.modality !== undefined, { message: 'dicomJson or modality is required' })

const DrlUpsertSchema = z.object({
  bodyPart: z.string().min(1),
  modality: z.string().min(1).optional(),
  ctdivolDrl: z.number().positive().optional(),
  dlpDrl: z.number().positive().optional(),
  source: z.string().optional(),
}).refine((value) => value.ctdivolDrl !== undefined || value.dlpDrl !== undefined, { message: 'ctdivolDrl or dlpDrl is required' })

@ApiTags('rdsr')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'TECHNICIAN')
@Controller('rdsr')
export class RdsrController {
  constructor(private readonly svc: RdsrService) {}

  @Post('parse')
  parse(@Body(new ZodValidationPipe(ParseSchema)) body: { dicomJson?: Record<string, unknown>; modality?: string; patientId?: string; patientName?: string; examDate?: string }) {
    return this.svc.parse(body)
  }

  @Get('drl')
  getDrl(@Query('modality') modality?: string, @Query('bodyPart') bodyPart?: string) {
    return this.svc.getDrls(modality, bodyPart)
  }

  @Get('drls')
  getDrls(@Query('modality') modality?: string, @Query('bodyPart') bodyPart?: string) {
    return this.svc.getDrls(modality, bodyPart)
  }

  @Post('drl')
  setDrl(@Body(new ZodValidationPipe(DrlUpsertSchema)) body: { bodyPart: string; modality?: string; ctdivolDrl?: number; dlpDrl?: number; source?: string }) {
    return this.svc.setDrl(body)
  }

  @Get('today')
  getToday() {
    return this.svc.getTodayStats()
  }

  @Get('stats')
  getStats(@Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string, @Query('modality') modality?: string) {
    return this.svc.getStats(dateFrom, dateTo, modality)
  }

  @Get('patients')
  searchPatients(@Query('search') search?: string) {
    return this.svc.searchPatients(search)
  }

  @Get('patients/:id/cumulative')
  getPatientCumulative(@Param('id') id: string) {
    return this.svc.getPatientCumulative(id)
  }

  @Get('alerts')
  getAlerts(@Query('status') status?: string) {
    return this.svc.getAlerts(status)
  }

  @Post('alerts/:id/ack')
  ackAlert(@Param('id') id: string) {
    return this.svc.ackAlert(id)
  }
}
