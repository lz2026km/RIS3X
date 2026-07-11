import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ExamService, type CreateExamDto, type UpdateExamDto } from './exam.service'

const CreateExamSchema = z.object({
  patientId: z.string().min(1),
  accessionNumber: z.string().min(1),
  modality: z.string().min(1),
  bodyPart: z.string().min(1),
  scheduledAt: z.string().datetime().optional(),
  deviceId: z.string().optional(),
})

const UpdateExamSchema = z.object({
  state: z.string().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  deviceId: z.string().optional(),
})

@ApiTags('exams')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('exams')
export class ExamController {
  constructor(private readonly service: ExamService) {}

  @Get()
  list(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('patientId') patientId?: string,
    @Query('modality') modality?: string,
    @Query('state') state?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.list({
      skip: Number(skip ?? 0),
      take: Number(take ?? 50),
      patientId, modality, state, dateFrom, dateTo,
    })
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreateExamSchema)) body: CreateExamDto) {
    return this.service.create(body)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateExamSchema)) body: UpdateExamDto) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id)
  }
}
