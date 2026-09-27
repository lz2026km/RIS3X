/**
 * [G005 W9-QC] 规范化缺陷库模块 (defect-library): 孤儿模块, 无 DB 可启动
 */
import { Module } from '@nestjs/common'
import { DefectLibraryController } from './defect-library.controller'
import { DefectLibraryService } from './defect-library.service'

@Module({
  controllers: [DefectLibraryController],
  providers: [DefectLibraryService],
  exports: [DefectLibraryService],
})
export class DefectLibraryModule {}
