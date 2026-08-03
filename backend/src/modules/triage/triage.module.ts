import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { TriageController } from './triage.controller'
import { TriageService } from './triage.service'

@Module({
  imports: [PrismaModule],
  controllers: [TriageController],
  providers: [TriageService],
  exports: [TriageService],
})
export class TriageModule {}
