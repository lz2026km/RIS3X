import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as fs from 'node:fs'
import * as net from 'node:net'
import * as http from 'node:http'
import * as https from 'node:https'
import * as path from 'node:path'
import { PrismaService } from '../prisma/prisma.service'
import type { CFindMwlDto } from './dto'

@Injectable()
export class DicomDimseService {
  private readonly logger = new Logger(DicomDimseService.name)
  private readonly storageDir: string
  private readonly supportedStorageSopClasses: Set<string>

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.storageDir = this.config.get<string>('DICOM_STORAGE_DIR', 'dicom')
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true })
    }
    this.supportedStorageSopClasses = new Set([
      '1.2.840.10008.5.1.4.1.1.1',    // CR Image
      '1.2.840.10008.5.1.4.1.1.2',    // CT Image
      '1.2.840.10008.5.1.4.1.1.4',    // MR Image
      '1.2.840.10008.5.1.4.1.1.7',    // Secondary Capture
      '1.2.840.10008.5.1.4.1.1.12.1', // XA Image
      '1.2.840.10008.5.1.4.1.1.12.2', // XRF Image
      '1.2.840.10008.5.1.4.1.1.13.1.3', // Breast Tomosynthesis
      '1.2.840.10008.5.1.4.1.1.481.2',  // NM Image
      '1.2.840.10008.5.1.4.1.1.88.33',  // Comprehensive SR
      '1.2.840.10008.5.1.4.1.1.88.22',  // Enhanced SR
    ])
  }

  async cEcho(params?: { affectedSopClassUid?: string; calledAeTitle?: string; callingAeTitle?: string }): Promise<{
    statusCode: number
    affectedSopClassUid: string
    message: string
    calledAeTitle?: string
    callingAeTitle?: string
  }> {
    return {
      statusCode: 0x0000,
      affectedSopClassUid: params?.affectedSopClassUid ?? '1.2.840.10008.1.1',
      message: 'C-ECHO-RSP: Success',
      calledAeTitle: params?.calledAeTitle,
      callingAeTitle: params?.callingAeTitle,
    }
  }

  async cStore(dto: {
    sopClassUid: string
    sopInstanceUid: string
    studyInstanceUid: string
    seriesInstanceUid: string
    modality: string
    patientId?: string
    patientName?: string
    studyDate?: string
    studyDescription?: string
    seriesNumber?: number
    instanceNumber?: number
    transferSyntax?: string
    pixelData?: string
  }): Promise<{ sopInstanceUid: string; storagePath: string; sizeBytes: number }> {
    if (!this.supportedStorageSopClasses.has(dto.sopClassUid)) {
      throw new BadRequestException(`Unsupported SOP Class UID: ${dto.sopClassUid}`)
    }
    const tsList = [
      '1.2.840.10008.1.2',       '1.2.840.10008.1.2.1',   '1.2.840.10008.1.2.4.50',
      '1.2.840.10008.1.2.4.51',  '1.2.840.10008.1.2.4.57', '1.2.840.10008.1.2.4.70',
      '1.2.840.10008.1.2.4.80',  '1.2.840.10008.1.2.4.81', '1.2.840.10008.1.2.4.90',
      '1.2.840.10008.1.2.4.91',
    ]
    const ts = dto.transferSyntax ?? '1.2.840.10008.1.2.1'
    if (!tsList.includes(ts)) {
      throw new BadRequestException(`Unsupported Transfer Syntax UID: ${ts}`)
    }
    const safeUid = (uid: string) => {
      if (!/^[A-Za-z0-9._-]+$/.test(uid)) {
        throw new BadRequestException(`Invalid UID: ${uid}`)
      }
      return uid
    }
    const sopDir = path.join(this.storageDir, safeUid(dto.studyInstanceUid), safeUid(dto.seriesInstanceUid))
    const resolvedDir = path.resolve(sopDir)
    if (!resolvedDir.startsWith(path.resolve(this.storageDir))) {
      throw new BadRequestException('Path traversal detected')
    }
    if (!fs.existsSync(sopDir)) {
      fs.mkdirSync(sopDir, { recursive: true })
    }
    const filePath = path.join(sopDir, `${safeUid(dto.sopInstanceUid)}.dcm`)
    const pixelBuf = dto.pixelData ? Buffer.from(dto.pixelData, 'base64') : Buffer.alloc(128, 0)
    const dicomBuffer = this.buildPart10Buffer({
      sopClassUid: dto.sopClassUid,
      sopInstanceUid: dto.sopInstanceUid,
      studyInstanceUid: dto.studyInstanceUid,
      seriesInstanceUid: dto.seriesInstanceUid,
      transferSyntax: ts,
      pixelData: pixelBuf,
      patientId: dto.patientId,
      patientName: dto.patientName,
      studyDate: dto.studyDate,
      studyDescription: dto.studyDescription,
      seriesNumber: dto.seriesNumber,
      instanceNumber: dto.instanceNumber,
      modality: dto.modality,
    })
    fs.writeFileSync(filePath, dicomBuffer)
    const sizeBytes = dicomBuffer.length

    const model = (this.prisma as any).dicomInstance
    if (model?.create) {
      try {
        await model.create({
          data: {
            studyInstanceUid: dto.studyInstanceUid,
            seriesInstanceUid: dto.seriesInstanceUid,
            sopInstanceUid: dto.sopInstanceUid,
            sopClassUid: dto.sopClassUid,
            modality: dto.modality,
            sizeBytes,
            storagePath: filePath,
            transferSyntax: ts,
          },
        })
      } catch (e) {
        this.logger.error(`Failed to persist DICOM instance metadata: ${(e as Error).message}`, (e as Error).stack)
      }
    }

    return { sopInstanceUid: dto.sopInstanceUid, storagePath: filePath, sizeBytes }
  }

  async cFindMwl(query: CFindMwlDto): Promise<{ matches: number; items: any[] }> {
    const where: any = {}
    if (query.patientName) where.patient = { name: { contains: query.patientName } }
    if (query.patientId) where.patient = { ...where.patient, id: { contains: query.patientId } }
    if (query.accessionNumber) where.accessionNumber = { contains: query.accessionNumber }
    if (query.modality) where.modality = query.modality
    if (query.scheduledDate) {
      where.scheduledAt = {
        gte: new Date(`${query.scheduledDate}T00:00:00`),
        lte: new Date(`${query.scheduledDate}T23:59:59`),
      }
    } else if (query.scheduledDateFrom || query.scheduledDateTo) {
      where.scheduledAt = {}
      if (query.scheduledDateFrom) where.scheduledAt.gte = new Date(`${query.scheduledDateFrom}T00:00:00`)
      if (query.scheduledDateTo) where.scheduledAt.lte = new Date(`${query.scheduledDateTo}T23:59:59`)
    }
    const items = await this.prisma.exam.findMany({
      where,
      include: { patient: true, device: true },
      orderBy: { scheduledAt: 'asc' },
      take: 200,
    })
    const mapped = items.map((exam) => ({
      patientName: exam.patient?.name ?? '',
      patientId: exam.patientId,
      accessionNumber: exam.accessionNumber,
      modality: exam.modality,
      bodyPart: exam.bodyPart,
      scheduledDateTime: exam.scheduledAt?.toISOString() ?? '',
      studyInstanceUid: `1.2.840.10008.${exam.id}`,
      examId: exam.id,
      deviceId: exam.deviceId,
      deviceName: (exam as any).device?.name ?? '',
      scheduledProcedureStepSequence: [
        {
          scheduledProcedureStepId: `SPS-${exam.id}`,
          scheduledStationAeTitle: (exam as any).device?.aeTitle ?? '',
          scheduledProcedureStepStartDate: exam.scheduledAt?.toISOString().slice(0, 10) ?? '',
          scheduledProcedureStepStartTime: exam.scheduledAt?.toISOString().slice(11, 19) ?? '',
          modality: exam.modality,
          scheduledPerformingPhysicianName: (exam as any).referringPhysician ?? '',
          requestedProcedureDescription: exam.bodyPart ?? '',
          requestedProcedureId: exam.accessionNumber ?? `RP-${exam.id}`,
        },
      ],
    }))
    return { matches: mapped.length, items: mapped }
  }

  private resolveAe(aeTitle: string): { host: string; port: number } {
    const mappingRaw = this.config.get<string>('DIMSE_AE_MAPPING', '')
    if (mappingRaw) {
      for (const entry of mappingRaw.split(';')) {
        const [ae, h, p] = entry.split(',')
        if (ae === aeTitle) return { host: h || '127.0.0.1', port: Number(p) || 11112 }
      }
    }
    const host = this.config.get<string>(`DIMSE_AE_HOST_${aeTitle}`, this.config.get<string>('DIMSE_DEFAULT_HOST', '127.0.0.1'))
    const port = this.config.get<number>(`DIMSE_AE_PORT_${aeTitle}`, this.config.get<number>('DIMSE_DEFAULT_PORT', 11112))
    return { host, port }
  }

  async cMove(dto: {
    studyInstanceUid?: string
    seriesInstanceUid?: string
    sopInstanceUid?: string
    destinationAe: string
    destinationHost?: string
    destinationPort?: number
  }): Promise<{
    statusCode: number
    destinationAe: string
    numberOfCompletedSubOperations: number
    numberOfFailedSubOperations: number
    numberOfRemainingSubOperations: number
    message: string
  }> {
    const aeTarget = this.resolveAe(dto.destinationAe)
    const host = dto.destinationHost ?? aeTarget.host
    const port = dto.destinationPort ?? aeTarget.port
    this.logger.log(`C-MOVE-RQ to AE=${dto.destinationAe} resolved=${host}:${port}`)
    const model = (this.prisma as any).dicomInstance
    if (!model?.findMany) {
      return {
        statusCode: 0xB000,
        destinationAe: dto.destinationAe,
        numberOfCompletedSubOperations: 0,
        numberOfFailedSubOperations: 0,
        numberOfRemainingSubOperations: 0,
        message: 'DICOM persistence not available',
      }
    }
    const where: any = {}
    if (dto.sopInstanceUid) where.sopInstanceUid = dto.sopInstanceUid
    if (dto.seriesInstanceUid) where.seriesInstanceUid = dto.seriesInstanceUid
    if (dto.studyInstanceUid) where.studyInstanceUid = dto.studyInstanceUid
    const instances = await model.findMany({ where })
    const total = instances.length
    this.logger.log(`C-MOVE: ${total} instance(s) to transmit to ${dto.destinationAe} at ${host}:${port}`)
    let completed = 0
    let failed = 0
    for (const inst of instances) {
      if (inst.storagePath && fs.existsSync(inst.storagePath)) {
        try {
          const data = fs.readFileSync(inst.storagePath)
          const client = new net.Socket()
          await new Promise<void>((resolve, reject) => {
            client.connect(port, host, () => {
              client.write(data)
            })
            client.on('end', resolve)
            client.on('error', reject)
            setTimeout(() => { client.destroy(); resolve() }, 10000).unref()
          })
          completed++
        } catch (e) {
          this.logger.error(`C-MOVE transfer failed for ${inst.sopInstanceUid}: ${(e as Error).message}`)
          failed++
        }
      } else {
        failed++
      }
    }
    return {
      statusCode: failed > 0 ? 0xB000 : 0x0000,
      destinationAe: dto.destinationAe,
      numberOfCompletedSubOperations: completed,
      numberOfFailedSubOperations: failed,
      numberOfRemainingSubOperations: total - completed - failed,
      message: `C-MOVE to ${dto.destinationAe} at ${host}:${port}`,
    }
  }

  async uploadToS3(dto: {
    sopInstanceUid: string
    bucketName?: string
    endpoint?: string
    region?: string
  }): Promise<{ status: string; url: string }> {
    const model = (this.prisma as any).dicomInstance
    if (!model?.findUnique) {
      throw new NotFoundException('DICOM persistence not available')
    }
    const inst = await model.findUnique({ where: { sopInstanceUid: dto.sopInstanceUid } })
    if (!inst) throw new NotFoundException(`Instance ${dto.sopInstanceUid} not found`)
    if (!inst.storagePath || !fs.existsSync(inst.storagePath)) {
      throw new NotFoundException(`File not found on disk for ${dto.sopInstanceUid}`)
    }
    const bucket = dto.bucketName ?? 'dicom'
    const endpoint = dto.endpoint ?? this.config.get<string>('S3_ENDPOINT', 'http://localhost:9000')
    const accessKey = process.env['S3_ACCESS_KEY']
    const secretKey = process.env['S3_SECRET_KEY']
    if (!accessKey || !secretKey) {
      throw new BadRequestException('S3_ACCESS_KEY and S3_SECRET_KEY environment variables must be set')
    }
    const region = dto.region ?? this.config.get<string>('S3_REGION', 'us-east-1')
    const objectKey = `${inst.studyInstanceUid}/${inst.seriesInstanceUid}/${inst.sopInstanceUid}.dcm`
    const fileBuffer = fs.readFileSync(inst.storagePath)
    const url = `${endpoint}/${bucket}/${objectKey}`
    try {
      const parsed = new URL(endpoint)
      const useTls = parsed.protocol === 'https:'
      const httpModule = useTls ? https : http
      const auth = Buffer.from(`${accessKey}:${secretKey}`).toString('base64')
      const reqOptions = {
        hostname: parsed.hostname,
        port: parsed.port || (useTls ? 443 : 80),
        path: `/${bucket}/${objectKey}`,
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/dicom',
          'Content-Length': fileBuffer.length.toString(),
          'x-amz-acl': 'private',
        },
      }
      await new Promise<void>((resolve, reject) => {
        const req = httpModule.request(reqOptions, (res) => {
          res.on('data', () => {})
          res.on('end', resolve)
        })
        req.on('error', reject)
        req.write(fileBuffer)
        req.end()
      })
      this.logger.log(`Uploaded to S3: ${url}`)
    } catch (e) {
      this.logger.error(`S3 upload failed: ${(e as Error).message}`, (e as Error).stack)
      throw new BadRequestException(`S3 upload failed: ${(e as Error).message}`)
    }
    return { status: 'SUCCESS', url }
  }

  private buildPart10Buffer(opts: {
    sopClassUid: string
    sopInstanceUid: string
    studyInstanceUid: string
    seriesInstanceUid: string
    transferSyntax: string
    pixelData: Buffer
    patientId?: string
    patientName?: string
    studyDate?: string
    studyDescription?: string
    seriesNumber?: number
    instanceNumber?: number
    modality?: string
  }): Buffer {
    const isExplicit = opts.transferSyntax !== '1.2.840.10008.1.2'
    const valBuf = (s: string): Buffer => {
      const b = Buffer.from(s, 'utf8')
      return s.length % 2 !== 0 ? Buffer.concat([b, Buffer.from([0])]) : b
    }
    const u16le = (n: number): Buffer => { const b = Buffer.alloc(2); b.writeUInt16LE(n, 0); return b }
    const u32le = (n: number): Buffer => { const b = Buffer.alloc(4); b.writeUInt32LE(n, 0); return b }
    const encodeElement = (tagGrp: number, tagEl: number, vr: string, value: Buffer): Buffer => {
      const parts: Buffer[] = [u16le(tagGrp), u16le(tagEl)]
      if (isExplicit) {
        parts.push(Buffer.from(vr.padEnd(2, ' '), 'ascii'))
        const longVr = ['OB', 'OD', 'OF', 'OL', 'OW', 'SQ', 'UC', 'UN', 'UR']
        if (longVr.includes(vr)) {
          parts.push(u16le(0), u32le(value.length))
        } else {
          parts.push(u16le(value.length))
        }
      } else {
        parts.push(u32le(value.length))
      }
      parts.push(value)
      if (value.length % 2 !== 0) parts.push(Buffer.from([0]))
      return Buffer.concat(parts)
    }
    const encodeMeta = (hexTag: string, vr: string, value: Buffer): Buffer => {
      const g = parseInt(hexTag.slice(0, 4), 16)
      const e = parseInt(hexTag.slice(4, 8), 16)
      return encodeElement(g, e, vr, value)
    }
    const metaElements: Buffer[] = []
    metaElements.push(encodeMeta('00020001', 'OB', Buffer.from([0x01, 0x00])))
    metaElements.push(encodeMeta('00020002', 'UI', valBuf(opts.sopClassUid)))
    metaElements.push(encodeMeta('00020003', 'UI', valBuf(opts.sopInstanceUid)))
    metaElements.push(encodeMeta('0002000D', 'UI', valBuf(opts.studyInstanceUid)))
    metaElements.push(encodeMeta('0002000E', 'UI', valBuf(opts.seriesInstanceUid)))
    metaElements.push(encodeMeta('00020010', 'UI', valBuf(opts.transferSyntax)))
    metaElements.push(encodeMeta('00020012', 'UI', valBuf('1.2.840.10008.5.1.4.1.2.1.1')))
    metaElements.push(encodeMeta('00020013', 'SH', valBuf('G005-RIS-DIMSE-3.0')))
    const metaBody = Buffer.concat(metaElements)
    const glBuf = u32le(metaBody.length)
    const groupLen = encodeMeta('00020000', 'UL', glBuf)
    const fileMeta = Buffer.concat([groupLen, metaBody])
    const preamble = Buffer.alloc(128, 0)
    const dicm = Buffer.from('DICM', 'ascii')
    const datasetElements: Buffer[] = []
    const encodeDs = (tagGrp: number, tagEl: number, vr: string, value: Buffer) => {
      datasetElements.push(encodeElement(tagGrp, tagEl, vr, value))
    }
    if (opts.patientName) encodeDs(0x0010, 0x0010, 'PN', valBuf(opts.patientName))
    if (opts.patientId) encodeDs(0x0010, 0x0020, 'LO', valBuf(opts.patientId))
    if (opts.studyDate) encodeDs(0x0008, 0x0020, 'DA', valBuf(opts.studyDate))
    if (opts.studyDescription) encodeDs(0x0008, 0x1030, 'LO', valBuf(opts.studyDescription))
    if (opts.modality) encodeDs(0x0008, 0x0060, 'CS', valBuf(opts.modality))
    if (opts.seriesNumber !== undefined) encodeDs(0x0020, 0x0011, 'IS', valBuf(String(opts.seriesNumber)))
    if (opts.instanceNumber !== undefined) encodeDs(0x0020, 0x0013, 'IS', valBuf(String(opts.instanceNumber)))
    encodeDs(0x0008, 0x0016, 'UI', valBuf(opts.sopClassUid))
    encodeDs(0x0008, 0x0018, 'UI', valBuf(opts.sopInstanceUid))
    encodeDs(0x0020, 0x000D, 'UI', valBuf(opts.studyInstanceUid))
    encodeDs(0x0020, 0x000E, 'UI', valBuf(opts.seriesInstanceUid))
    encodeDs(0x0028, 0x0002, 'US', u16le(1))
    encodeDs(0x0028, 0x0010, 'US', u16le(1))
    encodeDs(0x0028, 0x0011, 'US', u16le(1))
    encodeDs(0x0028, 0x0100, 'US', u16le(8))
    encodeDs(0x0028, 0x0004, 'CS', valBuf('MONOCHROME2'))
    encodeDs(0x7FE0, 0x0010, 'OB', opts.pixelData)
    const dataset = Buffer.concat(datasetElements)
    return Buffer.concat([preamble, dicm, fileMeta, dataset])
  }
}
