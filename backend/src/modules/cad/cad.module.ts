import { Module } from '@nestjs/common'
import { CadController } from './cad.controller'
import { CadService } from './cad.service'

@Module({
  controllers: [CadController],
  providers: [CadService],
  exports: [CadService],
})
export class CadModule {}
