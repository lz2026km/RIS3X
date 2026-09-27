/**
 * G005 放射RIS系统 v3.0.6.13 - CDS Hooks REST 端点
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { CdsHooksService, type CdsHookRequest } from './cds-hooks.service'

const HookRequestSchema = z.object({
  hook: z.enum(['order-select', 'order-sign']).optional(),
  hookInstance: z.string().optional(),
  context: z.record(z.unknown()).optional(),
  prefetch: z.record(z.unknown()).optional(),
})

const FeedbackSchema = z.object({
  serviceId: z.string().min(1),
  hook: z.enum(['order-select', 'order-sign']).optional(),
  cardUuid: z.string().optional(),
  outcome: z.string().min(1),
  overrideReason: z.union([z.string(), z.object({ code: z.string().optional(), display: z.string().optional() })]).optional(),
})

@ApiTags('cds-hooks')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'TECHNICIAN', 'DOCTOR')
@Controller('cds-services')
export class CdsHooksController {
  constructor(private readonly service: CdsHooksService) {}

  @Get()
  discovery() {
    return this.service.discovery()
  }

  @Post('feedback')
  @HttpCode(HttpStatus.CREATED)
  feedback(@Body(new ZodValidationPipe(FeedbackSchema)) body: z.infer<typeof FeedbackSchema>) {
    return this.service.recordFeedback(body)
  }

  @Get('feedback')
  listFeedback() {
    return this.service.listFeedback()
  }

  @Post(':serviceId')
  @HttpCode(HttpStatus.OK)
  invoke(
    @Param('serviceId') serviceId: string,
    @Body(new ZodValidationPipe(HookRequestSchema)) body: CdsHookRequest,
  ) {
    return this.service.invoke(serviceId, body)
  }
}
