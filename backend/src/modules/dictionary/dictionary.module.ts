// [W4-A v3.0.6.11-79] 数据字典模块
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { DictionaryController } from './dictionary.controller'
import { DictionaryService } from './dictionary.service'

@Module({
  imports: [PrismaModule],
  controllers: [DictionaryController],
  providers: [DictionaryService],
  exports: [DictionaryService],
})
export class DictionaryModule {}
