import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { SmartRouteController } from './smart-route.controller'
import { SmartRouteService } from './smart-route.service'

@Module({
  imports: [PrismaModule],
  controllers: [SmartRouteController],
  providers: [SmartRouteService],
  exports: [SmartRouteService],
})
export class SmartRouteModule {}
