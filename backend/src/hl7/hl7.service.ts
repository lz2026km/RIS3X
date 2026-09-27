/**
 * G005 RIS v3.0.6.11-33 - HL7 Service
 */
import { Injectable, Logger, NotFoundException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common'
import * as net from 'net'
import * as tls from 'tls'
import * as fs from 'fs'
import { PrismaService } from '../prisma/prisma.service'
import { SystemConfigService } from '../system-storage/system-config.service'
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

// ===== [v3.0.6.13] Publish → HIS ORU^R01 消息日志 (MLLP 或 stub) =====

export interface HisEndpointConfig {
  host: string
  port: number
  enabled: boolean
}

export interface OruPublishRecord {
  id: string
  reportId: string
  examId?: string
  controlId: string
  messageType: 'ORU^R01'
  message: string
  ackStatus: string
  ackMessage?: string
  endpoint: string
  mode: 'MLLP' | 'STUB'
  attempts: number
  status: 'SENT' | 'STUBBED' | 'FAILED'
  error?: string
  createdAt: string
  updatedAt: string
}

export interface OruPublishFilter {
  reportId?: string
  status?: OruPublishRecord['status']
  ackStatus?: string
  limit?: number
}

// ===== [W10E-3] 扩展端点 DTO (HL7 总览 / 错误分析 / 吞吐趋势 / 消息类型) =====

export interface Hl7OverviewDto {
  totalMessages: number
  todayMessages: number
  inboundCount: number
  outboundCount: number
  successCount: number
  failedCount: number
  successRate: number
  ackStatusBreakdown: Array<{ ackStatus: string; count: number }>
  byType: Array<{ messageType: string; count: number; percent: number }>
  seeded: boolean
}

export interface Hl7ErrorAnalysisDto {
  totalErrors: number
  byErrorType: Array<{ errorType: string; count: number; percent: number }>
  byChannel: Array<{ channel: string; count: number }>
  byHour: Array<{ hour: string; count: number }>
  recentErrors: Array<{ id: string; messageType: string; ackStatus: string; createdAt: string }>
  seeded: boolean
}

export interface Hl7ThroughputPoint {
  date: string
  label: string
  total: number
  success: number
  failed: number
  successRate: number
  seeded: boolean
}

export interface Hl7MessageTypeDto {
  messageType: string
  count: number
  percent: number
  avgBytes: number
  direction: string
}

function hl7Hash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 确定性伪随机: 同一 seedInput 永远得到同一结果 (统计回退可复现) */
function hl7SeededRand(min: number, max: number, seedInput: string): number {
  let a = hl7Hash(seedInput) >>> 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return Math.round((r * (max - min) + min) * 10) / 10
}

function hl7LocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 最大余数法分配百分比: 保证各项之和恒为 100 */
function allocatePercent(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0)
  if (total <= 0) return counts.map(() => 0)
  const raw = counts.map((c) => (c * 100) / total)
  const result = raw.map((r) => Math.floor(r))
  let remainder = 100 - result.reduce((a, b) => a + b, 0)
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac)
  let k = 0
  while (remainder > 0 && k < order.length) {
    result[order[k]!.i] += 1
    remainder -= 1
    k += 1
  }
  return result
}

@Injectable()
export class Hl7Service implements OnModuleInit {
  private readonly logger = new Logger(Hl7Service.name)
  private mllpServer: net.Server | null = null
  private readonly retryMax: number
  private readonly retryInterval: number
  private whitelist: string[] | null
  private tlsEnabled: boolean
  private readonly tlsOptions: tls.TlsOptions | null

  // [W3-B] MLLP 管理端点支撑: 计数/日志/启动时间
  private totalConnections = 0
  private totalMessages = 0
  private mllpStartedAt: number | null = null
  private readonly mllpLogs: { id: number; peer: string; event: 'connect' | 'disconnect' | 'message' | 'error'; timestamp: string; detail?: string }[] = []
  private mllpLogSeq = 0

  private pushConfig: Hl7PushConfig = { host: '', port: 2575, enabled: false }

  // [v3.0.6.13] 报告发布 → HIS ORU^R01 端点 + 消息日志 (内存; DB-less-safe)
  private hisEndpoint: HisEndpointConfig = { host: '', port: 2576, enabled: false }
  private readonly oruLog: OruPublishRecord[] = []
  private oruSeq = 0

