import { Module } from '@nestjs/common'
import { FusionV2Controller } from './fusion-v2.controller'
import { FusionV2Service } from './fusion-v2.service'

@Module({
  controllers: [FusionV2Controller],
  providers: [FusionV2Service],
  exports: [FusionV2Service],
})
export class FusionV2Module {}
