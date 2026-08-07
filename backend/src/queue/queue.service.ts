import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import type { Queue } from 'bull'

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('reportExport') private readonly reportExportQueue: Queue,
    @InjectQueue('hl7Send') private readonly hl7SendQueue: Queue,
    @InjectQueue('aiInference') private readonly aiInferenceQueue: Queue,
  ) {}

  async addReportExport(job: { reportId: string; format: string; userId: string }): Promise<void> {
    await this.reportExportQueue.add('export', job, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } })
  }

  async addBatchExport(job: { taskId: string; ids: string[]; format: string; userId: string }): Promise<void> {
    await this.reportExportQueue.add('batchExport', job, { attempts: 1, removeOnComplete: true })
  }

  async addHl7Send(job: { reportId: string; destination: string; payload: string }): Promise<void> {
    await this.hl7SendQueue.add('send', job, { attempts: 3, backoff: { type: 'exponential', delay: 3000 } })
  }

  async addAiInference(job: { studyId: string; modality: string; imageUrls: string[] }): Promise<void> {
    await this.aiInferenceQueue.add('infer', job, { attempts: 2, backoff: { type: 'fixed', delay: 10000 } })
  }
}
