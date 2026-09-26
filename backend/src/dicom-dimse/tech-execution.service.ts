import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { currentTenantId } from '../common/tenant/tenant-utils'
import type {
  DoseWritebackDto,
  ExamProtocolSetDto,
  ExposureParamsDto,
  ProtocolDto,
  ScanRangeDto,
  SeriesQcDto,
  SeriesRegisterDto,
} from './dto'

export interface ProtocolRecord {
  id: string
  code: string
  name: string
  modality: string
  bodyPart: string
  description?: string
  contrast: boolean
  seriesCount: number
  expectedImages: number
  exposureParams: ExposureParamsDto
  scanRange?: ScanRangeDto
  contrastProtocolId?: string
  source: 'db' | 'seed' | 'memory'
  createdAt: string
  updatedAt: string
}

export interface SeriesRecord {
  id: string
  examId: string
  seriesNumber: number
  seriesInstanceUid: string
  description: string
  modality: string
  imageCount: number
  acquiredAt: string
  exposureParams?: ExposureParamsDto
  source: 'db' | 'memory'
}

export interface SeriesQcRecord {
  id: string
  examId: string
  seriesNumber: number
  quality: 'PASS' | 'REJECT'
  reason?: string
  score?: number
  scoredBy?: string
  scoredAt: string
  retakeCount: number
  source: 'db' | 'memory'
}

export interface ExamProtocolState {
  examId: string
  protocolId?: string
  protocolName?: string
  seriesCount?: number
  expectedImages?: number
  exposureParams?: ExposureParamsDto
  scanRange?: ScanRangeDto
  contrastProtocolId?: string
  updatedAt?: string
  source: 'db' | 'memory'
}

export interface ProtocolValidation {
  expectedImages: number
  capturedImages: number
  capturedSeries: number
  expectedSeries: number
  matches: boolean
  imageCountMismatch: boolean
  delta: number
  message: string
}

export interface ExamDoseRecord {
  id: string
  examId: string
  studyUid: string
  modality: string
  bodyPart: string
  ctdiVol: number
  dlp: number
  ssde?: number
  source: 'RDSR' | 'MANUAL'
  recordedAt: string
  updatedAt: string
}

export interface ExamExecutionSummary {
  examId: string
  accessionNumber?: string
  protocol: ProtocolRecord | null
  state: ExamProtocolState
  series: SeriesRecord[]
  validation: ProtocolValidation
  seriesQc: SeriesQcRecord[]
  qcSummary: { total: number; passed: number; rejected: number }
  dose: ExamDoseRecord | null
  retakeCount: number
  mppsStatus?: string
}

@Injectable()
export class TechExecutionService {
  private readonly logger = new Logger(TechExecutionService.name)
  private readonly protocols = new Map<string, ProtocolRecord>()
  private readonly examProtocolStates = new Map<string, ExamProtocolState>()
  private readonly examSeries = new Map<string, SeriesRecord[]>()
  private readonly examSeriesQc = new Map<string, SeriesQcRecord[]>()
  private readonly examDoses = new Map<string, ExamDoseRecord>()
  private readonly retakeOverrides = new Map<string, number>()
  private protocolSeq = 0
  private seriesSeq = 0
  private qcSeq = 0

  constructor(private readonly prisma: PrismaService) {
    for (const seed of this.buildProtocolSeeds()) {
      this.protocols.set(seed.id, seed)
    }
    this.protocolSeq = this.protocols.size
  }

  private nowIso(): string {
    return new Date().toISOString()
  }

