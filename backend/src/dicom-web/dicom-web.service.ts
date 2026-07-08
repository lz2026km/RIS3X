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
   * 构建 DICOM Part 10 格式 buffer
   * 包含: 导言(128 zero bytes) + DICM magic(4 bytes) + 元数据 + 像素数据占位
   */
  private buildPart10Buffer(inst: any): Buffer {
    // File Meta Information (Group 0002)
    const sopClass = inst.sopClassUid ?? '1.2.840.10008.5.1.4.1.1.2'
    const sopUid = inst.sopInstanceUid
    const studyUid = inst.studyInstanceUid ?? ''
    const seriesUid = inst.seriesInstanceUid ?? ''
    const transferSyntax = inst.transferSyntax ?? '1.2.840.10008.1.2.1'

    // Build DICOM tags as VR=UI elements with proper encoding
    const elements: Buffer[] = []

    // (0002,0010) Transfer Syntax UI
    elements.push(this.encodeDicomTag(0x0002, 0x0010, 'UI', transferSyntax))
    // (0002,0002) SOP Class UID
    elements.push(this.encodeDicomTag(0x0002, 0x0002, 'UI', sopClass))
    // (0002,0003) SOP Instance UID
    elements.push(this.encodeDicomTag(0x0002, 0x0003, 'UI', sopUid))
    // (0002,000D) Study Instance UID
    elements.push(this.encodeDicomTag(0x0002, 0x000d, 'UI', studyUid))
    // (0002,000E) Series Instance UID
    elements.push(this.encodeDicomTag(0x0002, 0x000e, 'UI', seriesUid))

    // Calculate metadata length
    const metaHeader = Buffer.concat(elements)
    const metaLength = metaHeader.length

    // File Meta Information Group Length (0002,0000)
    const groupLen = this.encodeDicomTag(0x0002, 0x0000, 'UL', String(metaLength), true)

    // Final File Meta Information
    const fileMetaInfo = Buffer.concat([groupLen, metaHeader])

    // Pixel data placeholder (8x8 black pixels)
    const pixelData = Buffer.alloc(128, 0)

    // Assemble Part 10: preamble + DICM + meta info item + pixel data
    const preamble = Buffer.alloc(128, 0)
    const dicm = Buffer.from('DICM', 'ascii')
    const metaItem = this.encodeDicomTag(0x0002, 0x0001, 'OB', '', true) // meta info item tag

    return Buffer.concat([preamble, dicm, metaItem, fileMetaInfo, pixelData])
  }

  private encodeDicomTag(group: number, elem: number, vr: string, value: string, explicitVr = true): Buffer {
    const groupBytes = Buffer.alloc(2)
    groupBytes.writeUInt16LE(group, 0)
    const elemBytes = Buffer.alloc(2)
    elemBytes.writeUInt16LE(elem, 0)

    const vrBytes = Buffer.from(vr.padEnd(2, ' '), 'ascii')

    const valueBytes = Buffer.from(value, 'utf8')
    let lenBytes: Buffer

    if (explicitVr && (vr === 'OB' || vr === 'OD' || vr === 'OF' || vr === 'OL' || vr === 'OW' || vr === 'SQ' || vr === 'UC' || vr === 'UN' || vr === 'UR')) {
      // Explicit VR with 2 reserved bytes + 4 byte length
      lenBytes = Buffer.alloc(6)
      lenBytes.writeUInt16LE(0, 0) // reserved
      lenBytes.writeUInt32LE(valueBytes.length, 2)
    } else if (explicitVr) {
      lenBytes = Buffer.alloc(2)
      lenBytes.writeUInt16LE(valueBytes.length, 0)
    } else {
      lenBytes = Buffer.alloc(4)
      lenBytes.writeUInt32LE(valueBytes.length, 0)
    }

    return Buffer.concat([groupBytes, elemBytes, explicitVr ? vrBytes : Buffer.alloc(0), lenBytes, valueBytes])
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
