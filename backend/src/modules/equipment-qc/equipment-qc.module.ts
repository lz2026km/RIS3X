/**
 * [G005 W9-QC] 设备质控模块 (equipment-qc): 孤儿模块, 无 DB 可启动
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { EquipmentQcController } from './equipment-qc.controller'
import { EquipmentQcService } from './equipment-qc.service'

@Module({
  imports: [PrismaModule],
  controllers: [EquipmentQcController],
  providers: [EquipmentQcService],
  exports: [EquipmentQcService],
})
export class EquipmentQcModule {}
