import { Injectable, Logger, NotFoundException, BadRequestException, Optional, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as net from 'node:net'
import { PrismaService } from '../prisma/prisma.service'
import { STORAGE_DRIVER } from '../common/storage/storage.module'
import { LocalStorageDriver } from '../common/storage/local-storage.driver'
import { S3StorageDriver } from '../common/storage/s3-storage.driver'
import type { StorageDriver } from '../common/storage/storage.interface'
import { currentTenantId } from '../common/tenant/tenant-utils'
import type { CFindMwlDto } from './dto'

/** [G005 v3.0.6.11-86 Wave 4B (G-03)] DICOM TLS 配置 (内存 + seed 回退, 对标 HL7 MLLP TLS) */
export interface DicomTlsConfig {
  enabled: boolean
  certificate?: string
  caCert?: string
  port?: number
  verifyPeer?: boolean
}

/** [G005 v3.0.6.11-86 Wave 4B (G-05)] MPPS 进度记录 */
export interface MppsRecord {
  studyUid: string
  status: 'IN_PROGRESS' | 'COMPLETED' | 'DISCONTINUED'
  patientName?: string
  patientId?: string
  modality?: string
  startedAt?: string
  completedAt?: string
  performedSteps: Array<{ code?: string; description?: string; startTime?: string; endTime?: string }>
  updatedAt: string
  source: 'mpps' | 'exam'
}

/** [G005 v3.0.6.11-90 Wave 4A (PACS P0-1)] DICOM C-STORE 传输任务记录
 * [G005 v3.0.6.11-96 Wave 2B (D)] 新增 examId/accessionNumber (worklist 联动: 反查检查或前端传入) */
export interface TransferRecord {
  id: string
  studyUid: string
  targetAe: string
  status: 'queued' | 'sending' | 'paused' | 'failed' | 'completed' | 'canceled'
  progress: number // 0-100
  totalInstances: number
  completedInstances: number
  priority: 'HIGH' | 'NORMAL' | 'LOW'
  createdAt: string
  updatedAt: string
  error?: string
  source: 'queue' | 'seed'
  examId?: string
  accessionNumber?: string
}

@Injectable()
export class DicomDimseService {
  private readonly logger = new Logger(DicomDimseService.name)
  private readonly storageDir: string
  private readonly storage: StorageDriver
  private readonly supportedStorageSopClasses: Set<string>
  // [G005 v3.0.6.11-86 Wave 4B (G-03)] TLS 配置 (内存 + 环境 seed 回退)
  private tlsConfig: DicomTlsConfig
  // [G005 v3.0.6.11-86 Wave 4B (G-03)] 节点级 TLS 开关 (内存; key = AE Title / node id)
  private readonly nodeTls = new Map<string, boolean>()
  // [G005 v3.0.6.11-86 Wave 4B (G-05)] MPPS 记录 (内存)
  private readonly mppsRecords = new Map<string, MppsRecord>()
  // [G005 v3.0.6.11-90 Wave 4A (PACS P0-1)] DICOM C-STORE 传输队列 (内存; key = 任务 id)
  private readonly transfers = new Map<string, TransferRecord>()
  private transferSeq = 0

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() @Inject(STORAGE_DRIVER) storageDriver?: StorageDriver,
  ) {
    this.storageDir = this.config.get<string>('DICOM_STORAGE_DIR', 'dicom')
    this.storage = storageDriver ?? new LocalStorageDriver({ root: this.storageDir })
    this.tlsConfig = {
      enabled: this.config.get<string>('DIMSE_TLS_ENABLED', 'false') === 'true',
      certificate: this.config.get<string>('DIMSE_TLS_CERT', ''),
      caCert: this.config.get<string>('DIMSE_TLS_CA_CERT', ''),
      port: Number(this.config.get<string>('DIMSE_TLS_PORT', '2762')) || 2762,
      verifyPeer: this.config.get<string>('DIMSE_TLS_VERIFY_PEER', 'false') === 'true',
    }
    const nodeTlsSeed = this.config.get<string>('DIMSE_NODE_TLS', '')
    for (const entry of nodeTlsSeed.split(';').filter(Boolean)) {
      const [ae, flag] = entry.split('=')
      if (ae && flag !== undefined) this.nodeTls.set(ae.trim(), flag.trim() === 'true')
    }
    // [G005 v3.0.6.11-90 Wave 4A (PACS P0-1)] 传输队列 seed (DIMSE_TRANSFER_SEED 或默认样例)
    const transferSeed = this.config.get<string>('DIMSE_TRANSFER_SEED', '')
    const seedRaw = transferSeed
      ? transferSeed.split('|').filter(Boolean).map((part) => {
          const [studyUid, targetAe, status, progress] = part.split(',')
          return { studyUid, targetAe, status, progress: Number(progress) || 0 }
        })
      : [
          { studyUid: '1.2.840.114350.1.1.20260801.001', targetAe: 'CT_SCANNER_01', status: 'sending', progress: 42 },
          { studyUid: '1.2.840.114350.1.1.20260801.002', targetAe: 'MR_SCANNER_02', status: 'queued', progress: 0 },
          { studyUid: '1.2.840.114350.1.1.20260731.003', targetAe: 'XA_LAB_01', status: 'completed', progress: 100 },
          { studyUid: '1.2.840.114350.1.1.20260730.004', targetAe: 'US_UNIT_01', status: 'failed', progress: 35 },
        ]
    for (const seed of seedRaw) {
      if (!seed.studyUid || !seed.targetAe) continue
      const now = new Date().toISOString()
      const id = `TR-${String(++this.transferSeq).padStart(4, '0')}`
      this.transfers.set(id, {
        id,
        studyUid: seed.studyUid,
        targetAe: seed.targetAe,
        status: (seed.status ?? 'queued') as TransferRecord['status'],
        progress: seed.progress,
        totalInstances: 12,
        completedInstances: Math.round((seed.progress / 100) * 12),
        priority: 'NORMAL',
        createdAt: now,
        updatedAt: now,
        source: 'seed',
        error: seed.status === 'failed' ? 'DICOM Association 超时 (seed 回退)' : undefined,
      })
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
      if (uid.includes('..')) {
        throw new BadRequestException(`Path traversal detected: ${uid}`)
      }
      return uid
    }
    const objectKey = `${safeUid(dto.studyInstanceUid)}/${safeUid(dto.seriesInstanceUid)}/${safeUid(dto.sopInstanceUid)}.dcm`
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
    await this.storage.put(objectKey, dicomBuffer, { contentType: 'application/dicom' })
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
            storagePath: objectKey,
            transferSyntax: ts,
          },
        })
      } catch (e) {
        this.logger.error(`Failed to persist DICOM instance metadata: ${(e as Error).message}`, (e as Error).stack)
      }
    }

    return { sopInstanceUid: dto.sopInstanceUid, storagePath: objectKey, sizeBytes }
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
      if (!inst.storagePath) {
        failed++
        continue
      }
      try {
        const data = await this.storage.get(inst.storagePath)
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
    if (!inst.storagePath) {
      throw new NotFoundException(`File not found for ${dto.sopInstanceUid}`)
    }
    const bucket = dto.bucketName ?? process.env['S3_BUCKET'] ?? this.config.get<string>('S3_BUCKET', 'dicom')
    const endpoint = dto.endpoint ?? process.env['S3_ENDPOINT'] ?? this.config.get<string>('S3_ENDPOINT', 'http://localhost:9000')
    const accessKey = process.env['S3_ACCESS_KEY']
    const secretKey = process.env['S3_SECRET_KEY']
    if (!accessKey || !secretKey) {
      throw new BadRequestException('S3_ACCESS_KEY and S3_SECRET_KEY environment variables must be set')
    }
    const region = dto.region ?? process.env['S3_REGION'] ?? this.config.get<string>('S3_REGION', 'us-east-1')
    const objectKey = `${inst.studyInstanceUid}/${inst.seriesInstanceUid}/${inst.sopInstanceUid}.dcm`
    const url = `${endpoint}/${bucket}/${objectKey}`
    try {
      const fileBuffer = await this.storage.get(inst.storagePath)
      const driver = new S3StorageDriver({ endpoint, bucket, accessKey, secretKey, region })
      await driver.put(objectKey, fileBuffer, { contentType: 'application/dicom' })
      this.logger.log(`Uploaded to S3 (SigV4): ${url}`)
    } catch (e) {
      this.logger.error(`S3 upload failed: ${(e as Error).message}`, (e as Error).stack)
      throw new BadRequestException(`S3 upload failed: ${(e as Error).message}`)
    }
    return { status: 'SUCCESS', url }
  }

  // ═══════════ [G005 v3.0.6.11-86 Wave 4B (G-03)] DICOM TLS 配置 (内存 + seed 回退) ═══════════

  getTlsConfig(): DicomTlsConfig {
    return { ...this.tlsConfig }
  }

  updateTlsConfig(dto: Partial<DicomTlsConfig>): DicomTlsConfig {
    this.tlsConfig = {
      ...this.tlsConfig,
      ...dto,
      // 空串证书视为未配置 (清理)
      certificate: dto.certificate === '' ? undefined : (dto.certificate ?? this.tlsConfig.certificate),
      caCert: dto.caCert === '' ? undefined : (dto.caCert ?? this.tlsConfig.caCert),
    }
    this.logger.log(
      `DIMSE TLS config updated: enabled=${this.tlsConfig.enabled} port=${this.tlsConfig.port} verifyPeer=${this.tlsConfig.verifyPeer}`,
    )
    return { ...this.tlsConfig }
  }

  getNodeTls(id: string): { id: string; tlsEnabled: boolean; supported: boolean } {
    const tlsEnabled = this.nodeTls.get(id) ?? false
    return { id, tlsEnabled, supported: true }
  }

  setNodeTls(id: string, enabled: boolean): { id: string; tlsEnabled: boolean; supported: boolean } {
    this.nodeTls.set(id, enabled)
    this.logger.log(`DIMSE node TLS updated: ${id} enabled=${enabled}`)
    return { id, tlsEnabled: enabled, supported: true }
  }

  // ═══════════ [G005 v3.0.6.11-86 Wave 4B (G-05)] MPPS (N-CREATE/N-SET 简化) ═══════════
  // [G005 v3.0.6.11-96 Wave 2B (B)] MPPS 落库: Prisma mpps_records 优先, DB 不可用回退内存 Map

  private toMppsRecord(row: any): MppsRecord {
    return {
      studyUid: row.studyUid,
      status: row.status as MppsRecord['status'],
      patientName: row.patientName ?? undefined,
      patientId: row.patientId ?? undefined,
      modality: row.modality ?? undefined,
      startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : undefined,
      completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : undefined,
      performedSteps: Array.isArray(row.steps) ? row.steps : [],
      updatedAt: new Date(row.updatedAt ?? Date.now()).toISOString(),
      source: (row.source ?? 'mpps') as MppsRecord['source'],
    }
  }

  async createOrUpdateMpps(dto: {
    studyUid: string
    status: 'IN_PROGRESS' | 'COMPLETED' | 'DISCONTINUED'
    performedSteps?: Array<{ code?: string; description?: string; startTime?: string; endTime?: string }>
  }): Promise<MppsRecord> {
    const now = new Date().toISOString()
    const existing = this.mppsRecords.get(dto.studyUid)
    const base: MppsRecord = {
      studyUid: dto.studyUid,
      status: dto.status,
      startedAt: existing?.startedAt ?? now,
      completedAt:
        dto.status === 'COMPLETED'
          ? now
          : dto.status === 'DISCONTINUED'
            ? now
            : existing?.completedAt ?? undefined,
      performedSteps: dto.performedSteps ?? existing?.performedSteps ?? [],
      updatedAt: now,
      source: existing?.source ?? 'mpps',
      patientName: existing?.patientName,
      patientId: existing?.patientId,
      modality: existing?.modality,
    }
    if (!existing) {
      // 内存无记录 → 从 Exam 派生回退 (studyUid 即 exam.id 或 1.2.840.10008.<examId>)
      const derived = await this.deriveMppsFromExam(dto.studyUid)
      if (derived) {
        base.patientName = derived.patientName
        base.patientId = derived.patientId
        base.modality = derived.modality
        base.source = 'exam'
      }
    }
    this.mppsRecords.set(dto.studyUid, base)
    // [v3.0.6.11-96 Wave 2B (B)] 落库 (mpps_records 表未迁移/DB 不可用时回退内存)
    try {
      const model = (this.prisma as any).mppsRecord
      if (model?.upsert) {
        const row = await model.upsert({
          where: { studyUid: dto.studyUid },
          create: {
            tenantId: currentTenantId(),
            studyUid: base.studyUid,
            status: base.status,
            patientName: base.patientName ?? null,
            patientId: base.patientId ?? null,
            modality: base.modality ?? null,
            startedAt: base.startedAt ? new Date(base.startedAt) : null,
            completedAt: base.completedAt ? new Date(base.completedAt) : null,
            steps: base.performedSteps,
            source: base.source,
          },
          update: {
            status: base.status,
            patientName: base.patientName ?? null,
            patientId: base.patientId ?? null,
            modality: base.modality ?? null,
            completedAt: base.completedAt ? new Date(base.completedAt) : null,
            steps: base.performedSteps,
            source: base.source,
          },
        })
        this.logger.log(`MPPS ${dto.status} for study=${dto.studyUid} persisted (${base.source})`)
        return this.toMppsRecord(row)
      }
    } catch (err) {
      this.logger.warn(`[DicomDimse] MPPS persist failed, fallback memory: ${(err as Error)?.message}`)
    }
    this.logger.log(`MPPS ${dto.status} for study=${dto.studyUid} (${base.source})`)
    return { ...base }
  }

  async listMpps(): Promise<MppsRecord[]> {
    // [v3.0.6.11-96 Wave 2B (B)] 优先读 DB; 表未迁移/DB 不可用或空库时回退内存 Map (seed 演示)
    try {
      const model = (this.prisma as any).mppsRecord
      if (model?.findMany) {
        const rows = await model.findMany({
          orderBy: { updatedAt: 'desc' },
          take: 200,
        })
        if (rows.length > 0) return rows.map((r: any) => this.toMppsRecord(r))
      }
    } catch (err) {
      this.logger.warn(`[DicomDimse] MPPS list from DB failed, fallback memory: ${(err as Error)?.message}`)
    }
    return [...this.mppsRecords.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  // ═══════════ [G005 v3.0.6.11-90 Wave 4A (PACS P0-1)] DICOM C-STORE 传输队列 ═══════════

  listTransfers(): TransferRecord[] {
    return [...this.transfers.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  // [G005 v3.0.6.11-96 Wave 2B (D)] 从 studyUid 反查检查 (studyUid 即 exam.id 或 1.2.840.10008.<examId>)
  private async deriveExamFromStudyUid(studyUid: string): Promise<{ examId: string; accessionNumber: string } | null> {
    const candidates = [studyUid, studyUid.replace(/^1\.2\.840\.10008\./, '')]
    for (const id of candidates) {
      try {
        const exam = await this.prisma.exam.findUnique({ where: { id } })
        if (exam) {
          return { examId: exam.id, accessionNumber: exam.accessionNumber ?? '' }
        }
      } catch {
        // DB 不可用 → 跳过该候选
      }
    }
    return null
  }

  // [G005 v3.0.6.11-96 Wave 2B (D)] 入队时关联检查 (前端传入 examId/accessionNumber 或从 studyUid 反查)
  async enqueueTransfer(dto: { studyUid: string; targetAe: string; priority?: 'HIGH' | 'NORMAL' | 'LOW'; examId?: string; accessionNumber?: string }): Promise<TransferRecord> {
    if (this.transfers.size >= 200) {
      throw new BadRequestException('传输队列已满 (上限 200), 请先清理已完成任务')
    }
    const now = new Date().toISOString()
    const id = `TR-${String(++this.transferSeq).padStart(4, '0')}`
    const total = 8 + (this.transferSeq % 17)
    const linked = dto.examId
      ? { examId: dto.examId, accessionNumber: dto.accessionNumber ?? '' }
      : await this.deriveExamFromStudyUid(dto.studyUid)
    const record: TransferRecord = {
      id,
      studyUid: dto.studyUid,
      targetAe: dto.targetAe,
      status: 'queued',
      progress: 0,
      totalInstances: total,
      completedInstances: 0,
      priority: dto.priority ?? 'NORMAL',
      createdAt: now,
      updatedAt: now,
      source: 'queue',
      examId: linked?.examId,
      accessionNumber: linked?.accessionNumber,
    }
    this.transfers.set(id, record)
    this.logger.log(`Transfer enqueued: ${id} study=${dto.studyUid} -> ${dto.targetAe}${linked ? ` exam=${linked.examId}` : ''}`)
    return { ...record }
  }

  private findTransfer(id: string): TransferRecord {
    const record = this.transfers.get(id)
    if (!record) throw new NotFoundException(`Transfer ${id} not found`)
    return record
  }

  retryTransfer(id: string): TransferRecord {
    const record = this.findTransfer(id)
    if (record.status === 'sending') throw new BadRequestException(`传输 ${id} 正在进行中`)
    const updated: TransferRecord = {
      ...record,
      status: 'sending',
      progress: record.status === 'failed' ? 0 : record.progress,
      completedInstances: record.status === 'failed' ? 0 : record.completedInstances,
      error: undefined,
      updatedAt: new Date().toISOString(),
    }
    this.transfers.set(id, updated)
    this.logger.log(`Transfer retried: ${id}`)
    return { ...updated }
  }

  pauseTransfer(id: string): TransferRecord {
    const record = this.findTransfer(id)
    if (record.status !== 'sending' && record.status !== 'queued') {
      throw new BadRequestException(`仅 queued/sending 状态可暂停, 当前: ${record.status}`)
    }
    const updated: TransferRecord = { ...record, status: 'paused', updatedAt: new Date().toISOString() }
    this.transfers.set(id, updated)
    return { ...updated }
  }

  resumeTransfer(id: string): TransferRecord {
    const record = this.findTransfer(id)
    if (record.status !== 'paused') throw new BadRequestException(`仅 paused 状态可恢复, 当前: ${record.status}`)
    const updated: TransferRecord = { ...record, status: 'sending', updatedAt: new Date().toISOString() }
    this.transfers.set(id, updated)
    return { ...updated }
  }

  cancelTransfer(id: string): TransferRecord {
    const record = this.findTransfer(id)
    if (record.status === 'completed') throw new BadRequestException(`传输 ${id} 已完成, 不可取消`)
    const updated: TransferRecord = { ...record, status: 'canceled', updatedAt: new Date().toISOString() }
    this.transfers.set(id, updated)
    return { ...updated }
  }

  getTransferStats(): {
    total: number
    queued: number
    sending: number
    paused: number
    failed: number
    completed: number
    canceled: number
    activeCount: number
    successRate: number
    avgProgress: number
  } {
    const all = [...this.transfers.values()]
    const count = (s: TransferRecord['status']) => all.filter((t) => t.status === s).length
    const done = all.filter((t) => t.status === 'completed' || t.status === 'failed' || t.status === 'canceled')
    const successRate = done.length > 0 ? Math.round((count('completed') / done.length) * 100) : 0
    const inFlight = all.filter((t) => t.status !== 'completed' && t.status !== 'canceled')
    const avgProgress = inFlight.length > 0
      ? Math.round(inFlight.reduce((s, t) => s + t.progress, 0) / inFlight.length)
      : 0
    return {
      total: all.length,
      queued: count('queued'),
      sending: count('sending'),
      paused: count('paused'),
      failed: count('failed'),
      completed: count('completed'),
      canceled: count('canceled'),
      activeCount: count('queued') + count('sending') + count('paused'),
      successRate,
      avgProgress,
    }
  }

  private async deriveMppsFromExam(studyUid: string): Promise<{
    patientName?: string
    patientId?: string
    modality?: string
  } | null> {
    const candidates = [studyUid, studyUid.replace(/^1\.2\.840\.10008\./, '')]
    for (const id of candidates) {
      try {
        const exam = await this.prisma.exam.findUnique({
          where: { id },
          include: { patient: true },
        })
        if (exam) {
          return {
            patientName: exam.patient?.name ?? '',
            patientId: exam.patientId ?? '',
            modality: exam.modality ?? '',
          }
        }
      } catch {
        // DB 不可用 → 跳过该候选
      }
    }
    return null
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
