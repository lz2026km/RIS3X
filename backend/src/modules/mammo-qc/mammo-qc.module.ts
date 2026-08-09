import { Module } from '@nestjs/common'
import { MammoQcController } from './mammo-qc.controller'
import { MammoQcService } from './mammo-qc.service'

@Module({
  controllers: [MammoQcController],
  providers: [MammoQcService],
})
export class MammoQcModule {}
