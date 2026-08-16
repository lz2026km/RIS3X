import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { ImagingCompareController } from './imaging-compare.controller'
import { ImagingCompareService } from './imaging-compare.service'

@Module({
  imports: [PrismaModule],
  controllers: [ImagingCompareController],
  providers: [ImagingCompareService],
  exports: [ImagingCompareService],
})
export class ImagingCompareModule {}
