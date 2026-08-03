import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { WorklistSmartController } from './worklist-smart.controller'
import { WorklistSmartService } from './worklist-smart.service'

@Module({
  imports: [PrismaModule],
  controllers: [WorklistSmartController],
  providers: [WorklistSmartService],
  exports: [WorklistSmartService],
})
export class WorklistSmartModule {}
