import { Module } from '@nestjs/common';
import { Qc-extController } from './qc-ext.controller';
import { Qc-extService } from './qc-ext.service';

@Module({
  controllers: [Qc-extController],
  providers: [Qc-extService],
  exports: [Qc-extService],
})
export class Qc-extModule {}
