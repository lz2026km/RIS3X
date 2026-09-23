/**
 * G005 放射RIS系统 - 骨科影像分析 (ortho-specialty) 控制器
 * 前端 orthoSpecialtyApi 调用的 2 个端点。
 */
import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { OrthoSpecialtyService, type OrthoStudy } from './ortho-specialty.service'

const LooseBodySchema = z.object({}).passthrough()

@ApiTags('ortho-specialty')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('ortho-specialty')
export class OrthoSpecialtyController {
  constructor(private readonly service: OrthoSpecialtyService) {}

  @Get('studies')
  listStudies() {
    return this.service.listStudies()
  }

  @Post('studies')
  @HttpCode(201)
  createStudy(@Body(new ZodValidationPipe(LooseBodySchema)) body: Partial<OrthoStudy>) {
    return this.service.createStudy(body)
  }
}
