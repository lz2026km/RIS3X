import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { CriticalAlertController } from './critical-alert.controller'
import { CriticalAlertService } from './critical-alert.service'

@Module({
  imports: [PrismaModule],
  controllers: [CriticalAlertController],
  providers: [CriticalAlertService],
  exports: [CriticalAlertService],
})
export class CriticalAlertModule {}
