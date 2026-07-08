import { Module } from '@nestjs/common';
import { Critical-extController } from './critical-ext.controller';
import { Critical-extService } from './critical-ext.service';

@Module({
  controllers: [Critical-extController],
  providers: [Critical-extService],
  exports: [Critical-extService],
})
export class Critical-extModule {}
