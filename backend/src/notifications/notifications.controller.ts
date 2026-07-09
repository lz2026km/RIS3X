/**
 * G005 鏀惧皠RIS绯荤粺 v3.0.2.2 - 閫氱煡鎺у埗鍣?
 * 4 绔偣
 */
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { NotificationsService, CreateNotificationDto } from './notifications.service'

const CreateSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(['CRITICAL', 'REPORT', 'TASK', 'SYSTEM', 'APPOINTMENT']),
  severity: z.enum(['INFO', 'WARN', 'ERROR', 'CRITICAL']).optional(),
  title: z.string().min(1),
  content: z.string().min(1),
  link: z.string().optional(),
  targetId: z.string().optional(),
})

const BroadcastSchema = z.object({
  userIds: z.array(z.string()).min(1),
  type: z.enum(['CRITICAL', 'REPORT', 'TASK', 'SYSTEM', 'APPOINTMENT']),
  severity: z.enum(['INFO', 'WARN', 'ERROR', 'CRITICAL']).optional(),
  title: z.string().min(1),
  content: z.string().min(1),
  link: z.string().optional(),
  targetId: z.string().optional(),
})

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get('unread/:userId')
  unread(@Param('userId') userId: string) {
    return this.service.getUnreadCount(userId)
  }

  @Get('history/:userId')
  history(@Param('userId') userId: string, @Query('limit') limit?: string) {
    return this.service.getHistory(userId, Number(limit ?? 50))
  }

  @Post('read/:id')
  read(@Param('id') id: string) {
    return this.service.markRead(id)
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreateSchema)) body: CreateNotificationDto) {
    return this.service.create(body)
  }

  @Post('broadcast')
  broadcast(@Body(new ZodValidationPipe(BroadcastSchema)) body: any) {
    const { userIds, ...dto } = body
    return this.service.broadcast(userIds, dto)
  }

  @Post('push-subscribe')
  pushSubscribe(@Body() body: { userId: string; endpoint: string; keys: { p256dh: string; auth: string } }) {
    return this.service.savePushSubscription(body.userId, body)
  }
}
