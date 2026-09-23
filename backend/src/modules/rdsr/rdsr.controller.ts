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
  ageGroup: z.enum(['adult', 'child']).optional(),
}).refine((value) => value.ctdivolDrl !== undefined || value.dlpDrl !== undefined, { message: 'ctdivolDrl or dlpDrl is required' })

const DrlCheckRecordSchema = z.object({
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  modality: z.string().min(1),
  bodyPart: z.string().min(1),
  ctdivol: z.number().nonnegative().optional(),
  dlp: z.number().nonnegative().optional(),
  ssde: z.number().nonnegative().optional(),
  examDate: z.string().optional(),
  age: z.number().int().nonnegative().optional(),
  ageGroup: z.enum(['adult', 'child']).optional(),
})

const DrlCheckSchema = z.object({
  records: z.array(DrlCheckRecordSchema),
})

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
  getDrl(@Query('modality') modality?: string, @Query('bodyPart') bodyPart?: string, @Query('ageGroup') ageGroup?: 'adult' | 'child') {
    return this.svc.getDrls(modality, bodyPart, ageGroup)
  }

  @Get('drls')
  getDrls(@Query('modality') modality?: string, @Query('bodyPart') bodyPart?: string, @Query('ageGroup') ageGroup?: 'adult' | 'child') {
    return this.svc.getDrls(modality, bodyPart, ageGroup)
  }

  @Post('drl')
  setDrl(@Body(new ZodValidationPipe(DrlUpsertSchema)) body: { bodyPart: string; modality?: string; ctdivolDrl?: number; dlpDrl?: number; source?: string; ageGroup?: 'adult' | 'child' }) {
    return this.svc.setDrl(body)
  }

  @Post('check')
  check(@Body(new ZodValidationPipe(DrlCheckSchema)) body: { records: { patientId?: string; patientName?: string; modality: string; bodyPart: string; ctdivol?: number; dlp?: number; ssde?: number; examDate?: string; age?: number; ageGroup?: 'adult' | 'child' }[] }) {
    return this.svc.check(body.records)
  }

  @Get('today')
  getToday() {
    return this.svc.getTodayStats()
  }

  @Get('stats')
  getStats(@Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string, @Query('modality') modality?: string) {
    return this.svc.getStats(dateFrom, dateTo, modality)
  }

  // [G005 W3-BackendParity] 儿童剂量记录 (前端 rdsrApi.getPediatric)
  @Get('pediatric')
  getPediatric() {
    return this.svc.getPediatric()
  }

  // [G005 W8-Dose] 工作人员个人剂量监测记录 (前端 rdsrApi.getStaffDose)
  @Get('staff')
  getStaffDose() {
    return this.svc.getStaffDose()
  }

  // [G005 W8-Dose] 乳腺摄影 AGD 剂量记录 (前端 rdsrApi.getBreast)
  @Get('breast')
  getBreastDose() {
    return this.svc.getBreastDose()
  }

  // [G005 W8-Dose] 设备近 7 日剂量历史 (前端 rdsrApi.getDeviceHistory)
  @Get('device/:id/history')
  getDeviceHistory(@Param('id') id: string) {
    return this.svc.getDeviceHistory(id)
  }

  // [G005 W8-Dose] 剂量总览 (前端 rdsrApi.getOverview)
  @Get('overview')
  getDoseOverview() {
    return this.svc.getDoseOverview()
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
