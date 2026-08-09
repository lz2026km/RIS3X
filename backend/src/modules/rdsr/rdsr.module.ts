import { Module } from '@nestjs/common'
import { CriticalAlertModule } from '../critical-alert/critical-alert.module'
import { RdsrController } from './rdsr.controller'
import { RdsrService } from './rdsr.service'

@Module({
  imports: [CriticalAlertModule],
  controllers: [RdsrController],
  providers: [RdsrService],
  exports: [RdsrService],
})
export class RdsrModule {}
