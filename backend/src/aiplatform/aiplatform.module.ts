import { Module } from '@nestjs/common';
import { Ai-platformController } from './ai-platform.controller';
import { Ai-platformService } from './ai-platform.service';

@Module({
  controllers: [Ai-platformController],
  providers: [Ai-platformService],
  exports: [Ai-platformService],
})
export class Ai-platformModule {}
