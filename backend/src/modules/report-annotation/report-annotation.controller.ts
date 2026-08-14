/**
 * G005 放射RIS系统 v3.0.6.11-99 Wave 2A (报告批注) - 报告批注控制器
 * 端点:
 *   - GET    /report-annotations?reportId=   批注列表
 *   - POST   /report-annotations             新建批注 (author 取自 JWT/当前用户)
 *   - PATCH  /report-annotations/:id         编辑批注
 *   - DELETE /report-annotations/:id         删除批注
 *   - POST   /report-annotations/:id/reply   回复 (嵌套 1 层)
 *   - POST   /report-annotations/:id/resolve 解决
 *   - POST   /report-annotations/:id/reopen  重开
 *   - GET    /report-annotations/stats?reportId= 统计 (总数/未解决/按作者)
 */
import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import {
  ReportAnnotationService,
  type ReportAnnotationActor,
} from './report-annotation.service'

const CreateSchema = z.object({
  reportId: z.string().min(1),
  content: z.string().min(2),
  quote: z.string().max(500).optional(),
  authorName: z.string().max(64).optional(),
})

const UpdateSchema = z.object({
  content: z.string().min(2),
})

const ReplySchema = z.object({
  content: z.string().min(2),
  authorName: z.string().max(64).optional(),
})

const ResolveSchema = z.object({
  resolution: z.string().max(500).optional(),
})

type AuthRequest = { user?: { sub?: string; username?: string } }

@ApiTags('report-annotation')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller()
export class ReportAnnotationController {
  constructor(private readonly service: ReportAnnotationService) {}

  private actor(req: AuthRequest, name?: string): ReportAnnotationActor {
    return {
      id: req.user?.sub ?? 'anonymous',
      name: (name && name.trim()) || req.user?.username || '当前用户',
    }
  }

  @Get('report-annotations')
  list(@Query('reportId') reportId?: string) {
    const rid = String(reportId ?? '').trim()
    if (!rid) throw new BadRequestException('reportId 必填')
    return this.service.list(rid)
  }

  @Get('report-annotations/stats')
  stats(@Query('reportId') reportId?: string) {
    const rid = String(reportId ?? '').trim()
    if (!rid) throw new BadRequestException('reportId 必填')
    return this.service.stats(rid)
  }

  @Post('report-annotations')
  create(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(CreateSchema)) body: z.infer<typeof CreateSchema>,
  ) {
    return this.service.create(body, this.actor(req, body.authorName))
  }

  @Patch('report-annotations/:id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSchema)) body: z.infer<typeof UpdateSchema>,
  ) {
    return this.service.update(id, body)
  }

  @Delete('report-annotations/:id')
  remove(@Param('id') id: string) {
    this.service.remove(id)
    return { success: true }
  }

  @Post('report-annotations/:id/reply')
  reply(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(ReplySchema)) body: z.infer<typeof ReplySchema>,
  ) {
    return this.service.reply(id, body.content, this.actor(req, body.authorName))
  }

  @Post('report-annotations/:id/resolve')
  resolve(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(ResolveSchema)) body: z.infer<typeof ResolveSchema>,
  ) {
    return this.service.resolve(id, body.resolution, this.actor(req))
  }

  @Post('report-annotations/:id/reopen')
  reopen(@Param('id') id: string) {
    return this.service.reopen(id)
  }
}
