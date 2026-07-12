import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { PrismaModule } from '../../prisma/prisma.module'
import { TeachController } from './teach.controller'
import { TeachService } from './teach.service'

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({ dest: '/tmp/teach-uploads' }),
  ],
  controllers: [TeachController],
  providers: [TeachService],
  exports: [TeachService],
})
export class TeachModule {}
