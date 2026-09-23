/**
 * G005 放射RIS系统 - AI 融合工作站 (ai/fusion-workspace) 控制器
 * 前端 aiFusionWorkspaceApi 调用的 4 个端点。
 */
import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AiFusionWorkspaceService } from './ai-fusion-workspace.service'

const LooseBodySchema = z.object({ studyId: z.string().optional() }).passthrough()

@ApiTags('ai-fusion-workspace')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('ai/fusion-workspace')
export class AiFusionWorkspaceController {
  constructor(private readonly service: AiFusionWorkspaceService) {}

  @Get()
  getWorkspace(@Query('modality') modality?: string) {
    return this.service.getWorkspace(modality)
  }

  @Get('studies')
  listStudies() {
    return this.service.listStudies()
  }

  @Get('insights')
  listInsights() {
    return this.service.listInsights()
  }

  @Post('run')
  @HttpCode(201)
  runFusion(@Body(new ZodValidationPipe(LooseBodySchema)) body: { studyId?: string }) {
    return this.service.runFusion(body?.studyId)
  }
}