  private buildProtocolSeeds(): ProtocolRecord[] {
    const now = this.nowIso()
    const rows: Array<Omit<ProtocolRecord, 'id' | 'source' | 'createdAt' | 'updatedAt'>> = [
      { code: 'CT_CHEST_ENH', name: '胸部 CT 增强', modality: 'CT', bodyPart: 'CHEST', description: '胸部增强三期扫描', contrast: true, seriesCount: 2, expectedImages: 180, exposureParams: { kVp: 120, mAs: 210, aec: true, rotationTime: 0.5, pitch: 1.2, thickness: 1.25 }, scanRange: { from: 1, to: 60, length: 300, orientation: 'axial' }, contrastProtocolId: 'CP-IOHEXOL-350' },
      { code: 'CT_ABDOMEN_3PHASE', name: '腹部 CT 三期增强', modality: 'CT', bodyPart: 'ABDOMEN', description: '平扫+动脉+门脉期', contrast: true, seriesCount: 3, expectedImages: 260, exposureParams: { kVp: 120, mAs: 240, aec: true, rotationTime: 0.5, pitch: 1.0, thickness: 1.25 }, scanRange: { from: 40, to: 110, length: 350, orientation: 'axial' }, contrastProtocolId: 'CP-IODIXANOL-320' },
      { code: 'CT_HEAD_PLAIN', name: '颅脑 CT 平扫', modality: 'CT', bodyPart: 'HEAD', description: '颅脑平扫', contrast: false, seriesCount: 1, expectedImages: 40, exposureParams: { kVp: 120, mAs: 180, aec: true, rotationTime: 0.5, pitch: 1.0, thickness: 5 }, scanRange: { from: 5, to: 35, length: 160, orientation: 'axial' } },
      { code: 'MR_BRAIN_PLAIN', name: '颅脑 MR 平扫', modality: 'MR', bodyPart: 'BRAIN', description: 'T1/T2/DWI/FLAIR', contrast: false, seriesCount: 4, expectedImages: 96, exposureParams: { thickness: 5, reconstruction: 'T2-FLAIR' }, scanRange: { orientation: 'axial' } },
      { code: 'MR_SPINE_ENH', name: '腰椎 MR 增强', modality: 'MR', bodyPart: 'SPINE', description: '腰椎增强', contrast: true, seriesCount: 3, expectedImages: 72, exposureParams: { thickness: 4, reconstruction: 'T1-SPACE' }, scanRange: { orientation: 'sagittal' }, contrastProtocolId: 'CP-GADOBUTROL' },
      { code: 'DR_CHEST_PA_LAT', name: '胸部正侧位 DR', modality: 'DR', bodyPart: 'CHEST', description: '正侧位', contrast: false, seriesCount: 2, expectedImages: 2, exposureParams: { kVp: 125, mAs: 3.2, aec: true }, scanRange: { orientation: 'PA/LAT' } },
      { code: 'MG_BILATERAL', name: '乳腺钼靶双体位', modality: 'MG', bodyPart: 'BREAST', description: 'CC+MLO 双体位', contrast: false, seriesCount: 4, expectedImages: 4, exposureParams: { kVp: 30, mAs: 45, aec: true }, scanRange: { orientation: 'CC/MLO' } },
    ]
    return rows.map((r, index) => ({
      ...r,
      id: `PRT-${String(index + 1).padStart(4, '0')}`,
      source: 'seed',
      createdAt: now,
      updatedAt: now,
    }))
  }

  listProtocols(filter: { modality?: string; bodyPart?: string } = {}): { items: ProtocolRecord[]; total: number } {
    let items = [...this.protocols.values()]
    if (filter.modality) items = items.filter((p) => p.modality === filter.modality)
    if (filter.bodyPart) items = items.filter((p) => p.bodyPart === filter.bodyPart)
    items.sort((a, b) => a.modality.localeCompare(b.modality) || a.name.localeCompare(b.name))
    return { items, total: items.length }
  }

  createProtocol(dto: ProtocolDto): ProtocolRecord {
    const id = `PRT-${String(++this.protocolSeq).padStart(4, '0')}`
    const now = this.nowIso()
    const record: ProtocolRecord = {
      id,
      code: dto.code,
      name: dto.name,
      modality: dto.modality,
      bodyPart: dto.bodyPart,
      description: dto.description,
      contrast: dto.contrast ?? false,
      seriesCount: dto.seriesCount ?? 1,
      expectedImages: dto.expectedImages ?? 1,
      exposureParams: dto.exposureParams ?? {},
      scanRange: dto.scanRange,
      contrastProtocolId: dto.contrastProtocolId,
      source: 'memory',
      createdAt: now,
      updatedAt: now,
    }
    this.protocols.set(id, record)
    return record
  }

