import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { ScheduleService } from './schedule.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule],
  providers: [ScheduleService],
})
export class AppScheduleModule {}
