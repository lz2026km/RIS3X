import { Module } from '@nestjs/common'
import { SimilarCaseController } from './similar-case.controller'
import { SimilarCaseService } from './similar-case.service'

@Module({
  controllers: [SimilarCaseController],
  providers: [SimilarCaseService],
  exports: [SimilarCaseService],
})
export class SimilarCaseModule {}
