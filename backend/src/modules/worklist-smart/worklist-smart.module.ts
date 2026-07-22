import { Module } from '@nestjs/common'
import { WorklistSmartController } from './worklist-smart.controller'
import { WorklistSmartService } from './worklist-smart.service'

@Module({
  controllers: [WorklistSmartController],
  providers: [WorklistSmartService],
  exports: [WorklistSmartService],
})
export class WorklistSmartModule {}
