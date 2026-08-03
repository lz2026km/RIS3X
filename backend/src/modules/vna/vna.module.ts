import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { VnaController } from './vna.controller'
import { VnaService } from './vna.service'

@Module({
  imports: [PrismaModule],
  controllers: [VnaController],
  providers: [VnaService],
  exports: [VnaService],
})
export class VnaModule {}
