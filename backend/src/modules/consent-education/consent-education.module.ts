import { Module } from '@nestjs/common'
import { ConsentEducationController } from './consent-education.controller'
import { ConsentEducationService } from './consent-education.service'

@Module({
  controllers: [ConsentEducationController],
  providers: [ConsentEducationService],
})
export class ConsentEducationModule {}
