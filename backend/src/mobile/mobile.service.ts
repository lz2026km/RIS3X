import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class MobileService {
  private readonly logger = new Logger(MobileService.name)

  constructor(private readonly config: ConfigService) {}

  async jscode2session(code: string): Promise<Record<string, unknown>> {
    const appId = this.config.get<string>('WECHAT_APPID', '')
    const secret = this.config.get<string>('WECHAT_SECRET', '')
    if (!appId || !secret) {
      return { errcode: -1, errmsg: 'WeChat not configured' }
    }
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${secret}&js_code=${code}&grant_type=authorization_code`
    const res = await fetch(url)
    return res.json() as Promise<Record<string, unknown>>
  }
}
