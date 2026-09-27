import { Module } from '@nestjs/common';
import { CdsController } from './cds.controller';
import { CdsService } from './cds.service';
import { CdsHooksController } from './cds-hooks.controller';
import { CdsHooksService } from './cds-hooks.service';
@Module({
  controllers: [CdsController, CdsHooksController],
  providers: [CdsService, CdsHooksService],
  exports: [CdsService, CdsHooksService],
})
export class CdsModule {}
