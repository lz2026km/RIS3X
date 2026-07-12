import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { OccupancyController } from './occupancy.controller'
import { OccupancyService } from './occupancy.service'

@Module({
  imports: [PrismaModule],
  controllers: [OccupancyController],
  providers: [OccupancyService],
  exports: [OccupancyService],
})
export class OccupancyModule {}
