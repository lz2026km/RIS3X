import { Module } from '@nestjs/common'
import { DeviceMgmtController } from './devicemgmt.controller'
import { DeviceMgmtService } from './devicemgmt.service'

@Module({
  controllers: [DeviceMgmtController],
  providers: [DeviceMgmtService],
  exports: [DeviceMgmtService],
})
export class DeviceMgmtModule {}
