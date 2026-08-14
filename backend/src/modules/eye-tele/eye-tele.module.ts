import { Module } from '@nestjs/common'
import { TeleModule } from '../tele/tele.module'
import { EyeTeleController } from './eye-tele.controller'
import { EyeTeleService } from './eye-tele.service'

/**
 * [G005 Wave 10A] 眼科远程会诊桥接模块
 * /eye/tele/* → 复用 tele 模块 (TeleService WebRTC 信令) + 眼科业务字段 (seed 派生)
 */
@Module({
  imports: [TeleModule],
  controllers: [EyeTeleController],
  providers: [EyeTeleService],
  exports: [EyeTeleService],
})
export class EyeTeleModule {}
