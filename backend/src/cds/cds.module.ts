import { Module } from '@nestjs/common';
import { CdsController } from './cds.controller';
import { CdsService } from './cds.service';

@Module({
  controllers: [CdsController],
  providers: [CdsService],
  exports: [CdsService],
})
export class CdsModule {}
