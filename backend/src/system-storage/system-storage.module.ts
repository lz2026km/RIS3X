import { Global, Module } from '@nestjs/common'
import { SystemStorageController } from './system-storage.controller'
import { SystemStorageService } from './system-storage.service'
import { SystemConfigService } from './system-config.service'

// [v3.0.6.11-79] @Global: 报告导出/HL7/危急值 SLA/调度升级/分页默认值 等消费者直接注入 SystemConfigService
@Global()
@Module({
  controllers: [SystemStorageController],
  providers: [SystemStorageService, SystemConfigService],
  exports: [SystemStorageService, SystemConfigService],
})
export class SystemStorageModule {}
