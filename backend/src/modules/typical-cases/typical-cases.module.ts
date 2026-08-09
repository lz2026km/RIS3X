import { Module } from '@nestjs/common'
import { TypicalCasesController } from './typical-cases.controller'
import { TypicalCasesService } from './typical-cases.service'

@Module({
  controllers: [TypicalCasesController],
  providers: [TypicalCasesService],
})
export class TypicalCasesModule {}
