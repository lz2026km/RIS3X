import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { EyeService } from './eye.service'
import { CreateEyeStudySchema } from './dto/create-eye.dto'
import type { CreateEyeStudyDto } from './dto/create-eye.dto'
import { UpdateEyeStudySchema } from './dto/update-eye.dto'
import type { UpdateEyeStudyDto } from './dto/update-eye.dto'

@ApiTags('eye')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('api/eye')
export class EyeController {
  constructor(private readonly eye: EyeService) {}

  @Get('studies')
  listStudies(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.eye.listStudies(Number(skip ?? 0), Number(take ?? 20))
  }

  @Get('studies/:id')
  getStudy(@Param('id') id: string) {
    return this.eye.getStudy(id)
  }

  @Post('studies')
  @HttpCode(HttpStatus.CREATED)
  createStudy(@Body(new ZodValidationPipe(CreateEyeStudySchema)) body: CreateEyeStudyDto) {
    return this.eye.createStudy(body)
  }

  @Put('studies/:id')
  updateStudy(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateEyeStudySchema)) body: UpdateEyeStudyDto) {
    return this.eye.updateStudy(id, body)
  }

  @Delete('studies/:id')
  deleteStudy(@Param('id') id: string) {
    return this.eye.deleteStudy(id)
  }

  @Get('patients/:patientId/studies')
  listStudiesByPatient(@Param('patientId') patientId: string) {
    return this.eye.listStudiesByPatient(patientId)
  }

  @Get('emr/:patientId')
  getEmr(@Param('patientId') patientId: string) {
    return this.eye.getEmr(patientId)
  }

  @Put('emr/:patientId')
  updateEmr(@Param('patientId') patientId: string, @Body() data: { notes?: string }) {
    return this.eye.updateEmr(patientId, data)
  }

  @Get('ai/models')
  listAiModels() {
    return this.eye.listAiModels()
  }

  @Post('ai/inferences')
  @HttpCode(HttpStatus.CREATED)
  createAiInference(@Body() data: { studyId: string; modelId: string; diagnosis: string; confidence: number; heatmapUrl?: string }) {
    return this.eye.createAiInference(data)
  }

  @Get('iol/lenses')
  listIolLenses() {
    return this.eye.listIolLenses()
  }

  @Post('iol/calculate/barrett')
  calculateBarrett(@Body() data: { lensId: string; axialLength: number; keratometry: number }) {
    return this.eye.calculateBarrett(data)
  }

  @Post('iol/calculate/kane')
  calculateKane(@Body() data: { lensId: string; axialLength: number; keratometry: number }) {
    return this.eye.calculateKane(data)
  }

  @Get('reports')
  listReports() {
    return this.eye.listReports()
  }

  @Post('reports')
  @HttpCode(HttpStatus.CREATED)
  generateReport(@Body() data: { studyId: string; template?: string }) {
    return this.eye.generateReport(data)
  }
}
