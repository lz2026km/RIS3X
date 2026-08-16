/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 7C (consultation-v2) - 委员会会诊 V2 控制器
 * 端点 (全部 200, 孤儿模块可无 DB 启动, seed 回退):
 *   - POST /consultation-v2/rooms                      创建会诊室 (多人会话)
 *   - GET  /consultation-v2/rooms                      会诊室列表
 *   - GET  /consultation-v2/rooms/:id                  会诊室详情 (成员/角色/状态)
 *   - POST /consultation-v2/rooms/:id/start            开始会诊
 *   - POST /consultation-v2/rooms/:id/messages         发言 (时序流)
 *   - GET  /consultation-v2/rooms/:id/messages         发言流 (按 seq 升序)
 *   - POST /consultation-v2/rooms/:id/votes            投票 (通过/驳回/修改)
 *   - GET  /consultation-v2/rooms/:id/summary          意见汇总 (投票统计)
 *   - POST /consultation-v2/rooms/:id/conclude         生成结论 (最终意见 + 签名列表)
 *   - GET  /consultation-v2/rooms/:id/export           会诊记录导出
 *   - GET  /consultation-v2/stats                      会诊统计
 */
import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ConsultationV2Service, VoteOpinion } from './consultation-v2.service'

const CreateRoomSchema = z.object({
  reportId: z.string().min(1),
  reportTitle: z.string().optional(),
  patientName: z.string().optional(),
  modality: z.string().optional(),
  createdBy: z.string().optional(),
  memberCount: z.number().int().min(3).max(6).optional(),
  memberIds: z.array(z.string().min(1)).min(1).optional(),
})

const MessageSchema = z.object({
  memberId: z.string().min(1),
  content: z.string().min(1),
})

const VoteSchema = z.object({
  memberId: z.string().min(1),
  opinion: z.enum(['approve', 'reject', 'modify']),
  comment: z.string().optional(),
})

const ConcludeSchema = z.object({
  finalOpinion: z.string().optional(),
  generatedBy: z.string().optional(),
})

@ApiTags('consultation-v2')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('consultation-v2')
export class ConsultationV2Controller {
  constructor(private readonly service: ConsultationV2Service) {}

  @Post('rooms')
  @HttpCode(200)
  createRoom(@Body(new ZodValidationPipe(CreateRoomSchema)) body: z.infer<typeof CreateRoomSchema>) {
    return { success: true, data: this.service.createRoom(body) }
  }

  @Get('rooms')
  listRooms() {
    return { success: true, data: this.service.listRooms() }
  }

  @Get('stats')
  getStats() {
    return { success: true, data: this.service.getStats() }
  }

  @Get('rooms/:id')
  getRoom(@Param('id') id: string) {
    return { success: true, data: this.service.getRoom(id) }
  }

  @Post('rooms/:id/start')
  @HttpCode(200)
  startRoom(@Param('id') id: string) {
    return { success: true, data: this.service.startRoom(id) }
  }

  @Post('rooms/:id/messages')
  @HttpCode(200)
  sendMessage(@Param('id') id: string, @Body(new ZodValidationPipe(MessageSchema)) body: z.infer<typeof MessageSchema>) {
    return { success: true, data: this.service.sendMessage(id, body) }
  }

  @Get('rooms/:id/messages')
  listMessages(@Param('id') id: string) {
    return { success: true, data: this.service.listMessages(id) }
  }

  @Post('rooms/:id/votes')
  @HttpCode(200)
  vote(@Param('id') id: string, @Body(new ZodValidationPipe(VoteSchema)) body: z.infer<typeof VoteSchema>) {
    return { success: true, data: this.service.vote(id, body as { memberId: string; opinion: VoteOpinion; comment?: string }) }
  }

  @Get('rooms/:id/summary')
  voteSummary(@Param('id') id: string) {
    return { success: true, data: this.service.voteSummary(id) }
  }

  @Post('rooms/:id/conclude')
  @HttpCode(200)
  conclude(@Param('id') id: string, @Body(new ZodValidationPipe(ConcludeSchema)) body: z.infer<typeof ConcludeSchema>) {
    return { success: true, data: this.service.conclude(id, body) }
  }

  @Get('rooms/:id/export')
  exportRecord(@Param('id') id: string) {
    return { success: true, data: this.service.exportRecord(id) }
  }
}