  private static maskPii(value: string): string {
    if (!value || value.length <= 2) return '**'
    return value[0] + '*'.repeat(value.length - 2) + value[value.length - 1]
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
  ) {
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
    this.hisEndpoint = {
      host: process.env['HIS_ORU_HOST'] ?? process.env['HL7_PUSH_HOST'] ?? '',
      port: Number(process.env['HIS_ORU_PORT'] ?? process.env['HL7_PUSH_PORT'] ?? 2576),
      enabled: process.env['HIS_ORU_ENABLED'] === 'true',
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
    if (this.mllpServer?.listening) return
    const port = Number(process.env['HL7_MLLP_PORT'] ?? 2575)
    const onConnection = (socket: net.Socket) => {
      const addr = socket.remoteAddress
      this.totalConnections += 1
      this.appendMllpLog('connect', addr, `port=${socket.remotePort}`)
      if (!this.isAllowed(addr)) {
        this.logger.warn(`MLLP connection denied from ${addr}`)
        this.appendMllpLog('error', addr, 'denied by whitelist')
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
          this.totalMessages += 1
          const msh = msg.split('\r').find((s) => s.startsWith('MSH'))
          const type = msh?.split('|')[8] ?? 'UNKNOWN'
          this.appendMllpLog('message', addr, type)
          this.handleInboundMessage(msg, socket).catch((e) =>
            this.logger.error('MLLP message handling error', e),
          )
        }
      })

      socket.on('error', (err) => {
        this.logger.error(`MLLP socket error: ${err.message}`)
        this.appendMllpLog('error', addr, err.message)
      })

      socket.on('close', () => {
        this.logger.log('MLLP client disconnected')
        this.appendMllpLog('disconnect', addr)
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
      this.appendMllpLog('error', 'local', err.message)
    })

    this.mllpServer.listen(port, () => {
      this.mllpStartedAt = Date.now()
      this.logger.log(`HL7 MLLP listener started on port ${port}${this.tlsEnabled ? ' (TLS)' : ''}`)
    })
  }

  private appendMllpLog(event: 'connect' | 'disconnect' | 'message' | 'error', peer: string | undefined, detail?: string): void {
    this.mllpLogSeq += 1
    this.mllpLogs.push({
      id: this.mllpLogSeq,
      peer: peer ? peer.replace(/^::ffff:/, '') : 'local',
      event,
      timestamp: new Date().toISOString(),
      detail,
    })
    if (this.mllpLogs.length > 500) this.mllpLogs.shift()
  }

  // ============ [W3-B] MLLP 管理端点 (integrationApi.hl7Api) ============

  getMllpStatus(): {
    running: boolean
    port: number
    tlsEnabled: boolean
    tlsPort?: number
    whitelist: string[]
    uptimeMs: number
    totalConnections: number
    totalMessages: number
  } {
    const listening = this.mllpServer?.listening === true
    return {
      running: listening,
      port: Number(process.env['HL7_MLLP_PORT'] ?? 2575),
      tlsEnabled: this.tlsEnabled,
      tlsPort: this.tlsEnabled ? Number(process.env['HL7_MLLP_TLS_PORT'] ?? 2576) : undefined,
      whitelist: this.whitelist ?? [],
      uptimeMs: this.mllpStartedAt ? Date.now() - this.mllpStartedAt : 0,
      totalConnections: this.totalConnections,
      totalMessages: this.totalMessages,
    }
  }

  getMllpLogs(limit = 50): typeof this.mllpLogs {
    return this.mllpLogs.slice(-Math.max(1, Math.min(limit, 500)))
  }

  startMllp(): { success: boolean; running: boolean } {
    this.startMllpListener()
    return { success: true, running: this.mllpServer?.listening === true }
  }

  stopMllp(): { success: boolean; running: boolean } {
    this.stopMllpListener()
    return { success: true, running: false }
  }

  addMllpWhitelist(cidr: string): { success: boolean; whitelist: string[] } {
    const rule = cidr.trim()
    if (!rule) throw new Error('cidr is required')
    if (!this.whitelist) this.whitelist = []
    if (!this.whitelist.includes(rule)) this.whitelist.push(rule)
    return { success: true, whitelist: [...this.whitelist] }
  }

