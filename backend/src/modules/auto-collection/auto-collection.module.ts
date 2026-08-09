import { Module } from '@nestjs/common'
import { AutoCollectionController } from './auto-collection.controller'
import { AutoCollectionService } from './auto-collection.service'

@Module({
  controllers: [AutoCollectionController],
  providers: [AutoCollectionService],
})
export class AutoCollectionModule {}
