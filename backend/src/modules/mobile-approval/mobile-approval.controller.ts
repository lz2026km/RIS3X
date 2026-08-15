// [G005 v3.0.6.11-100 Wave 4A] 移动审批控制器
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { z } from 'zod'
import { MobileApprovalService, type ApproveDto, type DelegateDto, type RejectDto } from './mobile-approval.service'

const ApproveSchema = z.object({ comment: z.string().max(500).optional() })

const RejectSchema = z.object({ reason: z.string().min(1).max(500) })

const DelegateSchema = z.object({ toUserId: z.string().min(1).max(64) })

@ApiTags('mobile-approval')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('mobile-approval')
export class MobileApprovalController {
  constructor(private readonly service: MobileApprovalService) {}

  @Get('pending')
  @ApiOperation({ summary: '待审批列表 (报告签发/发布/危急值处置/费用/请假, 逾期优先)' })
  pending() {
    return this.service.listPending()
  }

  @Get('history')
  @ApiOperation({ summary: '已审批历史 (通过/驳回)' })
  history() {
    return this.service.history()
  }

  @Get('stats')
  @ApiOperation({ summary: '审批统计: 待审/已审/委派中/逾期' })
  stats() {
    return this.service.getStats()
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '通过审批' })
  approve(@Param('id') id: string, @Body(new ZodValidationPipe(ApproveSchema)) dto: z.infer<typeof ApproveSchema>) {
    return this.service.approve(id, dto as ApproveDto)
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '驳回审批 (需填写原因)' })
  reject(@Param('id') id: string, @Body(new ZodValidationPipe(RejectSchema)) dto: z.infer<typeof RejectSchema>) {
    return this.service.reject(id, dto as RejectDto)
  }

  @Post(':id/delegate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '委派他人处理' })
  delegate(@Param('id') id: string, @Body(new ZodValidationPipe(DelegateSchema)) dto: z.infer<typeof DelegateSchema>) {
    return this.service.delegate(id, dto as DelegateDto)
  }
}
