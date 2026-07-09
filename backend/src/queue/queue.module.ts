import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { QueueService } from './queue.service'
import { QueueConsumer } from './queue.consumer'

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env['REDIS_HOST'] ?? 'localhost',
        port: parseInt(process.env['REDIS_PORT'] ?? '6379'),
      },
    }),
    BullModule.registerQueue(
      { name: 'reportExport' },
      { name: 'hl7Send' },
      { name: 'aiInference' },
    ),
  ],
  providers: [QueueService, QueueConsumer],
  exports: [QueueService],
})
export class QueueModule {}
