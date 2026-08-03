import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { FusionController } from './fusion.controller'
import { FusionService } from './fusion.service'

@Module({
  imports: [PrismaModule],
  controllers: [FusionController],
  providers: [FusionService],
  exports: [FusionService],
})
export class FusionModule {}
