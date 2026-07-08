import { Module } from '@nestjs/common';
import { Device-mgmtController } from './device-mgmt.controller';
import { Device-mgmtService } from './device-mgmt.service';

@Module({
  controllers: [Device-mgmtController],
  providers: [Device-mgmtService],
  exports: [Device-mgmtService],
})
export class Device-mgmtModule {}
