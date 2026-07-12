import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { RadPathController } from './radpath.controller'
import { RadPathService } from './radpath.service'

@Module({
  imports: [PrismaModule],
  controllers: [RadPathController],
  providers: [RadPathService],
  exports: [RadPathService],
})
export class RadPathModule {}
