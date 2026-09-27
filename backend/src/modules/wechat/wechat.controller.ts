/**
 * [G005 W12-PatientService] 微信服务号 / 小程序控制器
 */
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import {
  WechatService,
  type WechatChannel,
  type WechatLogStatus,
  type WechatLogType,
  type WechatMenuButton,
} from './wechat.service'

const OAuthCallbackSchema = z.object({
  code: z.string().min(1),
  channel: z.enum(['SERVICE_ACCOUNT', 'MINI_PROGRAM']).optional(),
  state: z.string().optional(),
})

const BindSchema = z.object({
  openid: z.string().min(1),
  patientId: z.string().optional(),
  phone: z.string().optional(),
  idCard: z.string().optional(),
  empiId: z.string().optional(),
  name: z.string().optional(),
})

const PushSchema = z.object({
  openid: z.string().min(1),
  title: z.string().optional(),
  content: z.string().min(1),
  channel: z.enum(['SERVICE_ACCOUNT', 'MINI_PROGRAM']).optional(),
})

const TemplateSendSchema = z.object({
  openid: z.string().min(1),
  templateId: z.string().min(1),
  data: z.record(z.union([z.string(), z.number()])).optional(),
  url: z.string().optional(),
})

const MenuSchema = z.object({
  channel: z.enum(['SERVICE_ACCOUNT', 'MINI_PROGRAM']).optional(),
  buttons: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.enum(['click', 'view', 'miniprogram', 'parent']),
        key: z.string().optional(),
        url: z.string().optional(),
        appId: z.string().optional(),
        pagePath: z.string().optional(),
        sub_button: z.array(z.any()).optional(),
      }),
    )
    .optional(),
})

const ArchiveSchema = z.object({ before: z.string().optional() })

@ApiTags('wechat')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN', 'NURSE')
@Controller('wechat')
export class WechatController {
  constructor(private readonly service: WechatService) {}

  @Post('oauth/callback')
  oauthCallback(@Body(new ZodValidationPipe(OAuthCallbackSchema)) body: z.infer<typeof OAuthCallbackSchema>) {
    return this.service.oauthCallback(body)
  }

  @Post('bind')
  bind(@Body(new ZodValidationPipe(BindSchema)) body: z.infer<typeof BindSchema>) {
    return this.service.bind(body)
  }

  @Get('subscribe/config')
  getSubscribeConfig() {
    return this.service.getSubscribeConfig()
  }

  @Post('menu')
  saveMenu(@Body(new ZodValidationPipe(MenuSchema)) body: { buttons?: WechatMenuButton[]; channel?: WechatChannel }) {
    return this.service.saveMenu(body)
  }

  @Get('menu')
  getMenu() {
    return this.service.getMenu()
  }

  @Get('logs')
  listLogs(
    @Query('openid') openid?: string,
    @Query('type') type?: WechatLogType,
    @Query('status') status?: WechatLogStatus,
  ) {
    return this.service.listLogs({ openid, type, status })
  }

  @Post('logs/archive')
  archiveLogs(@Body(new ZodValidationPipe(ArchiveSchema)) body: { before?: string }) {
    return this.service.archiveLogs(body)
  }

  @Get('users')
  listUsers() {
    return { items: this.service.listUsers(), total: this.service.listUsers().length }
  }

  @Get('user/:openid')
  getUser(@Param('openid') openid: string) {
    return this.service.getUser(openid)
  }

  @Post('push')
  push(@Body(new ZodValidationPipe(PushSchema)) body: z.infer<typeof PushSchema>) {
    return this.service.push(body)
  }

  @Post('template/send')
  sendTemplate(@Body(new ZodValidationPipe(TemplateSendSchema)) body: z.infer<typeof TemplateSendSchema>) {
    return this.service.sendTemplate(body)
  }
}
