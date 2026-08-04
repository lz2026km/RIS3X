/**
 * G005 RIS v3.0.6.11-33 - HL7 Service
 */
import { Injectable, Logger, NotFoundException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common'
import * as net from 'net'
import * as tls from 'tls'
import * as fs from 'fs'
import { PrismaService } from '../prisma/prisma.service'
import { Gender, PatientType } from '@prisma/client'

export interface ReportForHL7 {
  accessionNumber: string
  patientName: string
  patientId: string
  patientSex: 'M' | 'F' | 'O' | ''
  patientBirthDate?: string
  modality: string
  studyDate: string
  studyTime: string
  findings: string
  conclusion: string
  authorName: string
  authorId: string
  reviewerName?: string
  reviewedAt?: Date
  reportId: string
  radsCategory?: string
}

export interface Hl7PushConfig {
  host: string
  port: number
  enabled: boolean
}

export interface OrmOrder {
  patientId: string
  patientName: string
  patientSex: 'M' | 'F' | 'O' | ''
  patientBirthDate?: string
  accessionNumber: string
  modality: string
  bodyPart: string
  orderNumber: string
  orderingDoctor: string
  orderingDept?: string
  orderDateTime?: string
  studyDate?: string
  studyTime?: string
}

export interface DftTransaction {
  patientId: string
  patientName: string
  patientSex?: 'M' | 'F' | 'O' | ''
  invoiceNumber: string
  totalAmount: string
  paidAmount?: string
  chargeCode: string
  chargeName: string
  transactionDate?: string
}

const HL7_DELIMS = {
  field: '|',
  component: '^',
  repetition: '~',
  escape: '\\',
  subcomponent: '&',
}

const nowHL7 = (): string => {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`
}

export interface Hl7MessageArchive {
  id: string
  messageType: string
  controlId: string
  rawMessage: string
  parsed: Record<string, unknown>
  direction: 'INBOUND' | 'OUTBOUND'
  ackStatus?: string
  retryCount?: number
  createdAt: Date
}

@Injectable()
export class Hl7Service implements OnModuleInit {
  private readonly logger = new Logger(Hl7Service.name)
  private mllpServer: net.Server | null = null
  private readonly retryMax: number
  private readonly retryInterval: number
  private readonly whitelist: string[] | null
  private readonly tlsEnabled: boolean
  private readonly tlsOptions: tls.TlsOptions | null

  private pushConfig: Hl7PushConfig = { host: '', port: 2575, enabled: false }

  private static maskPii(value: string): string {
    if (!value || value.length <= 2) return '**'
    return value[0] + '*'.repeat(value.length - 2) + value[value.length - 1]
  }

  constructor(private readonly prisma: PrismaService) {
    this.retryMax = Number(process.env['HL7_MLLP_RETRY_MAX'] ?? 3)
    this.retryInterval = Number(process.env['HL7_MLLP_RETRY_INTERVAL'] ?? 5000)
    const rawWhitelist = process.env['HL7_MLLP_WHITELIST'] ?? ''
    this.whitelist = rawWhitelist ? rawWhitelist.split(',').map((s) => s.trim()).filter(Boolean) : null
    this.tlsEnabled = process.env['HL7_MLLP_TLS_ENABLED'] === 'true'
    this.tlsOptions = this.tlsEnabled
      ? this.loadTlsOptions()
      : null
    this.pushConfig = {
      host: process.env['HL7_PUSH_HOST'] ?? '',
      port: Number(process.env['HL7_PUSH_PORT'] ?? 2575),
      enabled: process.env['HL7_PUSH_ENABLED'] === 'true',
    }
  }

  async onModuleInit(): Promise<void> {
    this.startMllpListener()
  }

  private isAllowed(addr: string | undefined): boolean {
    if (!this.whitelist) return true
    if (!addr) return false
    const ip = addr.replace(/^::ffff:/, '')
    return this.whitelist.some((rule) => {
      if (rule === ip) return true
      if (rule.includes('/')) {
        try {
          const [base, bits] = rule.split('/')
          const mask = ~(2 ** (32 - Number(bits)) - 1)
          const ipNum = this.ipToInt(ip)
          const baseNum = this.ipToInt(base)
          return ipNum !== null && baseNum !== null && (ipNum & mask) === (baseNum & mask)
        } catch {
          return false
        }
      }
      return false
    })
  }

  private ipToInt(ip: string): number | null {
    const parts = ip.split('.').map(Number)
    if (parts.length !== 4 || parts.some(isNaN)) return null
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
  }

  private loadTlsOptions(): tls.TlsOptions {
    const keyPath = process.env['HL7_MLLP_TLS_KEY']
    const certPath = process.env['HL7_MLLP_TLS_CERT']
    if (!keyPath || !certPath) {
      throw new Error('HL7_MLLP_TLS_KEY and HL7_MLLP_TLS_CERT are required when HL7_MLLP_TLS_ENABLED=true')
    }
    if (!fs.existsSync(keyPath)) throw new Error(`HL7 TLS key not found: ${keyPath}`)
    if (!fs.existsSync(certPath)) throw new Error(`HL7 TLS cert not found: ${certPath}`)
    return {
      key: fs.readFileSync(keyPath, 'utf8'),
      cert: fs.readFileSync(certPath, 'utf8'),
    }
  }

  private startMllpListener(): void {
    const port = Number(process.env['HL7_MLLP_PORT'] ?? 2575)
    const onConnection = (socket: net.Socket) => {
      const addr = socket.remoteAddress
      if (!this.isAllowed(addr)) {
        this.logger.warn(`MLLP connection denied from ${addr}`)
        socket.destroy()
        return
      }
      this.logger.log(`MLLP client connected: ${addr}:${socket.remotePort}`)
      let buffer = Buffer.alloc(0)

      socket.on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk])
        while (buffer.length >= 3) {
          const ebIdx = buffer.indexOf(0x1c)
          if (ebIdx === -1) break
          if (ebIdx + 1 >= buffer.length) break
          const cr = buffer[ebIdx + 1]
          if (cr !== 0x0d) {
            buffer = buffer.subarray(1)
            continue
          }
          if (buffer[0] !== 0x0b) {
            buffer = buffer.subarray(1)
            continue
          }
          const msg = buffer.subarray(1, ebIdx).toString('utf8')
          buffer = buffer.subarray(ebIdx + 2)
          this.handleInboundMessage(msg, socket).catch((e) =>
            this.logger.error('MLLP message handling error', e),
          )
        }
      })

      socket.on('error', (err) => {
        this.logger.error(`MLLP socket error: ${err.message}`)
      })

      socket.on('close', () => {
        this.logger.log('MLLP client disconnected')
      })
    }

    if (this.tlsEnabled && this.tlsOptions) {
      this.mllpServer = tls.createServer(this.tlsOptions, onConnection)
      this.logger.log('MLLP TLS mode enabled')
    } else {
      this.mllpServer = net.createServer(onConnection)
    }

    this.mllpServer.on('error', (err) => {
      this.logger.error(`MLLP server error: ${err.message}`)
    })

    this.mllpServer.listen(port, () => {
      this.logger.log(`HL7 MLLP listener started on port ${port}${this.tlsEnabled ? ' (TLS)' : ''}`)
    })
  }

  private async handleInboundMessage(raw: string, socket: net.Socket): Promise<void> {
    const segments = raw.split('\r')
    const msh = segments.find((s) => s.startsWith('MSH'))
    if (!msh) {
      this.sendAck(socket, raw, 'AR', 'UNKNOWN')
      return
    }
    const fields = msh.split('|')
    const messageType = fields[8] ?? 'UNKNOWN'
    const controlId = fields[9] ?? ''

    this.logger.log(`Received HL7 message: ${messageType} ctrlId=${controlId}`)

    try {
      await this.prisma.hl7MessageArchive.create({
        data: {
          tenantId: 'default',
          messageType,
          controlId,
          rawMessage: raw,
          parsed: { segments: segments.length },
          direction: 'INBOUND',
        },
      })
    } catch (dbErr) {
      this.logger.warn(`Failed to archive HL7 message: ${(dbErr as Error).message}`)
    }

    let ackCode = 'AA'
    try {
      if (messageType === 'ADT^A01' || messageType === 'ADT^A04') {
        await this.handleAdtMessage(segments, messageType)
      } else if (messageType === 'ORM^O01') {
        await this.handleOrmMessage(segments)
      } else if (messageType === 'DFT^P03') {
        await this.handleDftMessage(segments)
      } else if (messageType === 'SIU^S12') {
        await this.handleSiuMessage(segments)
      } else {
        this.logger.warn(`Unsupported HL7 message type: ${messageType}`)
      }
    } catch (err) {
      this.logger.error(`Failed to process ${messageType}: ${(err as Error).message}`)
      ackCode = 'AE'
    }

    this.sendAck(socket, raw, ackCode, messageType)
  }

  private async handleAdtMessage(segments: string[], messageType: string): Promise<void> {
    const pid = segments.find((s) => s.startsWith('PID'))
    if (!pid) return
    const pidFields = pid.split('|')
    const patientMrn = pidFields[3]?.split('^')[0] ?? ''
    const patientName = pidFields[5]?.split('^')[0] ?? ''
    const rawDob = pidFields[7] ?? ''
    const rawSex = pidFields[8] ?? ''

    this.logger.log(`ADT ${messageType}: MRN=${Hl7Service.maskPii(patientMrn)}, name=${Hl7Service.maskPii(patientName)}, DOB=${rawDob}, sex=${rawSex}`)

    const birthDate = rawDob ? new Date(rawDob.slice(0, 4) + '-' + rawDob.slice(4, 6) + '-' + rawDob.slice(6, 8)) : null
    const gender: Gender = rawSex === 'M' ? 'MALE' : rawSex === 'F' ? 'FEMALE' : 'OTHER'

    const existing = patientMrn
      ? await this.prisma.patient.findFirst({ where: { idCard: patientMrn } })
      : null

    if (existing) {
      await this.prisma.patient.update({
        where: { id: existing.id },
        data: {
          name: patientName,
          gender,
          birthDate,
        },
      })
      this.logger.log(`ADT: updated patient ${existing.id} (MRN=${Hl7Service.maskPii(patientMrn)})`)
    } else {
      await this.prisma.patient.create({
        data: {
          tenantId: 'HL7_IMPORT',
          name: patientName,
          gender,
          birthDate,
          idCard: patientMrn || undefined,
          type: 'OUTPATIENT' as PatientType,
        },
      })
      this.logger.log(`ADT: created patient with MRN=${Hl7Service.maskPii(patientMrn)}`)
    }
  }

  private async handleOrmMessage(segments: string[]): Promise<void> {
    const pid = segments.find((s) => s.startsWith('PID'))
    const orc = segments.find((s) => s.startsWith('ORC'))
    const obr = segments.find((s) => s.startsWith('OBR'))

    if (!pid || !orc || !obr) {
      this.logger.warn('ORM^O01: missing PID/ORC/OBR segment')
      return
    }

    const pidFields = pid.split('|')
    const orcFields = orc.split('|')
    const obrFields = obr.split('|')

    const patientMrn = pidFields[3]?.split('^')[0] ?? ''
    const patientName = pidFields[5]?.split('^')[0] ?? ''
    const rawSex = pidFields[8] ?? ''
    const rawDob = pidFields[7] ?? ''
    const accessionNumber = obrFields[3]?.split('^')[0] ?? ''
    const modality = obrFields[15]?.split('^')[0] ?? ''
    const orderControl = orcFields[1] ?? ''

    this.logger.log(`ORM^O01: orderControl=${orderControl}, accession=${accessionNumber}, modality=${modality}, patient=${Hl7Service.maskPii(patientName)}`)

    const birthDate = rawDob ? new Date(rawDob.slice(0, 4) + '-' + rawDob.slice(4, 6) + '-' + rawDob.slice(6, 8)) : null
    const gender: Gender = rawSex === 'M' ? 'MALE' : rawSex === 'F' ? 'FEMALE' : 'OTHER'

    let patient = patientMrn
      ? await this.prisma.patient.findFirst({ where: { idCard: patientMrn } })
      : null

    if (!patient) {
      patient = await this.prisma.patient.create({
        data: {
          tenantId: 'HL7_IMPORT',
          name: patientName,
          gender,
          birthDate,
          idCard: patientMrn || undefined,
          type: 'OUTPATIENT' as PatientType,
        },
      })
    }

    const existingExam = accessionNumber
      ? await this.prisma.exam.findUnique({ where: { accessionNumber } })
      : null

    if (!existingExam) {
      await this.prisma.exam.create({
        data: {
          tenantId: 'HL7_IMPORT',
          patientId: patient.id,
          accessionNumber,
          modality: modality || 'UNKNOWN',
          bodyPart: obrFields[14]?.split('^')[0] ?? '',
          state: orderControl === 'NW' ? 'SCHEDULED' : orderControl === 'SC' ? 'SCHEDULED' : 'SCHEDULED',
        },
      })
      this.logger.log(`ORM^O01: created exam accession=${accessionNumber}`)
    }
  }

  private async handleDftMessage(segments: string[]): Promise<void> {
    const pid = segments.find((s) => s.startsWith('PID'))
    const ft1 = segments.find((s) => s.startsWith('FT1') || s.startsWith('DG1'))
    const dg1 = segments.find((s) => s.startsWith('DG1'))

    if (!pid) {
      this.logger.warn('DFT^P03: missing PID segment')
      return
    }

    const pidFields = pid.split('|')
    const patientMrn = pidFields[3]?.split('^')[0] ?? ''
    const patientName = pidFields[5]?.split('^')[0] ?? ''

    this.logger.log(`DFT^P03: patient=${Hl7Service.maskPii(patientName)}, MRN=${Hl7Service.maskPii(patientMrn)}`)

    if (ft1 || dg1) {
      const ft1Fields = ft1?.split('|') ?? []
      const chargeCode = ft1Fields[4]?.split('^')[0] ?? ''
      const chargeName = ft1Fields[4]?.split('^')[1] ?? ''
      const amount = ft1Fields[6] ?? ''
      this.logger.log(`DFT^P03: charge=${chargeCode} ${chargeName}, amount=${amount}`)
    }
  }

  private async handleSiuMessage(segments: string[]): Promise<void> {
    const pid = segments.find((s) => s.startsWith('PID'))
    const sch = segments.find((s) => s.startsWith('SCH'))
    const aig = segments.find((s) => s.startsWith('AIG'))

    if (!pid || !sch) {
      this.logger.warn('SIU^S12: missing PID/SCH segment')
      return
    }

    const pidFields = pid.split('|')
    const schFields = sch.split('|')

    const patientMrn = pidFields[3]?.split('^')[0] ?? ''
    const patientName = pidFields[5]?.split('^')[0] ?? ''
    const rawDob = pidFields[7] ?? ''
    const rawSex = pidFields[8] ?? ''
    const modality = aig ? aig.split('|')[3]?.split('^')[0] ?? '' : schFields[9]?.split('^')[0] ?? ''

    this.logger.log(`SIU^S12: patient=${Hl7Service.maskPii(patientName)}, MRN=${Hl7Service.maskPii(patientMrn)}, modality=${modality}`)

    const birthDate = rawDob ? new Date(rawDob.slice(0, 4) + '-' + rawDob.slice(4, 6) + '-' + rawDob.slice(6, 8)) : null
    const gender: Gender = rawSex === 'M' ? 'MALE' : rawSex === 'F' ? 'FEMALE' : 'OTHER'

    let patient = patientMrn
      ? await this.prisma.patient.findFirst({ where: { idCard: patientMrn } })
      : null

    if (!patient) {
      patient = await this.prisma.patient.create({
        data: {
          tenantId: 'HL7_IMPORT',
          name: patientName,
          gender,
          birthDate,
          idCard: patientMrn || undefined,
          type: 'OUTPATIENT' as PatientType,
        },
      })
    }

    const scheduledStart = schFields[11] ?? ''
    const scheduledEnd = schFields[12] ?? ''
    const scheduledAt = scheduledStart
      ? new Date(
          scheduledStart.slice(0, 4) + '-' + scheduledStart.slice(4, 6) + '-' + scheduledStart.slice(6, 11) +
          ':' + scheduledStart.slice(11, 13) + ':' + scheduledStart.slice(13, 15)
        )
      : new Date()

    await this.prisma.appointment.create({
      data: {
        tenantId: 'default',
        patientId: patient.id,
        patientName: patient.name,
        modality: modality || 'UNKNOWN',
        scheduledAt,
        state: 'SCHEDULED',
      },
    }).catch((err) => this.logger.warn(`SIU^S12: failed to create appointment: ${(err as Error).message}`))
  }

  async sendMllpMessage(remoteHost: string, remotePort: number, message: string): Promise<string> {
    const framed = Buffer.concat([Buffer.from([0x0b]), Buffer.from(message, 'utf8'), Buffer.from([0x1c, 0x0d])])
    const messageType = message.split('\r')[0]?.split('|')[8] ?? 'UNKNOWN'
    const controlId = message.split('\r')[0]?.split('|')[9] ?? `OUT-${Date.now()}`
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.retryMax; attempt++) {
      this.logger.log(`MLLP send attempt ${attempt}/${this.retryMax} to ${remoteHost}:${remotePort}`)
      try {
        const ack = await this.sendFramedMessage(remoteHost, remotePort, framed)
        const msa = ack.split('\r').find((s) => s.startsWith('MSA'))
        const ackCode = msa?.split('|')[1] ?? ''

        await this.prisma.hl7MessageArchive.create({
          data: {
            tenantId: 'default',
            messageType,
            controlId,
            rawMessage: ack,
            parsed: { ackCode, attempt, direction: 'OUTBOUND_ACK' },
            direction: 'OUTBOUND',
            ackStatus: ackCode,
            retryCount: attempt,
          },
        }).catch((err) => this.logger.warn(`Failed to archive HL7 message: ${(err as Error).message}`))

        if (ackCode === 'AA') {
          this.logger.log(`MLLP send successful on attempt ${attempt}`)
          return ack
        }
        this.logger.warn(`MLLP received non-AA ACK (${ackCode}) on attempt ${attempt}`)
      } catch (err) {
        lastError = err as Error
        this.logger.warn(`MLLP send attempt ${attempt} failed: ${(err as Error).message}`)
      }

      if (attempt < this.retryMax) {
        await new Promise((resolve) => setTimeout(resolve, this.retryInterval))
      }
    }

    await this.prisma.hl7MessageArchive.create({
      data: {
        tenantId: 'default',
        messageType,
        controlId,
        rawMessage: message,
        parsed: { error: lastError?.message ?? 'Max retries exceeded', retryCount: this.retryMax },
        direction: 'OUTBOUND',
        ackStatus: 'FAILED',
        retryCount: this.retryMax,
      },
    }).catch((err) => this.logger.warn(`Failed to archive HL7 message: ${(err as Error).message}`))

    throw new Error(`MLLP send failed after ${this.retryMax} attempts: ${lastError?.message ?? 'unknown'}`)
  }

  private sendFramedMessage(host: string, port: number, framed: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket()
      const timeout = Number(process.env['HL7_MLLP_TIMEOUT'] ?? 10000)
      let response = Buffer.alloc(0)

      socket.setTimeout(timeout)

      socket.on('connect', () => {
        socket.write(framed)
      })

      socket.on('data', (chunk) => {
        response = Buffer.concat([response, chunk])
        const ebIdx = response.indexOf(0x1c)
        if (ebIdx !== -1 && ebIdx + 1 < response.length && response[ebIdx + 1] === 0x0d) {
          socket.end()
          const startIdx = response[0] === 0x0b ? 1 : 0
          resolve(response.subarray(startIdx, ebIdx).toString('utf8'))
        }
      })

      socket.on('timeout', () => {
        socket.destroy()
        reject(new Error('MLLP response timeout'))
      })

      socket.on('error', (err) => {
        socket.destroy()
        reject(err)
      })

      socket.connect(port, host)
    })
  }

  private sendAck(socket: net.Socket, rawMessage: string, ackCode: string, originalMessageType: string): void {
    const mshMatch = rawMessage.match(/MSH\|([^\r]+)/)
    const fields = mshMatch ? mshMatch[1].split('|') : []
    const sendingApp = fields[2] ?? ''
    const sendingFacility = fields[3] ?? ''
    const receivingApp = fields[4] ?? ''
    const receivingFacility = fields[5] ?? ''
    const controlId = fields[9] ?? ''
    const version = fields[11] ?? '2.5.1'

    const ackMessageType = originalMessageType && originalMessageType !== 'UNKNOWN' ? `ACK^${originalMessageType}` : 'ACK'
    const ack = [
      'MSH',
      '^~\\&',
      receivingApp,
      receivingFacility,
      sendingApp,
      sendingFacility,
      new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14),
      '',
      ackMessageType,
      `ACK-${controlId}`,
      'P',
      version,
      '',
      '',
      'NE',
      'AL',
      '',
      '',
    ].join('|')

    const errSegment = ackCode !== 'AA'
      ? `\rERR|^^^${ackCode}^E`
      : ''

    const msa = `\rMSA|${ackCode}|${controlId}`
    const ackMsg = `${ack}${msa}${errSegment}\r`
    const framed = Buffer.concat([Buffer.from([0x0b]), Buffer.from(ackMsg, 'utf8'), Buffer.from([0x1c, 0x0d])])
    socket.write(framed)

    this.prisma.hl7MessageArchive.create({
      data: {
        tenantId: 'default',
        messageType: 'ACK',
        controlId: `ACK-${controlId}`,
        rawMessage: ackMsg,
        parsed: { ackCode, originalControlId: controlId },
        direction: 'OUTBOUND',
        ackStatus: ackCode,
        retryCount: 0,
      },
    }).catch((err) => this.logger.warn(`Failed to archive HL7 message: ${(err as Error).message}`))
  }

  async pushOruById(examId: string, reportId: string): Promise<void> {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { patient: true, reports: true },
    })
    if (!exam) throw new NotFoundException('Exam not found')
    const report = exam.reports.find((r) => r.id === reportId)
    if (!report) throw new NotFoundException('Report not found')
    return this.pushOruOnExamCompletion(exam, report)
  }

  /**
   * v3.0.6.11-60: 组装 ORU^R01 消息并推送(供 DICOM SR 回传链路复用)。
   * - push 未启用时: 仅归档消息,返回 pushed=false,不抛错
   * - push 启用时: MLLP 发送,失败按 sendMllpMessage 重试后抛错
   */
  async buildAndPushOru(r: ReportForHL7): Promise<{ message: string; controlId: string; pushed: boolean; ackStatus: string }> {
    const message = this.buildORU(r)
    const controlId = message.split('\r')[0]?.split('|')[9] ?? `G005-${r.reportId}-${Date.now()}`
    if (!this.pushConfig.enabled || !this.pushConfig.host) {
      await this.prisma.hl7MessageArchive.create({
        data: {
          tenantId: 'default',
          messageType: 'ORU^R01',
          controlId,
          rawMessage: message,
          parsed: { note: 'ORU push disabled by config, message archived only', reportId: r.reportId },
          direction: 'OUTBOUND',
          ackStatus: 'SKIPPED',
          retryCount: 0,
        },
      }).catch((err) => this.logger.warn(`Failed to archive HL7 message: ${(err as Error).message}`))
      this.logger.log(`ORU^R01 built (push disabled) for report ${r.reportId}, controlId=${controlId}`)
      return { message, controlId, pushed: false, ackStatus: 'SKIPPED' }
    }
    const ack = await this.sendMllpMessage(this.pushConfig.host, this.pushConfig.port, message)
    const ackCode = ack.split('\r').find((s) => s.startsWith('MSA'))?.split('|')[1] ?? 'AA'
    this.logger.log(`ORU^R01 pushed for report ${r.reportId}, controlId=${controlId}, ack=${ackCode}`)
    return { message, controlId, pushed: true, ackStatus: ackCode }
  }

  async pushOruOnExamCompletion(exam: any, report: any): Promise<void> {
    if (!this.pushConfig.enabled || !this.pushConfig.host) {
      this.logger.debug('ORU push disabled, skipping')
      return
    }
    try {
      const oru: ReportForHL7 = {
        accessionNumber: exam.accessionNumber,
        patientName: report.patient?.name ?? '',
        patientId: report.patientId,
        patientSex: report.patient?.gender === 'MALE' ? 'M' : report.patient?.gender === 'FEMALE' ? 'F' : 'O',
        patientBirthDate: report.patient?.birthDate?.toISOString().split('T')[0],
        modality: exam.modality,
        studyDate: exam.startedAt?.toISOString().split('T')[0] ?? '',
        studyTime: exam.startedAt?.toISOString().split('T')[1]?.split('.')[0] ?? '',
        findings: report.findings,
        conclusion: report.conclusion,
        authorName: report.authorName ?? '',
        authorId: report.authorId ?? '',
        reportId: report.id,
      }
      const message = this.buildORU(oru)
      await this.sendMllpMessage(this.pushConfig.host, this.pushConfig.port, message)
      this.logger.log(`ORU^R01 pushed for exam ${exam.accessionNumber}, report ${report.id}`)
    } catch (err) {
      this.logger.error(`ORU push failed for exam ${exam.accessionNumber}: ${(err as Error).message}`)
      await this.prisma.hl7MessageArchive.create({
        data: {
          tenantId: 'default',
          messageType: 'ORU^R01',
          controlId: `ORU-PUSH-FAIL-${report.id}`,
          rawMessage: '',
          parsed: { error: (err as Error).message, examId: exam.id, reportId: report.id },
          direction: 'OUTBOUND',
          ackStatus: 'FAILED',
          retryCount: this.retryMax,
        },
      }).catch((archiveError) => this.logger.warn(`Failed to archive HL7 message: ${(archiveError as Error).message}`))
      throw new ServiceUnavailableException('HL7 ORU push failed')
    }
  }

  stopMllpListener(): void {
    if (this.mllpServer) {
      this.mllpServer.close()
      this.mllpServer = null
      this.logger.log('MLLP listener stopped')
    }
  }

  buildORU(r: ReportForHL7): string {
    const ts = nowHL7()
    const ctrlId = `G005-${r.reportId}-${ts}`

    const msh = [
      'MSH',
      `^~\\&`,
      'G005_RIS',
      'G005_HOSPITAL',
      'HIS_RECEIVER',
      'HIS',
      ts,
      '',
      'ORU^R01',
      ctrlId,
      'P',
      '2.5.1',
    ].join(HL7_DELIMS.field)

    const pid = [
      'PID',
      '1',
      '',
      `${r.patientId}^^^G005&1.2.840.113556.1.8000.2554.1.300&ISO^MR`,
      '',
      `${r.patientName}^${r.patientName}`,
      '',
      `${(r.patientBirthDate ?? '').replace(/-/g, '')}`,
      `${r.patientSex === 'M' ? 'M' : r.patientSex === 'F' ? 'F' : 'O'}`,
    ].join(HL7_DELIMS.field)

    const pv1 = ['PV1', '1', 'O', '', '', '', '', '', '', '', '', '', `${r.accessionNumber}^^G005^ACC`].join(HL7_DELIMS.field)

    const obr = [
      'OBR',
      '1',
      `${r.accessionNumber}^^G005&1.2.840.113556.1.8000.2554.1.300&ISO^FILL`,
      `${r.accessionNumber}^^G005&1.2.840.113556.1.8000.2554.1.300&ISO^FILL`,
      `${r.modality}^${r.modality}^DCM`,
      '',
      '',
      `${r.studyDate.replace(/-/g, '')}${r.studyTime.replace(/:/g, '')}`,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      `${r.authorId}^${r.authorName}^^^G005^DOC`,
    ].join(HL7_DELIMS.field)

    const obxLines: string[] = []
    let obxSeq = 1
    obxLines.push(
      ['OBX', String(obxSeq++), 'TX', '18782-3^Radiology study observation^LN', '', this.escapeText(r.findings)].join(HL7_DELIMS.field)
    )
    obxLines.push(
      ['OBX', String(obxSeq++), 'TX', '19005-8^Radiology study conclusion^LN', '', this.escapeText(r.conclusion)].join(HL7_DELIMS.field)
    )
    if (r.radsCategory) {
      obxLines.push(
        ['OBX', String(obxSeq++), 'CE', 'RADS^RADS Category^DCM', '', r.radsCategory].join(HL7_DELIMS.field)
      )
    }

    return [msh, pid, pv1, obr, ...obxLines].join('\r')
  }

  buildORM(o: OrmOrder): string {
    const ts = nowHL7()
    const ctrlId = `ORM-G005-${o.accessionNumber}-${ts}`

    const msh = [
      'MSH',
      '^~\\&',
      'G005_RIS',
      'G005_HOSPITAL',
      'HIS_ORDER',
      'HIS',
      ts,
      '',
      'ORM^O01',
      ctrlId,
      'P',
      '2.5.1',
    ].join(HL7_DELIMS.field)

    const pid = [
      'PID',
      '1',
      '',
      `${o.patientId}^^^G005&1.2.840.113556.1.8000.2554.1.300&ISO^MR`,
      '',
      `${o.patientName}^${o.patientName}`,
      '',
      (o.patientBirthDate ?? '').replace(/-/g, ''),
      o.patientSex === 'M' ? 'M' : o.patientSex === 'F' ? 'F' : 'O',
    ].join(HL7_DELIMS.field)

    const orc = [
      'ORC',
      'NW',
      `${o.orderNumber}^^G005^ORDER`,
      '',
      '',
      '',
      '',
      ts,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      o.orderingDoctor,
    ].join(HL7_DELIMS.field)

    const obr = [
      'OBR',
      '1',
      `${o.accessionNumber}^^G005&1.2.840.113556.1.8000.2554.1.300&ISO^FILL`,
      `${o.accessionNumber}^^G005&1.2.840.113556.1.8000.2554.1.300&ISO^FILL`,
      `${o.modality}^${o.modality}^DCM`,
      '',
      `${(o.studyDate ?? '').replace(/-/g, '')}${(o.studyTime ?? '').replace(/:/g, '')}`,
      '',
      '',
      '',
      '',
      '',
      '',
      o.bodyPart,
    ].join(HL7_DELIMS.field)

    return [msh, pid, orc, obr].join('\r')
  }

  buildDFT(d: DftTransaction): string {
    const ts = nowHL7()
    const ctrlId = `DFT-G005-${d.invoiceNumber}-${ts}`

    const msh = [
      'MSH',
      '^~\\&',
      'G005_RIS',
      'G005_HOSPITAL',
      'HIS_FINANCE',
      'HIS',
      ts,
      '',
      'DFT^P03',
      ctrlId,
      'P',
      '2.5.1',
    ].join(HL7_DELIMS.field)

    const pid = [
      'PID',
      '1',
      '',
      `${d.patientId}^^^G005&1.2.840.113556.1.8000.2554.1.300&ISO^MR`,
      '',
      `${d.patientName}^${d.patientName}`,
      '',
      '',
      d.patientSex === 'M' ? 'M' : d.patientSex === 'F' ? 'F' : 'O',
    ].join(HL7_DELIMS.field)

    const ft1 = [
      'FT1',
      '1',
      '',
      '',
      `${d.chargeCode}^${d.chargeName}^G005`,
      '',
      d.totalAmount,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      d.invoiceNumber,
    ].join(HL7_DELIMS.field)

    return [msh, pid, ft1].join('\r')
  }

  private escapeText(s: string): string {
    return s
      .replace(/\\/g, '\\E\\')
      .replace(/\|/g, '\\F\\')
      .replace(/\^/g, '\\S\\')
      .replace(/~/g, '\\R\\')
      .replace(/\r?\n/g, '\\.br\\')
  }
}
