import { Module } from '@nestjs/common';
import { CosignController } from './cosign.controller';
import { CosignService } from './cosign.service';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [ReportsModule],
  controllers: [CosignController],
  providers: [CosignService],
  exports: [CosignService],
})
export class CosignModule {}
