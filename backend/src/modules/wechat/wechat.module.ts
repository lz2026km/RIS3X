/**
 * [G005 W12-PatientService] 微信服务号 / 小程序模块 (orphan module, DB-less-safe)
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { WechatController } from './wechat.controller'
import { WechatService } from './wechat.service'

@Module({
  imports: [PrismaModule],
  controllers: [WechatController],
  providers: [WechatService],
  exports: [WechatService],
})
export class WechatModule {}
