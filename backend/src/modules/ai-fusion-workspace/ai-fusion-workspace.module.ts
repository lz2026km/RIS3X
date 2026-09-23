/**
 * G005 放射RIS系统 - AI 融合工作站 (ai/fusion-workspace) 模块 (孤儿模块)
 * 自包含: 纯内存 + seed, 无 DB 可启动。
 */
import { Module } from '@nestjs/common'
import { AiFusionWorkspaceController } from './ai-fusion-workspace.controller'
import { AiFusionWorkspaceService } from './ai-fusion-workspace.service'

@Module({
  controllers: [AiFusionWorkspaceController],
  providers: [AiFusionWorkspaceService],
  exports: [AiFusionWorkspaceService],
})
export class AiFusionWorkspaceModule {}