  getProtocol(id: string): ProtocolRecord {
    const protocol = this.protocols.get(id)
    if (!protocol) throw new NotFoundException(`Protocol ${id} not found`)
    return protocol
  }

  private async loadExam(examId: string): Promise<{ dbAvailable: boolean; exam: any | null }> {
    try {
      const exam = await this.prisma.exam.findUnique({
        where: { id: examId },
        include: { patient: true, device: true },
      })
      return { dbAvailable: true, exam }
    } catch (err) {
      this.logger.warn(`[TechExecution] exam lookup failed (DB-less fallback): ${(err as Error)?.message}`)
      return { dbAvailable: false, exam: null }
    }
  }

  private async assertExam(examId: string): Promise<any | null> {
    const { dbAvailable, exam } = await this.loadExam(examId)
    if (dbAvailable && !exam) throw new NotFoundException(`Exam ${examId} not found`)
    return exam
  }

  async setExamProtocol(examId: string, dto: ExamProtocolSetDto): Promise<ExamProtocolState> {
    await this.assertExam(examId)
    const previous = this.examProtocolStates.get(examId)
    const protocol = dto.protocolId ? this.getProtocol(dto.protocolId) : undefined
    const state: ExamProtocolState = {
      examId,
      protocolId: dto.protocolId ?? previous?.protocolId,
      protocolName: protocol?.name ?? previous?.protocolName,
      seriesCount: dto.seriesCount ?? protocol?.seriesCount ?? previous?.seriesCount,
      expectedImages: dto.expectedImages ?? protocol?.expectedImages ?? previous?.expectedImages,
      exposureParams: dto.exposureParams ?? protocol?.exposureParams ?? previous?.exposureParams,
      scanRange: dto.scanRange ?? protocol?.scanRange ?? previous?.scanRange,
      contrastProtocolId: dto.contrastProtocolId ?? protocol?.contrastProtocolId ?? previous?.contrastProtocolId,
      updatedAt: this.nowIso(),
      source: 'memory',
    }
    this.examProtocolStates.set(examId, state)
    return state
  }

  listSeries(examId: string): SeriesRecord[] {
    return [...(this.examSeries.get(examId) ?? [])].sort((a, b) => a.seriesNumber - b.seriesNumber)
  }

  async registerSeries(examId: string, dto: SeriesRegisterDto): Promise<SeriesRecord> {
    await this.assertExam(examId)
    const existing = this.examSeries.get(examId) ?? []
    const record: SeriesRecord = {
      id: `SER-${String(++this.seriesSeq).padStart(5, '0')}`,
      examId,
      seriesNumber: dto.seriesNumber,
      seriesInstanceUid: dto.seriesInstanceUid ?? `1.2.840.10008.${examId}.series.${dto.seriesNumber}`,
      description: dto.description ?? `Series ${dto.seriesNumber}`,
      modality: dto.modality ?? 'OT',
      imageCount: dto.imageCount,
      acquiredAt: dto.acquiredAt ?? this.nowIso(),
      exposureParams: dto.exposureParams,
      source: 'memory',
    }
    const next = existing.filter((s) => s.seriesNumber !== dto.seriesNumber).concat(record)
    this.examSeries.set(examId, next)
    return record
  }

