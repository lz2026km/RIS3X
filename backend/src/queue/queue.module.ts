import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { QueueService } from './queue.service'
import { ReportExportConsumer, Hl7SendConsumer, AiInferenceConsumer } from './queue.consumer'
import { Hl7Module } from '../hl7/hl7.module'
import { AiDiagnosisModule } from '../modules/ai-diagnosis/ai-diagnosis.module'

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
    Hl7Module,
    AiDiagnosisModule,
  ],
  providers: [QueueService, ReportExportConsumer, Hl7SendConsumer, AiInferenceConsumer],
  // [W6] 导出 BullModule: HealthController 等直接 @InjectQueue 注入队列 token,
  //      不导出则 AppModule 侧无法解析 BullQueue_reportExport 等 → 后端启动崩溃。
  exports: [QueueService, BullModule],
})
export class QueueModule {}
