import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { QueueService } from './queue.service'
import { ReportExportConsumer, Hl7SendConsumer, AiInferenceConsumer } from './queue.consumer'

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env['REDIS_HOST'] ?? 'localhost',
        port: parseInt(process.env['REDIS_PORT'] ?? '6379'),
        password: process.env['REDIS_PASSWORD'] || undefined,
        db: parseInt(process.env['REDIS_DB'] ?? '0'),
        tls: process.env['REDIS_TLS'] === 'true' ? {} : undefined,
      },
    }),
    BullModule.registerQueue(
      { name: 'reportExport' },
      { name: 'hl7Send' },
      { name: 'aiInference' },
    ),
  ],
  providers: [QueueService, ReportExportConsumer, Hl7SendConsumer, AiInferenceConsumer],
  exports: [QueueService],
})
export class QueueModule {}
