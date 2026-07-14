import { Module } from '@nestjs/common'
import { CadController } from './cad.controller'
import { CadService } from './cad.service'
import { CadRadsController } from './cad-rads.controller'
import { CadRadsService } from './cad-rads.service'

@Module({
  controllers: [CadController, CadRadsController],
  providers: [CadService, CadRadsService],
  exports: [CadService, CadRadsService],
})
export class CadModule {}
