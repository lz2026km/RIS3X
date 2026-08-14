// [Wave 6A v3.0.6.11-99] 语音工作站模块 (医学词库 + 听写流校正 + 纠正反馈 + 会话派生)
import { Module } from '@nestjs/common'
import { AsrModule } from '../asr/asr.module'
import { VoiceWorkstationController } from './voice-workstation.controller'
import { VoiceWorkstationService } from './voice-workstation.service'

@Module({
  imports: [AsrModule],
  controllers: [VoiceWorkstationController],
  providers: [VoiceWorkstationService],
  exports: [VoiceWorkstationService],
})
export class VoiceWorkstationModule {}
