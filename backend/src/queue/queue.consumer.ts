import { Processor, Process } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import type { Job } from 'bull'

@Processor('reportExport')
export class ReportExportConsumer {
  private readonly logger = new Logger(ReportExportConsumer.name)

  @Process('export')
  async handleExport(job: Job<{ reportId: string; format: string; userId: string }>): Promise<void> {
    this.logger.log(`Exporting report ${job.data.reportId} as ${job.data.format}`)
  }
}

@Processor('hl7Send')
export class Hl7SendConsumer {
  private readonly logger = new Logger(Hl7SendConsumer.name)

  @Process('send')
  async handleSend(job: Job<{ reportId: string; destination: string; payload: string }>): Promise<void> {
    this.logger.log(`Sending HL7 for report ${job.data.reportId} to ${job.data.destination}`)
  }
}

@Processor('aiInference')
export class AiInferenceConsumer {
  private readonly logger = new Logger(AiInferenceConsumer.name)

  @Process('infer')
  async handleInfer(job: Job<{ studyId: string; modality: string; imageUrls: string[] }>): Promise<void> {
    this.logger.log(`Running AI inference on study ${job.data.studyId}`)
  }
}
