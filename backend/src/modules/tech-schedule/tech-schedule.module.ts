import { Module } from '@nestjs/common'
import { TechScheduleController } from './tech-schedule.controller'
import { TechScheduleService } from './tech-schedule.service'

@Module({
  controllers: [TechScheduleController],
  providers: [TechScheduleService],
  exports: [TechScheduleService],
})
export class TechScheduleModule {}
