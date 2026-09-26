import { Controller, Get, Post, Put, Param, Body, Query, Req } from '@nestjs/common'
import type { Request } from 'express'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { AmendService, AmendActor } from './amend.service'
import { StartAmendmentSchema, UpdateAmendmentSchema, CompleteAmendmentSchema, ApproveAmendmentSchema, RejectAmendmentSchema, SupplementAmendmentSchema } from './amend.schema'
import { z } from 'zod'

type StartAmendmentDto = z.infer<typeof StartAmendmentSchema>
type UpdateAmendmentDto = z.infer<typeof UpdateAmendmentSchema>
type CompleteAmendmentDto = z.infer<typeof CompleteAmendmentSchema>
type ApproveAmendmentDto = z.infer<typeof ApproveAmendmentSchema>
type RejectAmendmentDto = z.infer<typeof RejectAmendmentSchema>
type SupplementAmendmentDto = z.infer<typeof SupplementAmendmentSchema>

@ApiTags('amend')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('amend')
export class AmendController {
  constructor(private readonly svc: AmendService) {}

  /** [G005 W8-Report] actor 来自请求 (JWT), 不再硬编码 */
  private actorFrom(req: Request): AmendActor {
    const u = req.user as { id?: string; name?: string; fullName?: string; username?: string } | undefined
    return { id: u?.id ?? 'unknown', name: u?.name ?? u?.fullName ?? u?.username }
  }

  @Get()
  listAmendments(
    @Query('status') status?: string,
    @Query('reportId') reportId?: string,
    @Query('kind') kind?: 'amend' | 'supplement',
    @Query('pageSize') pageSize?: string,
  ) {
    return this.svc.listAmendments({ status, reportId, kind, pageSize: pageSize ? Number(pageSize) : undefined })
  }

  @Get(':id')
  getAmendment(@Param('id') id: string) {
    return this.svc.getAmendment(id)
  }

  @Post('start')
  startAmendment(@Body(new ZodValidationPipe(StartAmendmentSchema)) body: StartAmendmentDto, @Req() req: Request) {
    return this.svc.startAmendment(body, this.actorFrom(req))
  }

  // [G005 W8-Report] 补发: 创建与父报告关联的独立文档
  @Post('supplement')
  createSupplement(@Body(new ZodValidationPipe(SupplementAmendmentSchema)) body: SupplementAmendmentDto, @Req() req: Request) {
    return this.svc.createSupplement(body, this.actorFrom(req))
  }

  @Get('supplements/:parentReportId')
  listSupplements(@Param('parentReportId') parentReportId: string) {
    return this.svc.listSupplements(parentReportId)
  }

  @Put(':id')
  updateAmendment(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateAmendmentSchema)) body: UpdateAmendmentDto, @Req() req: Request) {
    return this.svc.updateAmendment(id, body, this.actorFrom(req))
  }

  @Post(':id/complete')
  completeAmendment(@Param('id') id: string, @Body(new ZodValidationPipe(CompleteAmendmentSchema)) body: CompleteAmendmentDto, @Req() req: Request) {
    return this.svc.completeAmendment(id, body, this.actorFrom(req))
  }

  @Post(':id/approve')
  approveAmendment(@Param('id') id: string, @Body(new ZodValidationPipe(ApproveAmendmentSchema)) body: ApproveAmendmentDto, @Req() req: Request) {
    return this.svc.approveAmendment(id, body, this.actorFrom(req))
  }

  @Post(':id/reject')
  rejectAmendment(@Param('id') id: string, @Body(new ZodValidationPipe(RejectAmendmentSchema)) body: RejectAmendmentDto, @Req() req: Request) {
    return this.svc.rejectAmendment(id, body, this.actorFrom(req))
  }
}
