import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { DeviceController } from './device.controller'
import { DeviceService } from './device.service'
import { DeviceScheduleService } from './device-schedule.service'

@Module({
  imports: [PrismaModule],
  controllers: [DeviceController],
  providers: [DeviceService, DeviceScheduleService],
  exports: [DeviceService, DeviceScheduleService],
})
export class DeviceModule {}