  private buildValidation(examId: string): ProtocolValidation {
    const state = this.examProtocolStates.get(examId)
    const series = this.listSeries(examId)
    const expectedImages = state?.expectedImages ?? 0
    const expectedSeries = state?.seriesCount ?? 0
    const capturedImages = series.reduce((sum, s) => sum + (s.imageCount ?? 0), 0)
    const capturedSeries = series.length
    const imageCountMismatch = expectedImages > 0 && capturedImages !== expectedImages
    const matches = expectedImages > 0 && capturedImages === expectedImages
    let message = '协议期望值与已采集序列一致'
    if (expectedImages === 0 && capturedImages === 0) message = '未配置协议/未采集序列'
    else if (imageCountMismatch) message = `图像数不一致: 期望 ${expectedImages}, 实际 ${capturedImages} (差异 ${capturedImages - expectedImages})`
    return {
      expectedImages,
      capturedImages,
      capturedSeries,
      expectedSeries,
      matches,
      imageCountMismatch,
      delta: capturedImages - expectedImages,
      message,
    }
  }

  listSeriesQc(examId: string): SeriesQcRecord[] {
    return [...(this.examSeriesQc.get(examId) ?? [])].sort((a, b) => b.scoredAt.localeCompare(a.scoredAt))
  }

  async submitSeriesQc(examId: string, dto: SeriesQcDto): Promise<{ records: SeriesQcRecord[]; retakeTriggered: boolean; retakeCount: number; validation: ProtocolValidation }> {
    const exam = await this.assertExam(examId)
    const scoredAt = this.nowIso()
    const existing = this.listSeriesQc(examId)
    const rejected = dto.items.filter((i) => i.quality === 'REJECT').length
    let retakeCount = this.retakeOverrides.get(examId) ?? Number(exam?.retakeCount ?? 0)
    if (rejected > 0) {
      retakeCount += 1
      this.retakeOverrides.set(examId, retakeCount)
      if (exam) {
        try {
          await this.prisma.exam.update({
            where: { id: examId },
            data: {
              retakeCount,
              qualityRating: 'REJECT',
              qcNotes: [String(exam.qcNotes ?? ''), `序列级质控退回 (${rejected} 个序列) ${scoredAt}`]
                .filter(Boolean)
                .join('\n'),
            } as never,
          })
        } catch (err) {
          this.logger.warn(`[TechExecution] exam retake persist fallback memory: ${(err as Error)?.message}`)
        }
      }
    }
    const created: SeriesQcRecord[] = dto.items.map((item) => ({
      id: `SQC-${String(++this.qcSeq).padStart(5, '0')}`,
      examId,
      seriesNumber: item.seriesNumber,
      quality: item.quality,
      reason: item.reason,
      score: item.score,
      scoredBy: dto.scoredBy,
      scoredAt,
      retakeCount,
      source: 'memory',
    }))
    this.examSeriesQc.set(examId, created.concat(existing).slice(0, 500))
    return { records: created, retakeTriggered: rejected > 0, retakeCount, validation: this.buildValidation(examId) }
  }

  private toDoseRecord(examId: string, dto: DoseWritebackDto, exam: any | null): ExamDoseRecord {
    const ctdiVol = dto.ctdivol ?? dto.ctdiVol ?? dto.rdsr?.ctdivol ?? 0
    const dlp = dto.dlp ?? dto.rdsr?.dlp ?? 0
    const now = this.nowIso()
    return {
      id: `DOSE-${examId}`,
      examId,
      studyUid: dto.studyUid ?? dto.rdsr?.studyUid ?? `1.2.840.10008.${examId}`,
      modality: dto.modality ?? exam?.modality ?? 'CT',
      bodyPart: dto.bodyPart ?? dto.rdsr?.bodyPart ?? exam?.bodyPart ?? 'UNKNOWN',
      ctdiVol,
      dlp,
      ssde: dto.ssde ?? dto.rdsr?.ssde,
      source: dto.source ?? (dto.rdsr ? 'RDSR' : 'MANUAL'),
      recordedAt: now,
      updatedAt: now,
    }
  }

