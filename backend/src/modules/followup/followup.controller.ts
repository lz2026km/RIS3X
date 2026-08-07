import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { FollowUpService } from './followup.service'
import {
  CreateFollowUpPlanSchema,
  ListFollowUpQuerySchema,
  UpdateFollowUpPlanSchema,
} from './followup.schema'
import type { z } from 'zod'

type CreateDto = z.infer<typeof CreateFollowUpPlanSchema>
type UpdateDto = z.infer<typeof UpdateFollowUpPlanSchema>
type ListQuery = z.infer<typeof ListFollowUpQuerySchema>

@ApiTags('followups')
@ApiBearerAuth()
@Roles('DOCTOR', 'DIRECTOR', 'ADMIN', 'TECHNICIAN', 'NURSE')
@Controller('followups')
export class FollowUpController {
  constructor(private readonly svc: FollowUpService) {}

  // ⚠️ 静态子路由 (due) 必须先于 :id, 避免被 :id 通配拦截
  @Get('due')
  due(@Query('days') days?: string) {
    return this.svc.due(Number(days ?? 7))
  }

  @Get()
  list(@Query() query: ListQuery) {
    const parsed = ListFollowUpQuerySchema.safeParse(query)
    return this.svc.list(parsed.success ? parsed.data : {})
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body(new ZodValidationPipe(CreateFollowUpPlanSchema)) body: CreateDto) {
    return this.svc.create(body)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateFollowUpPlanSchema)) body: UpdateDto) {
    return this.svc.update(id, body)
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.svc.complete(id)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id)
  }
}
