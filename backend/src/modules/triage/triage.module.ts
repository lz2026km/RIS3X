import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
// [G005 W6] 队列优先级联动: 分诊 ESI → queue priority
import { CallQueueModule } from '../queue/queue.module'
import { TriageController } from './triage.controller'
import { TriageService } from './triage.service'

@Module({
  imports: [PrismaModule, CallQueueModule],
  controllers: [TriageController],
  providers: [TriageService],
  exports: [TriageService],
})
export class TriageModule {}
