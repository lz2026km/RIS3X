/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 1A - 放射影像专业医疗质量控制指标 (2024 年版) 模块
 * 孤儿模块: 无新增 DB 表 (不修改 prisma schema), Prisma 可选注入, 可无 DB 启动
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { Rqi2024Controller } from './rqi-2024.controller'
import { Rqi2024Service } from './rqi-2024.service'

@Module({
  imports: [PrismaModule],
  controllers: [Rqi2024Controller],
  providers: [Rqi2024Service],
  exports: [Rqi2024Service],
})
export class Rqi2024Module {}
