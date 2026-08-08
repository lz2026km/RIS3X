/**
 * G005 放射RIS系统 v3.0.6.11-80 - 叫号队列控制器 (W1-A, P0)
 * 端点:
 * - GET  /queue            候诊队列列表
 * - GET  /queue/rooms      叫号房间列表
 * - GET  /queue/:roomId    房间当前队列
 * - GET  /queue/:roomId/status 房间状态
 * - POST /queue/:roomId/call    叫号 (body: { examId | patientId })
 * - POST /queue/:roomId/complete 完成当前号
 * - POST /queue/:roomId/recall   重呼
 */
import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { QueueService } from './queue.service'

// 前端 queueApi.call(id) 不带 body (id 在路径中); body 可选用于按 examId/patientId 叫号
const CallSchema = z
  .object({
    examId: z.string().min(1).optional(),
    patientId: z.string().min(1).optional(),
  })
  .optional()

@ApiTags('queue')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'TECHNICIAN', 'DOCTOR')
@Controller('queue')
export class QueueController {
  constructor(private readonly service: QueueService) {}

  @Get()
  list() {
    return this.service.list()
  }

  @Get('rooms')
  getRooms() {
    return this.service.rooms()
  }

  @Get(':roomId')
  getRoomQueue(@Param('roomId') roomId: string) {
    return this.service.roomQueue(roomId)
  }

  @Get(':roomId/status')
  getRoomStatus(@Param('roomId') roomId: string) {
    return this.service.roomStatus(roomId)
  }

  @Post(':roomId/call')
  call(
    @Param('roomId') roomId: string,
    @Body(new ZodValidationPipe(CallSchema)) body?: z.infer<typeof CallSchema>,
  ) {
    return this.service.call(roomId, body ?? {})
  }

  @Post(':roomId/complete')
  complete(@Param('roomId') roomId: string) {
    return this.service.complete(roomId)
  }

  @Post(':roomId/recall')
  recall(@Param('roomId') roomId: string) {
    return this.service.recall(roomId)
  }
}
