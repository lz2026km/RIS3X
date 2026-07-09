import { Module } from '@nestjs/common'
import { OlapController } from './olap.controller'
import { OlapService } from './olap.service'
import { PrismaModule } from '../../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [OlapController],
  providers: [OlapService],
  exports: [OlapService],
})
export class OlapModule {}
