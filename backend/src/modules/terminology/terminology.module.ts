import { Module } from '@nestjs/common'
import { TerminologyController } from './terminology.controller'
import { TerminologyService } from './terminology.service'
import { TermEntryController } from './term-entry.controller'
import { TermEntryService } from './term-entry.service'

@Module({
  controllers: [TerminologyController, TermEntryController],
  providers: [TerminologyService, TermEntryService],
})
export class TerminologyModule {}
