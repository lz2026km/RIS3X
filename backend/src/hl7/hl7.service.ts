/**
 * G005 放射RIS系统 v3.0.2 - HL7 报告导出服务
 * v3.0.6.11-8: 添加 MLLP TCP Listener + ADT A01/A04 解析
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import * as net from 'net'
import { PrismaService } from '../prisma/prisma.service'

export interface ReportForHL7 {
  accessionNumber: string
  patientName: string
  patientId: string
  patientSex: 'M' | 'F' | 'O' | ''
  patientBirthDate?: string
  modality: string
  studyDate: string // YYYYMMDD
  studyTime: string // HHMMSS
  findings: string
  conclusion: string
  authorName: string
  authorId: string
  reviewerName?: string
  reviewedAt?: Date
  reportId: string
  radsCategory?: string
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
  parsed: Record<string, any>
  direction: 'INBOUND' | 'OUTBOUND'
  createdAt: Date
}

@Injectable()
export class Hl7Service implements OnModuleInit {
  private readonly logger = new Logger(Hl7Service.name)
  private mllpServer: net.Server | null = null

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    this.startMllpListener()
  }

  private startMllpListener(): void {
    const port = Number(process.env['HL7_MLLP_PORT'] ?? 2575)
    this.mllpServer = net.createServer((socket) => {
      this.logger.log(`MLLP client connected: ${socket.remoteAddress}:${socket.remotePort}`)
      let buffer = Buffer.alloc(0)

      socket.on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk])
        // MLLP framing: SB (0x0B) ... EB (0x1C) CR (0x0D)
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
    })

    this.mllpServer.on('error', (err) => {
      this.logger.error(`MLLP server error: ${err.message}`)
    })

    this.mllpServer.listen(port, () => {
      this.logger.log(`HL7 MLLP listener started on port ${port}`)
    })
  }

  private async handleInboundMessage(raw: string, socket: net.Socket): Promise<void> {
    const segments = raw.split('\r')
    const msh = segments.find((s) => s.startsWith('MSH'))
    if (!msh) {
      this.sendAck(socket, raw, 'AR')
      return
    }
    const fields = msh.split('|')
    const messageType = fields[8] ?? 'UNKNOWN'
    const controlId = fields[9] ?? ''

    this.logger.log(`Received HL7 message: ${messageType} ctrlId=${controlId}`)

    try {
      await this.prisma.hl7MessageArchive.create({
        data: {
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
      } else {
        this.logger.warn(`Unsupported HL7 message type: ${messageType}`)
      }
    } catch (err) {
      this.logger.error(`Failed to process ${messageType}: ${(err as Error).message}`)
      ackCode = 'AE'
    }

    this.sendAck(socket, raw, ackCode)
  }

  private async handleAdtMessage(segments: string[], messageType: string): Promise<void> {
    const pid = segments.find((s) => s.startsWith('PID'))
    if (!pid) return
    const pidFields = pid.split('|')
    const patientId = pidFields[3]?.split('^')[0] ?? ''
    const patientName = pidFields[5]?.split('^')[0] ?? ''
    const birthDate = pidFields[7] ?? ''
    const sex = pidFields[8] ?? ''

    this.logger.log(`ADT ${messageType}: patientId=${patientId}, name=${patientName}, DOB=${birthDate}, sex=${sex}`)
    // 后续可集成到 Prisma Patient 创建/更新逻辑
  }

  private sendAck(socket: net.Socket, rawMessage: string, ackCode: string): void {
    const mshMatch = rawMessage.match(/MSH\|([^\r]+)/)
    const fields = mshMatch ? mshMatch[1].split('|') : []
    const sendingApp = fields[2] ?? ''
    const sendingFacility = fields[3] ?? ''
    const receivingApp = fields[4] ?? ''
    const receivingFacility = fields[5] ?? ''
    const dateTime = fields[6] ?? ''
    const controlId = fields[9] ?? ''
    const version = fields[11] ?? '2.5.1'

    const ack = [
      'MSH',
      '^~\\&',
      receivingApp,
      receivingFacility,
      sendingApp,
      sendingFacility,
      new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14),
      '',
      'ACK',
      `ACK-${controlId}`,
      'P',
      version,
      '',
      '',
      '',
      '',
      'NE',
      'AL',
    ].join('|')

    const errSegment = ackCode !== 'AA'
      ? `\rERR|^^^${ackCode}^E`
      : ''

    const msa = `\rMSA|${ackCode}|${controlId}`
    const ackMsg = `${ack}${msa}${errSegment}\r`
    const framed = Buffer.concat([Buffer.from([0x0b]), Buffer.from(ackMsg, 'utf8'), Buffer.from([0x1c, 0x0d])])
    socket.write(framed)
  }

  stopMllpListener(): void {
    if (this.mllpServer) {
      this.mllpServer.close()
      this.mllpServer = null
      this.logger.log('MLLP listener stopped')
    }
  }
  /**
   * 构造 HL7 ORU^R01 报告消息
   */
  buildORU(r: ReportForHL7): string {
    const ts = nowHL7()
    const ctrlId = `G005-${r.reportId}-${ts}`

    // MSH 头
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

    // PID 患者信息
    const pid = [
      'PID',
      '1',
      '',
      `${r.patientId}^^^G005^MR`,
      '',
      `${r.patientName}`,
      '',
      `${r.patientBirthDate ?? ''}`,
      `${r.patientSex === 'M' ? 'M' : r.patientSex === 'F' ? 'F' : 'O'}`,
    ].join(HL7_DELIMS.field)

    // PV1 就诊
    const pv1 = ['PV1', '1', 'O', '', '', '', '', '', '', '', '', '', `${r.accessionNumber}^^G005^ACC`].join(HL7_DELIMS.field)

    // OBR 检查申请
    const obr = [
      'OBR',
      '1',
      `${r.accessionNumber}^^G005^ACC`,
      '',
      `${r.modality}^${r.modality}^CPT`,
      '',
      `${r.studyDate}${r.studyTime}`,
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
      `${r.authorId}^${r.authorName}^^G005^DOC`,
    ].join(HL7_DELIMS.field)

    // OBX 观察/结果
    const obxLines: string[] = []
    let obxSeq = 1
    obxLines.push(
      ['OBX', String(obxSeq++), 'TX', 'FINDINGS^Impression^L', '', this.escapeText(r.findings)].join(HL7_DELIMS.field)
    )
    obxLines.push(
      ['OBX', String(obxSeq++), 'TX', 'CONCLUSION^Conclusion^L', '', this.escapeText(r.conclusion)].join(HL7_DELIMS.field)
    )
    if (r.radsCategory) {
      obxLines.push(
        ['OBX', String(obxSeq++), 'CE', 'RADS^RADS Category^L', '', r.radsCategory].join(HL7_DELIMS.field)
      )
    }

    return [msh, pid, pv1, obr, ...obxLines].join('\r\n')
  }

  /** 转义 HL7 特殊字符 */
  private escapeText(s: string): string {
    return s
      .replace(/\\/g, '\\E\\')
      .replace(/\|/g, '\\F\\')
      .replace(/\^/g, '\\S\\')
      .replace(/~/g, '\\R\\')
      .replace(/\r?\n/g, '\\.br\\')
  }
}
