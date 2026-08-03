import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { OeeController } from './oee.controller'
import { OeeService } from './oee.service'

@Module({
  imports: [PrismaModule],
  controllers: [OeeController],
  providers: [OeeService],
})
export class OeeModule {}
