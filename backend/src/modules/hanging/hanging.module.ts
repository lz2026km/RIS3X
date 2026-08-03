import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { HangingController } from './hanging.controller'
import { HangingService } from './hanging.service'

@Module({
  imports: [PrismaModule],
  controllers: [HangingController],
  providers: [HangingService],
  exports: [HangingService],
})
export class HangingModule {}
