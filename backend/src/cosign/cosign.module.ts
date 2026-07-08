import { Module } from '@nestjs/common';
import { CosignController } from './cosign.controller';
import { CosignService } from './cosign.service';

@Module({
  controllers: [CosignController],
  providers: [CosignService],
  exports: [CosignService],
})
export class CosignModule {}
