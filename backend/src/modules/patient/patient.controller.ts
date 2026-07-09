import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { PatientService, type CreatePatientDto, type UpdatePatientDto } from './patient.service'

const CreatePatientSchema = z.object({
  name: z.string().min(1).max(64),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  birthDate: z.string().datetime().optional(),
  idCard: z.string().length(18).optional(),
  phone: z.string().regex(/^1[3-9]\d{9}$/).optional(),
  type: z.enum(['OUTPATIENT', 'INPATIENT', 'EMERGENCY', 'PHYSICAL']).default('OUTPATIENT'),
})

const UpdatePatientSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  birthDate: z.string().datetime().optional(),
  idCard: z.string().length(18).optional(),
  phone: z.string().regex(/^1[3-9]\d{9}$/).optional(),
  type: z.enum(['OUTPATIENT', 'INPATIENT', 'EMERGENCY', 'PHYSICAL']).optional(),
})

@ApiTags('patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientController {
  constructor(private readonly service: PatientService) {}

  @Get()
  list(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('name') name?: string,
    @Query('phone') phone?: string,
  ) {
    return this.service.list({
      skip: Number(skip ?? 0),
      take: Number(take ?? 50),
      name,
      phone,
    })
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreatePatientSchema)) body: CreatePatientDto) {
    return this.service.create(body)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdatePatientSchema)) body: UpdatePatientDto) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id)
  }

  @Get(':id/reports')
  getReports(@Param('id') id: string) {
    return this.service.getReports(id)
  }
}
