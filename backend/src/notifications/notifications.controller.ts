/**
 * G005 RIS v3.0.6.11-33 - Notifications Controller
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, ServiceUnavailableException } from '@nestjs/common'
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
  topics: z.array(z.string()).optional(),
})

const PushUnsubscribeSchema = z.object({
  endpoint: z.string().url(),
})

const PushSendSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  url: z.string().optional(),
  tag: z.string().optional(),
  requireInteraction: z.boolean().optional(),
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
  pushSubscribe(@Body(new ZodValidationPipe(PushSubscriptionSchema)) body: { userId: string; endpoint: string; keys: { p256dh: string; auth: string }; topics?: string[] }) {
    return this.service.savePushSubscription(body.userId, body)
  }

  @Post('push-unsubscribe')
  @HttpCode(HttpStatus.OK)
  pushUnsubscribe(@Body(new ZodValidationPipe(PushUnsubscribeSchema)) body: { endpoint: string }) {
    return this.service.removePushSubscription(body.endpoint)
  }

  @Get('vapid-public-key')
  vapidPublicKey() {
    const publicKey = this.service.getVapidPublicKey()
    if (!publicKey) {
      throw new ServiceUnavailableException({
        publicKey: null,
        error: 'VAPID 未配置: 请设置 VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY 环境变量后重启服务',
      })
    }
    return { publicKey }
  }

  @Post('push-send')
  @HttpCode(HttpStatus.OK)
  pushSend(@Body(new ZodValidationPipe(PushSendSchema)) body: { userId: string; title: string; content: string; url?: string; tag?: string; requireInteraction?: boolean }) {
    return this.service.sendPush(body.userId, body)
  }
}
