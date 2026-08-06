import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { ScheduleService } from './schedule.service'
import { CriticalsModule } from '../criticals/criticals.module'
import { BackupModule } from '../modules/backup/backup.module'

@Module({
  imports: [ScheduleModule.forRoot(), CriticalsModule, BackupModule],
  providers: [ScheduleService],
})
export class AppScheduleModule {}
