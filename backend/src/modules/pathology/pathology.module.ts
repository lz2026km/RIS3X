/**
 * G005 RIS v3.0.6.11-101 Wave 2B - 病理切片 WSI 模块 (孤儿模块)
 * 自包含: 仅依赖全局 PrismaService (可无 DB 启动, seed 回退), 不引用其他业务模块。
 */
import { Module } from '@nestjs/common'
import { PathologyController } from './pathology.controller'
import { PathologyService } from './pathology.service'

@Module({
  controllers: [PathologyController],
  providers: [PathologyService],
  exports: [PathologyService],
})
export class PathologyModule {}
