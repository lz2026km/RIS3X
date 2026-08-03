import { Module } from '@nestjs/common'
import { SystemStorageController } from './system-storage.controller'
import { SystemStorageService } from './system-storage.service'

@Module({
  controllers: [SystemStorageController],
  providers: [SystemStorageService],
})
export class SystemStorageModule {}
