/**
 * G005 放射RIS系统 v3.0.6.13 - 接口监控 + 持久化重试队列模块
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { InterfaceMonitorController } from './interface-monitor.controller'
import { InterfaceMonitorService } from './interface-monitor.service'

@Module({
  imports: [PrismaModule],
  controllers: [InterfaceMonitorController],
  providers: [InterfaceMonitorService],
  exports: [InterfaceMonitorService],
})
export class InterfaceMonitorModule {}
