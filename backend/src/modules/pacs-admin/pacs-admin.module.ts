import { Module } from '@nestjs/common'
import { PacsAdminController } from './pacs-admin.controller'
import { PacsAdminService } from './pacs-admin.service'

@Module({
  controllers: [PacsAdminController],
  providers: [PacsAdminService],
})
export class PacsAdminModule {}
