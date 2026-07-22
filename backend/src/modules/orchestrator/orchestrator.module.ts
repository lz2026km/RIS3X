import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { OrchestratorController } from './orchestrator.controller'
import { OrchestratorService } from './orchestrator.service'

@Module({
  imports: [PrismaModule],
  controllers: [OrchestratorController],
  providers: [OrchestratorService],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