  async writeDose(examId: string, dto: DoseWritebackDto): Promise<ExamDoseRecord> {
    const exam = await this.assertExam(examId)
    const record = this.toDoseRecord(examId, dto, exam)
    this.examDoses.set(examId, record)
    try {
      const model = (this.prisma as any).doseRecord
      if (model?.findFirst) {
        const existing = await model.findFirst({ where: { examId } })
        if (existing) {
          await model.update({ where: { id: existing.id }, data: {
            ctdiVol: record.ctdiVol,
            dlp: record.dlp,
            ssde: record.ssde ?? null,
            studyUid: record.studyUid,
            bodyPart: record.bodyPart,
            modality: record.modality,
            date: new Date(record.recordedAt),
          } })
          return { ...record, id: existing.id }
        }
        const created = await model.create({ data: {
          tenantId: currentTenantId(),
          examId,
          patientId: exam?.patientId ?? null,
          patientName: exam?.patient?.name ?? null,
          studyUid: record.studyUid,
          modality: record.modality,
          bodyPart: record.bodyPart,
          ctdiVol: record.ctdiVol,
          dlp: record.dlp,
          ssde: record.ssde ?? null,
          date: new Date(record.recordedAt),
        } })
        return { ...record, id: created.id }
      }
    } catch (err) {
      this.logger.warn(`[TechExecution] dose persist fallback memory: ${(err as Error)?.message}`)
    }
    return record
  }

  async getDose(examId: string): Promise<ExamDoseRecord | null> {
    try {
      const model = (this.prisma as any).doseRecord
      if (model?.findFirst) {
        const row = await model.findFirst({ where: { examId }, orderBy: { date: 'desc' } })
        if (row) {
          return {
            id: row.id,
            examId,
            studyUid: row.studyUid,
            modality: row.modality,
            bodyPart: row.bodyPart,
            ctdiVol: row.ctdiVol,
            dlp: row.dlp,
            ssde: row.ssde ?? undefined,
            source: 'RDSR',
            recordedAt: new Date(row.date).toISOString(),
            updatedAt: new Date(row.updatedAt ?? row.date).toISOString(),
          }
        }
      }
    } catch (err) {
      this.logger.warn(`[TechExecution] dose read fallback memory: ${(err as Error)?.message}`)
    }
    return this.examDoses.get(examId) ?? null
  }

  async getExamProtocol(examId: string): Promise<ExamExecutionSummary> {
    const exam = await this.assertExam(examId)
    const state = this.examProtocolStates.get(examId) ?? { examId, source: 'memory' as const }
    const series = this.listSeries(examId)
    const seriesQc = this.listSeriesQc(examId)
    const validation = this.buildValidation(examId)
    const rejected = seriesQc.filter((q) => q.quality === 'REJECT').length
    const dose = await this.getDose(examId)
    return {
      examId,
      accessionNumber: exam?.accessionNumber,
      protocol: state.protocolId ? this.protocols.get(state.protocolId) ?? null : null,
      state,
      series,
      validation,
      seriesQc,
      qcSummary: { total: seriesQc.length, passed: seriesQc.length - rejected, rejected },
      dose,
      retakeCount: this.retakeOverrides.get(examId) ?? Number(exam?.retakeCount ?? 0),
    }
  }

  async syncSeriesCount(examId: string): Promise<{ seriesCount: number; expectedImages: number; validation: ProtocolValidation }> {
    await this.assertExam(examId)
    const series = this.listSeries(examId)
    const state = this.examProtocolStates.get(examId)
    if (state) {
      this.examProtocolStates.set(examId, { ...state, seriesCount: series.length, updatedAt: this.nowIso() })
    }
    return {
      seriesCount: series.length,
      expectedImages: state?.expectedImages ?? 0,
      validation: this.buildValidation(examId),
    }
  }

  validateExpectedImages(expectedImages: number, capturedImages: number): ProtocolValidation {
    if (expectedImages <= 0) throw new BadRequestException('expectedImages 必须大于 0')
    const mismatch = expectedImages !== capturedImages
    return {
      expectedImages,
      capturedImages,
      capturedSeries: 0,
      expectedSeries: 0,
      matches: !mismatch,
      imageCountMismatch: mismatch,
      delta: capturedImages - expectedImages,
      message: mismatch ? `图像数不一致: 期望 ${expectedImages}, 实际 ${capturedImages}` : '图像数一致',
    }
  }
}