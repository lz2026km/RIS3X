/**
 * G005 鏀惧皠RIS绯荤粺 v3.0.2 - HL7 鎺у埗鍣? * 2 绔偣:POST oru / POST batch
 * v3.0.6.11-9: 娣诲姞 POST orm / POST dft
 */
import { Body, Controller, Post } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { Hl7Service, ReportForHL7, OrmOrder, DftTransaction } from './hl7.service'

const ReportSchema = z.object({
  accessionNumber: z.string(),
  patientName: z.string(),
  patientId: z.string(),
  patientSex: z.enum(['M', 'F', 'O', '']),
  patientBirthDate: z.string().optional(),
  modality: z.string(),
  studyDate: z.string(),
  studyTime: z.string(),
  findings: z.string(),
  conclusion: z.string(),
  authorName: z.string(),
  authorId: z.string(),
  reviewerName: z.string().optional(),
  reviewedAt: z.string().datetime().or(z.date()).optional(),
  reportId: z.string(),
  radsCategory: z.string().optional(),
})

const BatchSchema = z.object({
  reports: z.array(ReportSchema).min(1).max(100),
})

const OrmSchema = z.object({
  patientId: z.string(),
  patientName: z.string(),
  patientSex: z.enum(['M', 'F', 'O', '']),
  patientBirthDate: z.string().optional(),
  accessionNumber: z.string(),
  modality: z.string(),
  bodyPart: z.string(),
  orderNumber: z.string(),
  orderingDoctor: z.string(),
  orderingDept: z.string().optional(),
  orderDateTime: z.string().optional(),
  studyDate: z.string().optional(),
  studyTime: z.string().optional(),
})

const DftSchema = z.object({
  patientId: z.string(),
  patientName: z.string(),
  patientSex: z.enum(['M', 'F', 'O', '']).optional(),
  invoiceNumber: z.string(),
  totalAmount: z.string(),
  paidAmount: z.string().optional(),
  chargeCode: z.string(),
  chargeName: z.string(),
  transactionDate: z.string().optional(),
})

@ApiTags('hl7')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('hl7')
export class Hl7Controller {
  constructor(private readonly service: Hl7Service) {}

  @Post('oru')
  oru(@Body(new ZodValidationPipe(ReportSchema)) body: ReportForHL7) {
    const message = this.service.buildORU(body)
    return {
      message,
      controlId: `G005-${body.reportId}-${Date.now()}`,
      messageType: 'ORU^R01',
      generatedAt: new Date().toISOString(),
      bytes: Buffer.byteLength(message, 'utf8'),
    }
  }

  @Post('batch')
  batch(@Body(new ZodValidationPipe(BatchSchema)) body: { reports: ReportForHL7[] }) {
    return {
      count: body.reports.length,
      messages: body.reports.map((r) => ({
        reportId: r.reportId,
        message: this.service.buildORU(r),
      })),
    }
  }

  @Post('orm')
  orm(@Body(new ZodValidationPipe(OrmSchema)) body: OrmOrder) {
    const message = this.service.buildORM(body)
    return {
      message,
      controlId: `ORM-G005-${body.accessionNumber}-${Date.now()}`,
      messageType: 'ORM^O01',
      generatedAt: new Date().toISOString(),
      bytes: Buffer.byteLength(message, 'utf8'),
    }
  }

  @Post('dft')
  dft(@Body(new ZodValidationPipe(DftSchema)) body: DftTransaction) {
    const message = this.service.buildDFT(body)
    return {
      message,
      controlId: `DFT-G005-${body.invoiceNumber}-${Date.now()}`,
      messageType: 'DFT^P03',
      generatedAt: new Date().toISOString(),
      bytes: Buffer.byteLength(message, 'utf8'),
    }
  }

  @Post('push-oru')
  async pushOru(@Body() body: { examId: string; reportId: string }) {
    const exam = await (this.service as any).prisma.exam.findUnique({
      where: { id: body.examId },
      include: { patient: true, reports: true },
    })
    if (!exam) throw new Error('Exam not found')
    const report = exam.reports.find((r: any) => r.id === body.reportId)
    if (!report) throw new Error('Report not found')
    await this.service.pushOruOnExamCompletion(exam, report)
    return { pushed: true, examId: body.examId, reportId: body.reportId }
  }
}
