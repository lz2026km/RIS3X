/**
 * [G005 W11-DeviceOps] 设备运维中心模块 (工单状态机/校准认证/资产折旧/OEE/成本DRG/定时报表).
 * 无 DB 可启动 (内存 + @Optional Prisma)。
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { DeviceOpsController } from './device-ops.controller'
import { DeviceOpsService } from './device-ops.service'

@Module({
  imports: [PrismaModule],
  controllers: [DeviceOpsController],
  providers: [DeviceOpsService],
  exports: [DeviceOpsService],
})
export class DeviceOpsModule {}
