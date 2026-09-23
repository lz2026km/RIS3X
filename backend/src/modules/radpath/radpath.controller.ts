import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { RadPathService, type CreateRadPathDto, type UpdateConsistencyDto } from './radpath.service'

const CreateRadPathSchema = z.object({
  reportId: z.string().min(1),
  pathologyId: z.string().min(1),
  radFinding: z.string().min(1).max(2000),
  pathResult: z.string().min(1).max(2000),
  consistency: z.enum(['concordant', 'discordant', 'pending']),
  notes: z.string().max(1000).optional(),
})

const UpdateConsistencySchema = z.object({
  id: z.string().min(1),
  consistency: z.enum(['concordant', 'discordant', 'pending']),
  notes: z.string().max(1000).optional(),
})

@ApiTags('radpath')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('radpath')
export class RadPathController {
  constructor(private readonly service: RadPathService) {}

  @Post('create')
  create(@Body(new ZodValidationPipe(CreateRadPathSchema)) body: CreateRadPathDto) {
    return this.service.create(body)
  }

  @Get('report/:reportId')
  findByReport(@Param('reportId') reportId: string) {
    return this.service.findByReport(reportId)
  }

  @Get('pathology/:pathId')
  findByPathology(@Param('pathId') pathId: string) {
    return this.service.findByPathology(pathId)
  }

  @Put('consistency')
  updateConsistency(@Body(new ZodValidationPipe(UpdateConsistencySchema)) body: UpdateConsistencyDto) {
    return this.service.updateConsistency(body)
  }

  @Get('records')
  listRecords() {
    return this.service.listRecords()
  }

  @Get('stats')
  getStats() {
    return this.service.getStats()
  }
}
