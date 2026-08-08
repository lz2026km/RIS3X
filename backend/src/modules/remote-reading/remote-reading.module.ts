import { Module } from '@nestjs/common'
import { RemoteReadingController } from './remote-reading.controller'
import { RemoteReadingService } from './remote-reading.service'

@Module({
  controllers: [RemoteReadingController],
  providers: [RemoteReadingService],
})
export class RemoteReadingModule {}
