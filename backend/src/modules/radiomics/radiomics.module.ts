import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { RadiomicsController } from './radiomics.controller'
import { RadiomicsService } from './radiomics.service'

@Module({
  imports: [PrismaModule],
  controllers: [RadiomicsController],
  providers: [RadiomicsService],
  exports: [RadiomicsService],
})
export class RadiomicsModule {}
