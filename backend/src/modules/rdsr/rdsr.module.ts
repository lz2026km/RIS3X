import { Module } from '@nestjs/common'
import { RdsrController } from './rdsr.controller'
import { RdsrService } from './rdsr.service'

@Module({
  controllers: [RdsrController],
  providers: [RdsrService],
  exports: [RdsrService],
})
export class RdsrModule {}
