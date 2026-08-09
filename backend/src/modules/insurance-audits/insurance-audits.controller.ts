import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { InsuranceAuditsService } from './insurance-audits.service'

// [G005 Wave1A] 医保审核模块 (前端 insuranceApi: 与 datareport GET /data-report/insurance-audits 同表, 补写操作)

const CreateSchema = z.object({
  examId: z.string().optional(),
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  examItem: z.string().optional(),
  contrastAgent: z.string().optional(),
  anticoagulant: z.string().optional(),
  amount: z.number().optional(),
  reason: z.string().optional(),
})

const RejectSchema = z.object({ reason: z.string().min(1) })

const ApproveSchema = z.object({ auditor: z.string().optional() })

@ApiTags('insurance-audits')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('insurance-audits')
export class InsuranceAuditsController {
  constructor(private readonly service: InsuranceAuditsService) {}

  @Get()
  @ApiOperation({ summary: '医保审核记录列表' })
  list(@Query('status') status?: string) {
    return this.service.list(status)
  }

  @Get(':id')
  @ApiOperation({ summary: '医保审核记录详情' })
  getById(@Param('id') id: string) {
    return this.service.getById(id)
  }

  @Post()
  @ApiOperation({ summary: '创建医保审核记录' })
  create(@Body(new ZodValidationPipe(CreateSchema)) body: z.infer<typeof CreateSchema>) {
    return this.service.create(body)
  }

  @Post(':id/approve')
  @ApiOperation({ summary: '审核通过' })
  approve(@Param('id') id: string, @Body(new ZodValidationPipe(ApproveSchema)) body: z.infer<typeof ApproveSchema>) {
    return this.service.approve(id, body.auditor)
  }

  @Post(':id/reject')
  @ApiOperation({ summary: '审核拒绝' })
  reject(@Param('id') id: string, @Body(new ZodValidationPipe(RejectSchema)) body: z.infer<typeof RejectSchema>) {
    return this.service.reject(id, body.reason)
  }
}
