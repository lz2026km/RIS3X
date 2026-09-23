/**
 * G005 放射RIS系统 - 骨科影像分析 (ortho-specialty) 模块 (孤儿模块)
 * 自包含: 纯内存 + seed, 无 DB 可启动。
 */
import { Module } from '@nestjs/common'
import { OrthoSpecialtyController } from './ortho-specialty.controller'
import { OrthoSpecialtyService } from './ortho-specialty.service'

@Module({
  controllers: [OrthoSpecialtyController],
  providers: [OrthoSpecialtyService],
  exports: [OrthoSpecialtyService],
})
export class OrthoSpecialtyModule {}
