/**
 * G005 RIS v3.0.6.11-33 - HL7 Controller
 */
import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Post, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { PrismaService } from '../prisma/prisma.service'
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

const PushOruSchema = z.object({ examId: z.string().min(1), reportId: z.string().min(1) })

const WhitelistSchema = z.object({ cidr: z.string().min(1) })
const TlsSchema = z.object({ enabled: z.boolean() })

@ApiTags('hl7')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('hl7')
export class Hl7Controller {
  constructor(
    private readonly service: Hl7Service,
    private readonly prisma: PrismaService,
  ) {}

  @Post('oru')
  @HttpCode(HttpStatus.CREATED)
  async oru(@Body(new ZodValidationPipe(ReportSchema)) body: ReportForHL7) {
    const message = await this.service.buildORU(body)
    return {
      message,
      controlId: `G005-${body.reportId}-${Date.now()}`,
      messageType: 'ORU^R01',
      generatedAt: new Date().toISOString(),
      bytes: Buffer.byteLength(message, 'utf8'),
    }
  }

  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  async batch(@Body(new ZodValidationPipe(BatchSchema)) body: { reports: ReportForHL7[] }) {
    const messages = await Promise.all(body.reports.map((r) => this.service.buildORU(r)))
    return {
      count: body.reports.length,
      messages: messages.map((message, i) => ({
        reportId: body.reports[i]!.reportId,
        message,
      })),
    }
  }

  @Post('orm')
  @HttpCode(HttpStatus.CREATED)
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
  @HttpCode(HttpStatus.CREATED)
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
  @HttpCode(HttpStatus.CREATED)
  async pushOru(@Body(new ZodValidationPipe(PushOruSchema)) body: { examId: string; reportId: string }) {
    await this.service.pushOruById(body.examId, body.reportId)
    return { pushed: true, examId: body.examId, reportId: body.reportId }
  }

  // ============ [W3-B] 归档 + MLLP 管理端点 (integrationApi.hl7Api) ============

  @Get('archive')
  @ApiOperation({ summary: 'HL7 message archive (read-only, Hl7MessageArchive)' })
  async getArchive(
    @Query('messageType') messageType?: string,
    @Query('direction') direction?: string,
    @Query('ackStatus') ackStatus?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const rows = await this.prisma.hl7MessageArchive.findMany({
      where: {
        ...(messageType ? { messageType } : {}),
        ...(direction ? { direction: direction.toUpperCase() } : {}),
        ...(ackStatus ? { ackStatus: ackStatus.toUpperCase() } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(Number(limit) || 50, 1), 200),
    })
    return rows.map((r) => ({
      id: r.id,
      messageType: r.messageType,
      controlId: r.controlId,
      direction: r.direction,
      ackStatus: r.ackStatus ?? 'PENDING',
      retryCount: r.retryCount,
      rawMessage: r.rawMessage,
      createdAt: r.createdAt.toISOString(),
    }))
  }

  @Get('mllp/status')
  @ApiOperation({ summary: 'MLLP listener status' })
  getMllpStatus() {
    return this.service.getMllpStatus()
  }

  @Get('mllp/logs')
  @ApiOperation({ summary: 'MLLP connection logs' })
  getMllpLogs(@Query('limit') limit?: string) {
    return this.service.getMllpLogs(Number(limit) || 50)
  }

  @Post('mllp/start')
  @ApiOperation({ summary: 'Start MLLP listener' })
  startMllp() {
    return this.service.startMllp()
  }

  @Post('mllp/stop')
  @ApiOperation({ summary: 'Stop MLLP listener' })
  stopMllp() {
    return this.service.stopMllp()
  }

  @Post('mllp/whitelist/add')
  @ApiOperation({ summary: 'Add CIDR to MLLP whitelist' })
  addMllpWhitelist(@Body(new ZodValidationPipe(WhitelistSchema)) body: { cidr: string }) {
    return this.service.addMllpWhitelist(body.cidr)
  }

  @Post('mllp/whitelist/remove')
  @ApiOperation({ summary: 'Remove CIDR from MLLP whitelist' })
  removeMllpWhitelist(@Body(new ZodValidationPipe(WhitelistSchema)) body: { cidr: string }) {
    return this.service.removeMllpWhitelist(body.cidr)
  }

  @Post('mllp/tls')
  @ApiOperation({ summary: 'Toggle MLLP TLS mode' })
  toggleMllpTls(@Body(new ZodValidationPipe(TlsSchema)) body: { enabled: boolean }) {
    return this.service.toggleMllpTls(body.enabled)
  }
}
