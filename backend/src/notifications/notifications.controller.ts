/**
 * G005 RIS v3.0.6.11-32 - Notifications Controller
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
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

const PushSubscriptionSchema = z.object({
  userId: z.string().min(1),
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
})

@ApiTags('notifications')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
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
  @HttpCode(HttpStatus.CREATED)
  broadcast(@Body(new ZodValidationPipe(BroadcastSchema)) body: z.infer<typeof BroadcastSchema>) {
    const { userIds, ...dto } = body
    return this.service.broadcast(userIds, dto)
  }

  @Post('push-subscribe')
  @HttpCode(HttpStatus.CREATED)
  pushSubscribe(@Body(new ZodValidationPipe(PushSubscriptionSchema)) body: { userId: string; endpoint: string; keys: { p256dh: string; auth: string } }) {
    return this.service.savePushSubscription(body.userId, body)
  }
}