  removeMllpWhitelist(cidr: string): { success: boolean; whitelist: string[] } {
    if (this.whitelist) this.whitelist = this.whitelist.filter((r) => r !== cidr)
    return { success: true, whitelist: [...(this.whitelist ?? [])] }
  }

  toggleMllpTls(enabled: boolean): { success: boolean; tlsEnabled: boolean } {
    if (enabled && !this.tlsOptions) {
      throw new Error('HL7_MLLP_TLS_KEY/HL7_MLLP_TLS_CERT not configured; cannot enable TLS')
    }
    this.tlsEnabled = enabled
    this.stopMllpListener()
    if (enabled) this.startMllpListener()
    return { success: true, tlsEnabled: this.tlsEnabled }
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
    const message = await this.buildORU(r)
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
      const message = await this.buildORU(oru)
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
      this.mllpStartedAt = null
      this.logger.log('MLLP listener stopped')
    }
  }

  // ================= [v3.0.6.13] Publish → HIS ORU^R01 (MLLP / stub + 消息日志) =================

  getHisEndpoint(): HisEndpointConfig {
    return { ...this.hisEndpoint }
  }

  setHisEndpoint(dto: Partial<HisEndpointConfig>): HisEndpointConfig {
    this.hisEndpoint = { ...this.hisEndpoint, ...dto }
    return { ...this.hisEndpoint }
  }

  private buildOruPayload(exam: any, report: any): ReportForHL7 {
    return {
      accessionNumber: exam?.accessionNumber ?? '',
      patientName: report?.patient?.name ?? '',
      patientId: report?.patientId ?? exam?.patientId ?? '',
      patientSex: report?.patient?.gender === 'MALE' ? 'M' : report?.patient?.gender === 'FEMALE' ? 'F' : 'O',
      patientBirthDate: report?.patient?.birthDate?.toISOString?.().split('T')[0],
      modality: exam?.modality ?? '',
      studyDate: exam?.startedAt?.toISOString?.().split('T')[0] ?? new Date().toISOString().split('T')[0]!,
      studyTime: exam?.startedAt?.toISOString?.().split('T')[1]?.split('.')[0] ?? '000000',
      findings: report?.findings ?? '',
      conclusion: report?.conclusion || report?.impression || '',
      authorName: report?.authorName ?? report?.radiologist?.name ?? '',
      authorId: report?.authorId ?? report?.radiologistId ?? '',
      reportId: String(report?.id ?? ''),
      radsCategory: undefined,
    }
  }

  /** 报告发布时调用: 按 reportId 组装并投递 ORU^R01 到 HIS 端点 */
  async publishOruByReportId(reportId: string, examId?: string): Promise<OruPublishRecord> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: { patient: true, exam: true },
    }).catch(() => null)
    if (!report) throw new NotFoundException(`Report ${reportId} not found`)
    let exam = (report as any).exam ?? null
    if (!exam && (examId || (report as any).examId)) {
      exam = await this.prisma.exam.findUnique({ where: { id: examId ?? (report as any).examId } }).catch(() => null)
    }
    const payload = this.buildOruPayload(exam, report)
    return this.publishOru(payload, { examId: exam?.id ?? examId })
  }

  /** 组装 + 投递 ORU^R01 (HIS MLLP 启用则真实发送, 否则 stub ACK) */
  async publishOru(report: ReportForHL7, opts: { examId?: string } = {}): Promise<OruPublishRecord> {
    const message = await this.buildORU(report)
    const controlId = message.split('\r')[0]?.split('|')[9] ?? `G005-${report.reportId}-${Date.now()}`
    const mode: 'MLLP' | 'STUB' = this.hisEndpoint.enabled && this.hisEndpoint.host ? 'MLLP' : 'STUB'
    const endpoint = mode === 'MLLP' ? `${this.hisEndpoint.host}:${this.hisEndpoint.port}` : 'stub://his.local/oru'

    let ackStatus = 'AA'
    let ackMessage: string | undefined
    let status: OruPublishRecord['status'] = 'STUBBED'
    let error: string | undefined

    if (mode === 'MLLP') {
      try {
        ackMessage = await this.sendMllpMessage(this.hisEndpoint.host, this.hisEndpoint.port, message)
        ackStatus = ackMessage.split('\r').find((s) => s.startsWith('MSA'))?.split('|')[1] ?? 'AA'
        status = ackStatus === 'AA' ? 'SENT' : 'FAILED'
      } catch (err) {
        ackStatus = 'FAILED'
        status = 'FAILED'
        error = (err as Error).message
      }
    } else {
      // 确定性 stub ACK: 模拟 HIS 接收
      ackMessage = `MSH|^~\\&|HIS|HIS_RECEIVER|G005|G005|${nowHL7()}||ACK^R01|ACK-${controlId}|P|2.5.1\rMSA|AA|${controlId}\r`
    }

    const now = new Date().toISOString()
    const record: OruPublishRecord = {
      id: `ORU-${String(++this.oruSeq).padStart(4, '0')}-${report.reportId}`,
      reportId: report.reportId,
      examId: opts.examId,
      controlId,
      messageType: 'ORU^R01',
      message,
      ackStatus,
      ackMessage,
      endpoint,
      mode,
      attempts: 1,
      status,
      error,
      createdAt: now,
      updatedAt: now,
    }
    this.oruLog.push(record)
    if (this.oruLog.length > 2000) this.oruLog.shift()

    await this.prisma.hl7MessageArchive.create({
      data: {
        tenantId: 'default',
        messageType: 'ORU^R01',
        controlId,
        rawMessage: message,
        parsed: { ackStatus, ackMessage, mode, endpoint, reportId: report.reportId },
        direction: 'OUTBOUND',
        ackStatus,
        retryCount: 0,
      },
    }).catch((err) => this.logger.warn(`Failed to archive ORU publish: ${(err as Error).message}`))

    if (status === 'FAILED') {
      this.logger.error(`ORU^R01 publish FAILED for report ${report.reportId}: ${error}`)
    } else {
      this.logger.log(`ORU^R01 ${status} for report ${report.reportId} via ${mode} (${endpoint}) ack=${ackStatus}`)
    }
    return record
  }

  listOruMessages(filter: OruPublishFilter = {}): { total: number; entries: OruPublishRecord[] } {
    let items = [...this.oruLog]
    if (filter.reportId) items = items.filter((r) => r.reportId === filter.reportId)
    if (filter.status) items = items.filter((r) => r.status === filter.status)
    if (filter.ackStatus) items = items.filter((r) => r.ackStatus === filter.ackStatus)
    items.reverse()
    const limit = filter.limit ?? 100
    return { total: items.length, entries: items.slice(0, Math.max(1, Math.min(limit, 500))) }
  }

  getOruMessage(id: string): OruPublishRecord | null {
    return this.oruLog.find((r) => r.id === id) ?? null
  }

  /** 重发已归档的 ORU 消息 (同一 message 重新投递) */
  async resendOru(id: string): Promise<OruPublishRecord> {
    const record = this.getOruMessage(id)
    if (!record) throw new NotFoundException(`ORU message ${id} not found`)
    const mode: 'MLLP' | 'STUB' = this.hisEndpoint.enabled && this.hisEndpoint.host ? 'MLLP' : 'STUB'
    record.attempts += 1
    record.updatedAt = new Date().toISOString()
    if (mode === 'MLLP') {
      try {
        const ackMessage = await this.sendMllpMessage(this.hisEndpoint.host, this.hisEndpoint.port, record.message)
        record.ackMessage = ackMessage
        record.ackStatus = ackMessage.split('\r').find((s) => s.startsWith('MSA'))?.split('|')[1] ?? 'AA'
        record.status = record.ackStatus === 'AA' ? 'SENT' : 'FAILED'
        record.error = undefined
      } catch (err) {
        record.ackStatus = 'FAILED'
        record.status = 'FAILED'
        record.error = (err as Error).message
      }
    } else {
      record.ackMessage = `MSH|^~\\&|HIS|HIS_RECEIVER|G005|G005|${nowHL7()}||ACK^R01|ACK-${record.controlId}|P|2.5.1\rMSA|AA|${record.controlId}\r`
      record.ackStatus = 'AA'
      record.status = 'STUBBED'
      record.error = undefined
    }
    return record
  }

  // ================= [W10E-3] 扩展: HL7 总览 / 错误分析 / 吞吐趋势 / 消息类型 =================

  async getOverview(): Promise<Hl7OverviewDto> {    try {
      const rows = await this.prisma.hl7MessageArchive.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 90 * 86400000) } },
        select: { id: true, messageType: true, direction: true, ackStatus: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 100000,
      })
      if (rows.length > 0) return this.overviewFromRows(rows, false)
    } catch (err) {
      this.logger.warn(`[HL7] getOverview DB failed, fallback to seed: ${(err as Error).message}`)
    }
    return this.seedOverview()
  }

  private overviewFromRows(rows: Array<{ id: string; messageType: string; direction: string; ackStatus: string | null; createdAt: Date }>, seeded: boolean): Hl7OverviewDto {
    const todayKey = hl7LocalDateStr(new Date())
    let todayMessages = 0
    let inbound = 0
    let outbound = 0
    let success = 0
    let failed = 0
    const ackMap = new Map<string, number>()
    const typeMap = new Map<string, number>()
    for (const r of rows) {
      if (hl7LocalDateStr(new Date(r.createdAt)) === todayKey) todayMessages += 1
      if (r.direction === 'INBOUND') inbound += 1
      else outbound += 1
      const ack = r.ackStatus ?? 'PENDING'
      if (ack === 'AA') success += 1
      else if (ack === 'AE' || ack === 'AR' || ack === 'FAILED') failed += 1
      ackMap.set(ack, (ackMap.get(ack) ?? 0) + 1)
      typeMap.set(r.messageType, (typeMap.get(r.messageType) ?? 0) + 1)
    }
    const total = rows.length
    return {
      totalMessages: total,
      todayMessages,
      inboundCount: inbound,
      outboundCount: outbound,
      successCount: success,
      failedCount: failed,
      successRate: total > 0 ? Math.round((success / total) * 100) : 0,
      ackStatusBreakdown: Array.from(ackMap.entries())
        .map(([ackStatus, count]) => ({ ackStatus, count }))
        .sort((a, b) => b.count - a.count),
      byType: Array.from(typeMap.entries())
        .map(([messageType, count]) => ({ messageType, count, percent: Math.round((count / total) * 100) }))
        .sort((a, b) => b.count - a.count),
      seeded,
    }
  }

  private seedOverview(): Hl7OverviewDto {
    const seed = `hl7-overview:${hl7LocalDateStr(new Date())}`
    const defs = ['ORU^R01', 'ORM^O01', 'ADT^A01', 'ADT^A04', 'SIU^S12', 'DFT^P03', 'ACK']
    const total = Math.round(hl7SeededRand(2600, 3400, `${seed}:total`))
    const failed = Math.round(total * hl7SeededRand(0.02, 0.06, `${seed}:failed`))
    const counts = defs.map((messageType) => Math.round(total * hl7SeededRand(0.06, 0.26, `${seed}:type:${messageType}`)))
    const percents = allocatePercent(counts)
    const byType = counts
      .map((count, i) => ({ messageType: defs[i]!, count, percent: percents[i]! }))
      .sort((a, b) => b.count - a.count)
    return {
      totalMessages: total,
      todayMessages: Math.round(total / 30),
      inboundCount: Math.round(total * 0.55),
      outboundCount: total - Math.round(total * 0.55),
      successCount: total - failed,
      failedCount: failed,
      successRate: Math.round(((total - failed) / total) * 100),
      ackStatusBreakdown: [
        { ackStatus: 'AA', count: total - failed },
        { ackStatus: 'AE', count: Math.round(failed * 0.6) },
        { ackStatus: 'AR', count: Math.round(failed * 0.25) },
        { ackStatus: 'FAILED', count: failed - Math.round(failed * 0.85) },
      ].filter((x) => x.count > 0),
      byType,
      seeded: true,
    }
  }

  async getErrorAnalysis(): Promise<Hl7ErrorAnalysisDto> {
    try {
      const rows = await this.prisma.hl7MessageArchive.findMany({
        where: { ackStatus: { in: ['AE', 'AR', 'FAILED'] } },
        select: { id: true, messageType: true, ackStatus: true, direction: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50000,
      })
      if (rows.length > 0) {
        const byErrorType = new Map<string, number>()
        const byChannel = new Map<string, number>()
        const byHour = new Map<string, number>()
        for (const r of rows) {
          const ack = r.ackStatus ?? 'UNKNOWN'
          byErrorType.set(ack, (byErrorType.get(ack) ?? 0) + 1)
          byChannel.set(r.direction, (byChannel.get(r.direction) ?? 0) + 1)
          const hour = String(new Date(r.createdAt).getHours()).padStart(2, '0')
          byHour.set(hour, (byHour.get(hour) ?? 0) + 1)
        }
        const total = rows.length
        return {
          totalErrors: total,
          byErrorType: Array.from(byErrorType.entries())
            .map(([errorType, count]) => ({ errorType, count, percent: Math.round((count / total) * 100) }))
            .sort((a, b) => b.count - a.count),
          byChannel: Array.from(byChannel.entries())
            .map(([channel, count]) => ({ channel, count }))
            .sort((a, b) => b.count - a.count),
          byHour: Array.from(byHour.entries())
            .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
            .sort((a, b) => a.hour.localeCompare(b.hour)),
          recentErrors: rows.slice(0, 10).map((r) => ({
            id: r.id,
            messageType: r.messageType,
            ackStatus: r.ackStatus ?? '',
            createdAt: new Date(r.createdAt).toISOString(),
          })),
          seeded: false,
        }
      }
    } catch (err) {
      this.logger.warn(`[HL7] getErrorAnalysis DB failed, fallback to seed: ${(err as Error).message}`)
    }
    return this.seedErrorAnalysis()
  }

  private seedErrorAnalysis(): Hl7ErrorAnalysisDto {
    const seed = `hl7-errors:${hl7LocalDateStr(new Date())}`
    const errCounts = [
      Math.round(hl7SeededRand(30, 70, `${seed}:AE`)),
      Math.round(hl7SeededRand(8, 25, `${seed}:AR`)),
      Math.round(hl7SeededRand(5, 18, `${seed}:FAILED`)),
    ]
    const errPercents = allocatePercent(errCounts)
    const byErrorType = errCounts.map((count, i) => ({
      errorType: i === 0 ? 'AE' : i === 1 ? 'AR' : 'FAILED',
      count,
      percent: errPercents[i]!,
    }))
    const total = errCounts.reduce((a, b) => a + b, 0)
    const base = new Date()
    base.setHours(0, 0, 0, 0)
    return {
      totalErrors: total,
      byErrorType,
      byChannel: [
        { channel: 'INBOUND', count: Math.round(total * hl7SeededRand(0.45, 0.6, `${seed}:inbound`)) },
        { channel: 'OUTBOUND', count: Math.round(total * hl7SeededRand(0.4, 0.55, `${seed}:outbound`)) },
      ],
      byHour: Array.from({ length: 24 }, (_, h) => ({
        hour: `${String(h).padStart(2, '0')}:00`,
        count: Math.round(hl7SeededRand(1, 9, `${seed}:hour:${h}`)),
      })),
      recentErrors: Array.from({ length: 5 }, (_, i) => ({
        id: `hl7-err-${i + 1}`,
        messageType: i % 2 === 0 ? 'ORU^R01' : 'ADT^A01',
        ackStatus: i % 2 === 0 ? 'AE' : 'AR',
        createdAt: new Date(base.getTime() - (i + 1) * 3600000).toISOString(),
      })),
      seeded: true,
    }
  }

  async getThroughput(days = 30): Promise<Hl7ThroughputPoint[]> {
    const count = Math.max(1, Math.min(Math.round(days) || 30, 60))
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - (count - 1))
    try {
      const rows = await this.prisma.hl7MessageArchive.findMany({
        where: { createdAt: { gte: start } },
        select: { messageType: true, ackStatus: true, direction: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 200000,
      })
      if (rows.length > 0) {
        const byDate = new Map<string, { total: number; success: number; failed: number }>()
        for (const r of rows) {
          const key = hl7LocalDateStr(new Date(r.createdAt))
          const e = byDate.get(key) ?? { total: 0, success: 0, failed: 0 }
          e.total += 1
          const ack = r.ackStatus ?? 'PENDING'
          if (ack === 'AA') e.success += 1
          else if (ack === 'AE' || ack === 'AR' || ack === 'FAILED') e.failed += 1
          byDate.set(key, e)
        }
        return Array.from({ length: count }, (_, i) => {
          const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
          const key = hl7LocalDateStr(d)
          const e = byDate.get(key) ?? { total: 0, success: 0, failed: 0 }
          return {
            date: key,
            label: key.slice(5),
            total: e.total,
            success: e.success,
            failed: e.failed,
            successRate: e.total > 0 ? Math.round((e.success / e.total) * 100) : 0,
            seeded: false,
          }
        })
      }
    } catch (err) {
      this.logger.warn(`[HL7] getThroughput DB failed, fallback to seed: ${(err as Error).message}`)
    }
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      const key = hl7LocalDateStr(d)
      const total = Math.round(hl7SeededRand(120, 260, `hl7-throughput:${key}:total`))
      const failed = Math.round(total * hl7SeededRand(0.01, 0.08, `hl7-throughput:${key}:failed`))
      return {
        date: key,
        label: key.slice(5),
        total,
        success: total - failed,
        failed,
        successRate: Math.round(((total - failed) / total) * 100),
        seeded: true,
      }
    })
  }

  async getMessageTypes(): Promise<Hl7MessageTypeDto[]> {
    try {
      const rows = await this.prisma.hl7MessageArchive.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 90 * 86400000) } },
        select: { id: true, messageType: true, direction: true, rawMessage: true, ackStatus: true },
        orderBy: { createdAt: 'desc' },
        take: 100000,
      })
      if (rows.length > 0) {
        const byType = new Map<string, { count: number; bytes: number; inbound: number; outbound: number }>()
        for (const r of rows) {
          const e = byType.get(r.messageType) ?? { count: 0, bytes: 0, inbound: 0, outbound: 0 }
          e.count += 1
          e.bytes += Buffer.byteLength(r.rawMessage ?? '', 'utf8')
          if (r.direction === 'INBOUND') e.inbound += 1
          else e.outbound += 1
          byType.set(r.messageType, e)
        }
        const total = rows.length
        return Array.from(byType.entries())
          .map(([messageType, e]) => ({
            messageType,
            count: e.count,
            percent: Math.round((e.count / total) * 100),
            avgBytes: Math.round(e.bytes / Math.max(1, e.count)),
            direction: e.inbound >= e.outbound ? 'INBOUND' : 'OUTBOUND',
          }))
          .sort((a, b) => b.count - a.count)
      }
    } catch (err) {
      this.logger.warn(`[HL7] getMessageTypes DB failed, fallback to seed: ${(err as Error).message}`)
    }
    return this.seedMessageTypes()
  }

  private seedMessageTypes(): Hl7MessageTypeDto[] {
    const seed = `hl7-types:${hl7LocalDateStr(new Date())}`
    const defs = ['ORU^R01', 'ORM^O01', 'ADT^A01', 'ADT^A04', 'SIU^S12', 'DFT^P03', 'ACK']
    const counts = defs.map((messageType) => Math.round(hl7SeededRand(180, 900, `${seed}:count:${messageType}`)))
    const percents = allocatePercent(counts)
    return counts
      .map((count, i) => ({
        messageType: defs[i]!,
        count,
        percent: percents[i]!,
        avgBytes: Math.round(hl7SeededRand(300, 2800, `${seed}:bytes:${defs[i]!}`)),
        direction: i === defs.length - 1 ? 'OUTBOUND' : 'INBOUND',
      }))
      .sort((a, b) => b.count - a.count)
  }

  /**
   * 组装 ORU^R01 MSH 段。 [v3.0.6.11-79] MSH.3/MSH.4 发送方读取 admin config hospital_name,
   * 未配置时回退 G005_RIS / G005_HOSPITAL。异步: 经 SystemConfigService 缓存读取。
   */
  async buildORU(r: ReportForHL7): Promise<string> {
    const ts = nowHL7()
    const ctrlId = `G005-${r.reportId}-${ts}`
    const hospitalName = await this.systemConfig.getString('hospital_name', 'G005 放射科信息管理系统')
    const sendingApp = hospitalName.length > 15 ? hospitalName.slice(0, 15) : hospitalName

    const msh = [
      'MSH',
      `^~\\&`,
      sendingApp,
      hospitalName,
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
