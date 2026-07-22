import { Module } from '@nestjs/common'
import { SmartRouteController } from './smart-route.controller'
import { SmartRouteService } from './smart-route.service'

@Module({
  controllers: [SmartRouteController],
  providers: [SmartRouteService],
  exports: [SmartRouteService],
})
export class SmartRouteModule {}
