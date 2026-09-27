/**
 * [G005 W9-QC] 统一可配置质控评分量表模块 (quality-rubric)
 * 孤儿模块: 无新增 DB 表 (不修改 prisma schema), Prisma 可选注入, 可无 DB 启动
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { QualityRubricController } from './quality-rubric.controller'
import { QualityRubricService } from './quality-rubric.service'

@Module({
  imports: [PrismaModule],
  controllers: [QualityRubricController],
  providers: [QualityRubricService],
  exports: [QualityRubricService],
})
export class QualityRubricModule {}
