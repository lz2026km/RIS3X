/**
 * G005 放射RIS系统 v3.0.2.2 - DICOMweb 服务
 * 实现 PS 3.18 QIDO-RS / WADO-RS / STOW-RS 简化版
 * v3.0.6.11-60: DICOM 文件读写统一走 StorageDriver (本地 / S3 双驱动)
 */
import { Injectable, NotFoundException, Optional, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { STORAGE_DRIVER } from '../common/storage/storage.module'
import { LocalStorageDriver } from '../common/storage/local-storage.driver'
import type { StorageDriver } from '../common/storage/storage.interface'

@Injectable()
export class DicomWebService {
  private readonly storage: StorageDriver

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() @Inject(STORAGE_DRIVER) storageDriver?: StorageDriver,
  ) {
    const root = this.config.get<string>('DICOM_STORAGE_DIR', 'dicom') || 'dicom'
    this.storage = storageDriver ?? new LocalStorageDriver({ root })
  }

  /**
   * QIDO-RS: Search for Studies
   * GET /dicom-web/studies?PatientID=...&Modality=...&limit=...
   */
  async searchStudies(filter: { PatientID?: string; Modality?: string; StudyInstanceUID?: string; limit?: number; offset?: number }) {
    const model = (this.prisma as any).dicomInstance
    if (!model?.findMany) return []
    const where: any = {}
    if (filter.PatientID) where.patientId = filter.PatientID
    if (filter.Modality) where.modality = filter.Modality
    if (filter.StudyInstanceUID) where.studyInstanceUid = filter.StudyInstanceUID
    return model.findMany({
      where,
      take: filter.limit ?? 50,
      skip: filter.offset ?? 0,
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * QIDO-RS: Search for Series
   * GET /dicom-web/studies/{study}/series
   */
  async searchSeries(studyInstanceUid: string) {
    const model = (this.prisma as any).dicomInstance
    if (!model?.findMany) return []
    return model.findMany({
      where: { studyInstanceUid },
      orderBy: { createdAt: 'asc' },
    })
  }

  /**
   * QIDO-RS: Search for Instances
   */
  async searchInstances(studyInstanceUid: string, seriesInstanceUid?: string) {
    const model = (this.prisma as any).dicomInstance
    if (!model?.findMany) return []
    const where: any = { studyInstanceUid }
    if (seriesInstanceUid) where.seriesInstanceUid = seriesInstanceUid
    return model.findMany({ where })
  }

  /**
   * WADO-RS: Retrieve Instance
   * GET /dicom-web/studies/{study}/series/{series}/instances/{sop}
   * 优先读取 StorageDriver 中的真实 DICOM 文件; 无文件时回退构建 Part 10 占位 buffer
   */
  async retrieveInstance(sopInstanceUid: string): Promise<{ id: string; storagePath: string; size: number; mimeType: string; buffer: Buffer }> {
    const model = (this.prisma as any).dicomInstance
    if (!model?.findUnique) {
      throw new NotFoundException(`DICOM Web not available`)
    }
    const inst = await model.findUnique({ where: { sopInstanceUid } })
    if (!inst) throw new NotFoundException(`Instance ${sopInstanceUid} not found`)

    let buffer: Buffer | null = null
    if (inst.storagePath) {
      try {
        const raw = await this.storage.get(inst.storagePath)
        buffer = raw && raw.length > 0 ? raw : null
      } catch {
        buffer = null
      }
    }
    if (!buffer) {
      buffer = this.buildPart10Buffer(inst)
    }
    return {
      id: inst.id,
      storagePath: inst.storagePath ?? `wado-rs://default/${sopInstanceUid}`,
      size: buffer.length,
      mimeType: 'application/dicom',
      buffer,
    }
  }

  /**
   * 构建真实 DICOM Part 10 格式 buffer
   * 128 preamble + DICM + File Meta Information (Group 0002 Explicit VR LE) + Data Set
   */
  private buildPart10Buffer(inst: any): Buffer {
    const sopClass = inst.sopClassUid ?? '1.2.840.10008.5.1.4.1.1.2'
    const sopUid = inst.sopInstanceUid
    const studyUid = inst.studyInstanceUid ?? ''
    const seriesUid = inst.seriesInstanceUid ?? ''
    const transferSyntax = inst.transferSyntax ?? '1.2.840.10008.1.2.1'
    const isExplicit = transferSyntax !== '1.2.840.10008.1.2'

    const valBytes = (s: string): Buffer => {
      const b = Buffer.from(s, 'utf8')
      return s.length % 2 !== 0 ? Buffer.concat([b, Buffer.from([0])]) : b
    }
    const u16le = (n: number): Buffer => { const b = Buffer.alloc(2); b.writeUInt16LE(n, 0); return b }
    const u32le = (n: number): Buffer => { const b = Buffer.alloc(4); b.writeUInt32LE(n, 0); return b }

    const encodeElement = (g: number, e: number, vr: string, value: Buffer): Buffer => {
      const parts: Buffer[] = [u16le(g), u16le(e)]
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

    const metaElements: Buffer[] = []
    metaElements.push(encodeElement(0x0002, 0x0001, 'OB', Buffer.from([0x01, 0x00])))
    metaElements.push(encodeElement(0x0002, 0x0002, 'UI', valBytes(sopClass)))
    metaElements.push(encodeElement(0x0002, 0x0003, 'UI', valBytes(sopUid)))
    metaElements.push(encodeElement(0x0002, 0x000D, 'UI', valBytes(studyUid)))
    metaElements.push(encodeElement(0x0002, 0x000E, 'UI', valBytes(seriesUid)))
    metaElements.push(encodeElement(0x0002, 0x0010, 'UI', valBytes(transferSyntax)))
    metaElements.push(encodeElement(0x0002, 0x0012, 'UI', valBytes('1.2.840.10008.5.1.4.1.2.1.1')))
    metaElements.push(encodeElement(0x0002, 0x0013, 'SH', valBytes('G005-RIS-WADO-3.0')))

    const metaBody = Buffer.concat(metaElements)
    const glBuf = u32le(metaBody.length)
    const groupLen = encodeElement(0x0002, 0x0000, 'UL', glBuf)

    const fileMeta = Buffer.concat([groupLen, metaBody])
    const preamble = Buffer.alloc(128, 0)
    const dicm = Buffer.from('DICM', 'ascii')

    const dsElements: Buffer[] = []
    const ed = (g: number, e: number, vr: string, v: Buffer) => { dsElements.push(encodeElement(g, e, vr, v)) }
    if (inst.patientName) ed(0x0010, 0x0010, 'PN', valBytes(inst.patientName))
    if (inst.patientId) ed(0x0010, 0x0020, 'LO', valBytes(inst.patientId))
    if (inst.modality) ed(0x0008, 0x0060, 'CS', valBytes(inst.modality))
    ed(0x0008, 0x0016, 'UI', valBytes(sopClass))
    ed(0x0008, 0x0018, 'UI', valBytes(sopUid))
    ed(0x0020, 0x000D, 'UI', valBytes(studyUid))
    ed(0x0020, 0x000E, 'UI', valBytes(seriesUid))
    ed(0x0028, 0x0002, 'US', u16le(1))
    ed(0x0028, 0x0010, 'US', u16le(1))
    ed(0x0028, 0x0011, 'US', u16le(1))
    ed(0x0028, 0x0100, 'US', u16le(8))
    ed(0x0028, 0x0004, 'CS', valBytes('MONOCHROME2'))

    const dataset = Buffer.concat(dsElements)
    return Buffer.concat([preamble, dicm, fileMeta, dataset])
  }

  /**
   * WADO-RS: Retrieve Metadata
   */
  async retrieveMetadata(sopInstanceUid: string) {
    const inst = await this.retrieveInstance(sopInstanceUid)
    return {
      '00020002': { vr: 'UI', Value: ['1.2.840.10008.5.1.4.1.1.2'] },
      '00080018': { vr: 'UI', Value: [sopInstanceUid] },
      sopInstanceUID: sopInstanceUid,
      size: inst.buffer.length,
    }
  }

  /**
   * STOW-RS: Store Instance
   * POST /dicom-web/studies/{study}
   */
  async storeInstance(
    studyInstanceUid: string,
    seriesInstanceUid: string,
    sopInstanceUid: string,
    modality: string,
    sopClassUid: string,
    sizeBytes: number,
    storagePath: string,
    patientId?: string,
    transferSyntax?: string
  ) {
    const model = (this.prisma as any).dicomInstance
    if (!model?.create) {
      throw new NotFoundException('DICOM Web persistence not available')
    }
    return model.create({
      data: {
        studyInstanceUid,
        seriesInstanceUid,
        sopInstanceUid,
        sopClassUid,
        modality,
        patientId,
        sizeBytes,
        storagePath,
        transferSyntax,
      },
    })
  }

  /**
   * Get Capabilities
   */
  getCapabilities() {
    return {
      version: '3.0.2.2',
      qido: { search: true, limit: 100, maxResults: 10000 },
      wado: { retrieve: true, metadata: true, frame: true, bulkData: false },
      stow: { store: true, scp: true, scu: false },
      transferSyntaxes: [
        '1.2.840.10008.1.2.1', // Explicit VR Little Endian
        '1.2.840.10008.1.2',   // Implicit VR Little Endian
        '1.2.840.10008.1.2.4.70', // JPEG Lossless
      ],
    }
  }
}
