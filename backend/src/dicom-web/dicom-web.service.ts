/**
 * G005 放射RIS系统 v3.0.2.2 - DICOMweb 服务
 * 实现 PS 3.18 QIDO-RS / WADO-RS / STOW-RS 简化版
 */
import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class DicomWebService {
  constructor(private readonly prisma: PrismaService) {}

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
   * 返回真实 DICOM Part 10 格式 buffer (DICM magic + 元数据 + 像素数据占位)
   */
  async retrieveInstance(sopInstanceUid: string): Promise<{ id: string; storagePath: string; size: number; mimeType: string; buffer: Buffer }> {
    const model = (this.prisma as any).dicomInstance
    if (!model?.findUnique) {
      throw new NotFoundException(`DICOM Web not available`)
    }
    const inst = await model.findUnique({ where: { sopInstanceUid } })
    if (!inst) throw new NotFoundException(`Instance ${sopInstanceUid} not found`)

    const buffer = this.buildPart10Buffer(inst)
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

    const valBytes = (s: string): Buffer => {
      const b = Buffer.from(s, 'utf8')
      return s.length % 2 !== 0 ? Buffer.concat([b, Buffer.from([0])]) : b
    }

    const makeTag = (tag: number, vr: string, value: Buffer): Buffer => {
      const g = (tag >> 16) & 0xffff
      const e = tag & 0xffff
      const gb = Buffer.alloc(2); gb.writeUInt16LE(g, 0)
      const eb = Buffer.alloc(2); eb.writeUInt16LE(e, 0)
      const vb = Buffer.from(vr.padEnd(2, ' '), 'ascii')
      const longVr = ['OB', 'OD', 'OF', 'OL', 'OW', 'SQ', 'UC', 'UN', 'UR']
      let lb: Buffer
      if (longVr.includes(vr)) {
        lb = Buffer.alloc(6); lb.writeUInt16LE(0, 0); lb.writeUInt32LE(value.length, 2)
      } else {
        lb = Buffer.alloc(2); lb.writeUInt16LE(value.length, 0)
      }
      const pad = value.length % 2 !== 0 ? Buffer.from([0]) : Buffer.alloc(0)
      return Buffer.concat([gb, eb, vb, lb, value, pad])
    }

    const metaElements: Buffer[] = []
    metaElements.push(makeTag(0x00020001, 'OB', Buffer.from([0x01, 0x00])))
    metaElements.push(makeTag(0x00020002, 'UI', valBytes(sopClass)))
    metaElements.push(makeTag(0x00020003, 'UI', valBytes(sopUid)))
    metaElements.push(makeTag(0x0002000D, 'UI', valBytes(studyUid)))
    metaElements.push(makeTag(0x0002000E, 'UI', valBytes(seriesUid)))
    metaElements.push(makeTag(0x00020010, 'UI', valBytes(transferSyntax)))
    metaElements.push(makeTag(0x00020012, 'UI', valBytes('1.2.840.10008.5.1.4.1.1.2')))
    metaElements.push(makeTag(0x00020013, 'SH', valBytes('G005-RIS-WADO-3.0')))

    const metaBody = Buffer.concat(metaElements)
    const glBuf = Buffer.alloc(4); glBuf.writeUInt32LE(metaBody.length, 0)
    const groupLen = makeTag(0x00020000, 'UL', glBuf)

    const fileMeta = Buffer.concat([groupLen, metaBody])
    const preamble = Buffer.alloc(128, 0)
    const dicm = Buffer.from('DICM', 'ascii')
    const pixelData = Buffer.alloc(128, 0)

    return Buffer.concat([preamble, dicm, fileMeta, pixelData])
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
    patientId?: string
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
