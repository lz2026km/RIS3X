import { Controller, Get, Post, Put, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { AmendService } from './amend.service'
import { StartAmendmentSchema, UpdateAmendmentSchema, CompleteAmendmentSchema, ApproveAmendmentSchema, RejectAmendmentSchema } from './amend.schema'
import { z } from 'zod'

type StartAmendmentDto = z.infer<typeof StartAmendmentSchema>
type UpdateAmendmentDto = z.infer<typeof UpdateAmendmentSchema>
type CompleteAmendmentDto = z.infer<typeof CompleteAmendmentSchema>
type ApproveAmendmentDto = z.infer<typeof ApproveAmendmentSchema>
type RejectAmendmentDto = z.infer<typeof RejectAmendmentSchema>

@ApiTags('amend')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('amend')
export class AmendController {
  constructor(private readonly svc: AmendService) {}

  @Get()
  listAmendments(@Query('status') status?: string, @Query('reportId') reportId?: string, @Query('pageSize') pageSize?: string) {
    return this.svc.listAmendments({ status, reportId, pageSize: pageSize ? Number(pageSize) : undefined })
  }

  @Get(':id')
  getAmendment(@Param('id') id: string) {
    return this.svc.getAmendment(id)
  }

  @Post('start')
  startAmendment(@Body(new ZodValidationPipe(StartAmendmentSchema)) body: StartAmendmentDto) {
    return this.svc.startAmendment(body)
  }

  @Put(':id')
  updateAmendment(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateAmendmentSchema)) body: UpdateAmendmentDto) {
    return this.svc.updateAmendment(id, body)
  }

  @Post(':id/complete')
  completeAmendment(@Param('id') id: string, @Body(new ZodValidationPipe(CompleteAmendmentSchema)) body: CompleteAmendmentDto) {
    return this.svc.completeAmendment(id, body)
  }

  @Post(':id/approve')
  approveAmendment(@Param('id') id: string, @Body(new ZodValidationPipe(ApproveAmendmentSchema)) body: ApproveAmendmentDto) {
    return this.svc.approveAmendment(id, body)
  }

  @Post(':id/reject')
  rejectAmendment(@Param('id') id: string, @Body(new ZodValidationPipe(RejectAmendmentSchema)) body: RejectAmendmentDto) {
    return this.svc.rejectAmendment(id, body)
  }
}
