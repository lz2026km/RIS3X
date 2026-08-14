import { Module } from '@nestjs/common'
import { FindingLibraryController } from './finding-library.controller'
import { FindingLibraryService } from './finding-library.service'

@Module({
  controllers: [FindingLibraryController],
  providers: [FindingLibraryService],
  exports: [FindingLibraryService],
})
export class FindingLibraryModule {}
