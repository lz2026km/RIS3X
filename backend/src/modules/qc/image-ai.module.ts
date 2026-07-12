import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { ImageAiController } from './image-ai.controller'
import { ImageAiService } from './image-ai.service'

@Module({
  imports: [PrismaModule],
  controllers: [ImageAiController],
  providers: [ImageAiService],
  exports: [ImageAiService],
})
export class ImageAiModule {}
