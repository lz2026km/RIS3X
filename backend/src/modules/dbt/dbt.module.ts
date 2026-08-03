import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { DbtController } from './dbt.controller'
import { DbtService } from './dbt.service'

@Module({
  imports: [PrismaModule],
  controllers: [DbtController],
  providers: [DbtService],
  exports: [DbtService],
})
export class DbtModule {}
