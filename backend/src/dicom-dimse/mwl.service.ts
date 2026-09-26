import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { currentTenantId } from '../common/tenant/tenant-utils'
import type { MwlQueryDto } from './dto'

export type WorklistItemState = 'SCHEDULED' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'DISCONTINUED'

export interface WorklistItemEntry {
  id: string
  accessionNumber: string
  patientName: string
  patientId: string
  modality: string
  bodyPart: string
  studyInstanceUid: string
  seriesInstanceUid: string
  requestedProcedureId: string
  requestedProcedureDescription: string
  scheduledStationAeTitle: string
  scheduledDate: string
  scheduledTime: string
  contrast: boolean
  contrastAgent?: string
  priority: string
  state: WorklistItemState
  mppsStatus?: WorklistItemState
  examId?: string
  deviceId?: string
  source: 'db' | 'seed'
}

export interface MwlQueryResult {
  queryRetrieveLevel: 'WORKLIST'
  sopClassUid: string
  matches: number
  source: 'db' | 'seed' | 'mixed'
  items: WorklistItemEntry[]
  dataset: Array<Record<string, unknown>>
}

interface StateOverride {
  status: WorklistItemState
  updatedAt: string
}

const MWL_FIND_SOP_CLASS_UID = '1.2.840.10008.5.1.4.31'

@Injectable()
export class MwlService {
  private readonly logger = new Logger(MwlService.name)
  private readonly stateOverrides = new Map<string, StateOverride>()

  constructor(private readonly prisma: PrismaService) {}

  private dateKey(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  private dayAt(offset: number, hour: number, minute: number): Date {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + offset)
    d.setHours(hour, minute, 0, 0)
    return d
  }

  private buildSeeds(): WorklistItemEntry[] {
    const rows: Array<{
      accession: string
      patientName: string
      patientId: string
      modality: string
      bodyPart: string
      station: string
      offset: number
      hour: number
      minute: number
      contrast: boolean
      contrastAgent?: string
      priority: string
      state: WorklistItemState
      procedure: string
    }> = [
      { accession: 'AC-EXEC-001', patientName: '张明远', patientId: 'P000001', modality: 'CT', bodyPart: 'CHEST', station: 'CT_SCANNER_01', offset: 0, hour: 9, minute: 0, contrast: true, contrastAgent: 'Iohexol 350', priority: 'ROUTINE', state: 'SCHEDULED', procedure: '胸部 CT 增强' },
      { accession: 'AC-EXEC-002', patientName: '李静', patientId: 'P000002', modality: 'MR', bodyPart: 'BRAIN', station: 'MR_SCANNER_02', offset: 0, hour: 10, minute: 15, contrast: false, priority: 'ROUTINE', state: 'ARRIVED', procedure: '颅脑 MR 平扫' },
      { accession: 'AC-EXEC-003', patientName: '王建国', patientId: 'P000003', modality: 'CT', bodyPart: 'ABDOMEN', station: 'CT_SCANNER_01', offset: 0, hour: 11, minute: 0, contrast: true, contrastAgent: 'Iodixanol 320', priority: 'URGENT', state: 'IN_PROGRESS', procedure: '腹部 CT 三期增强' },
      { accession: 'AC-EXEC-004', patientName: '赵敏', patientId: 'P000004', modality: 'DR', bodyPart: 'CHEST', station: 'DR_ROOM_01', offset: 0, hour: 13, minute: 30, contrast: false, priority: 'ROUTINE', state: 'SCHEDULED', procedure: '胸部正侧位 DR' },
      { accession: 'AC-EXEC-005', patientName: '陈晓东', patientId: 'P000005', modality: 'US', bodyPart: 'ABDOMEN', station: 'US_UNIT_01', offset: 0, hour: 14, minute: 0, contrast: false, priority: 'ROUTINE', state: 'SCHEDULED', procedure: '腹部超声' },
      { accession: 'AC-EXEC-006', patientName: '刘芳', patientId: 'P000006', modality: 'MG', bodyPart: 'BREAST', station: 'MG_UNIT_01', offset: 0, hour: 15, minute: 0, contrast: false, priority: 'ROUTINE', state: 'SCHEDULED', procedure: '乳腺钼靶双体位' },
      { accession: 'AC-EXEC-007', patientName: '孙伟', patientId: 'P000007', modality: 'CT', bodyPart: 'HEAD', station: 'CT_SCANNER_01', offset: 1, hour: 8, minute: 30, contrast: false, priority: 'STAT', state: 'SCHEDULED', procedure: '颅脑 CT 平扫' },
      { accession: 'AC-EXEC-008', patientName: '周婷', patientId: 'P000008', modality: 'MR', bodyPart: 'SPINE', station: 'MR_SCANNER_02', offset: 1, hour: 9, minute: 45, contrast: true, contrastAgent: 'Gadobutrol', priority: 'ROUTINE', state: 'SCHEDULED', procedure: '腰椎 MR 增强' },
    ]
    return rows.map((r, index) => {
      const dt = this.dayAt(r.offset, r.hour, r.minute)
      return {
        id: `MWL-${String(index + 1).padStart(4, '0')}`,
        accessionNumber: r.accession,
        patientName: r.patientName,
        patientId: r.patientId,
        modality: r.modality,
        bodyPart: r.bodyPart,
        studyInstanceUid: `1.2.840.114350.1.1.${this.dateKey(dt).replace(/-/g, '')}.${String(index + 1).padStart(3, '0')}`,
        seriesInstanceUid: `1.2.840.114350.1.1.${this.dateKey(dt).replace(/-/g, '')}.${String(index + 1).padStart(3, '0')}.1`,
        requestedProcedureId: `RP-${r.accession}`,
        requestedProcedureDescription: r.procedure,
        scheduledStationAeTitle: r.station,
        scheduledDate: this.dateKey(dt),
        scheduledTime: `${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')}:00`,
        contrast: r.contrast,
        contrastAgent: r.contrastAgent,
        priority: r.priority,
        state: r.state,
        source: 'seed' as const,
      }
    })
  }

  private applyOverride(item: WorklistItemEntry): WorklistItemEntry {
    const override =
      this.stateOverrides.get(item.accessionNumber) ??
      (item.examId ? this.stateOverrides.get(item.examId) : undefined)
    if (!override) return item
    return { ...item, state: override.status, mppsStatus: override.status }
  }

  applyMppsStatus(link: { studyUid: string; accessionNumber?: string; requestedProcedureId?: string; examId?: string; status: 'IN_PROGRESS' | 'COMPLETED' | 'DISCONTINUED' }): void {
    const mapped: WorklistItemState =
      link.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : link.status === 'COMPLETED' ? 'COMPLETED' : 'DISCONTINUED'
    const updatedAt = new Date().toISOString()
    const keys = [link.accessionNumber, link.examId, link.studyUid, link.requestedProcedureId].filter(
      (k): k is string => typeof k === 'string' && k.length > 0,
    )
    const studyNumeric = link.studyUid.replace(/^1\.2\.840\.10008\./, '')
    if (studyNumeric !== link.studyUid) keys.push(studyNumeric)
    for (const key of keys) this.stateOverrides.set(key, { status: mapped, updatedAt })
  }

  private matchesSeed(item: WorklistItemEntry, query: MwlQueryDto): boolean {
    if (query.modality && item.modality !== query.modality) return false
    if (query.patientName && !item.patientName.includes(query.patientName)) return false
    if (query.patientId && item.patientId !== query.patientId) return false
    if (query.accessionNumber && item.accessionNumber !== query.accessionNumber) return false
    if (query.stationAE && item.scheduledStationAeTitle !== query.stationAE) return false
    if (query.date && item.scheduledDate !== query.date) return false
    if (query.dateFrom && item.scheduledDate < query.dateFrom) return false
    if (query.dateTo && item.scheduledDate > query.dateTo) return false
    if (!query.includeCompleted && item.state === 'DISCONTINUED') return false
    return true
  }

  private async queryDatabase(query: MwlQueryDto): Promise<WorklistItemEntry[]> {
    const where: Record<string, unknown> = { tenantId: currentTenantId() }
    if (query.modality) where.modality = query.modality
    if (query.accessionNumber) where.accessionNumber = { contains: query.accessionNumber }
    if (query.patientId) where.patientId = query.patientId
    if (query.patientName) where.patient = { name: { contains: query.patientName } }
    if (query.stationAE || query.date || query.dateFrom || query.dateTo) {
      where.device = query.stationAE ? { aeTitle: query.stationAE } : undefined
      const range: Record<string, Date> = {}
      if (query.date) {
        range.gte = new Date(`${query.date}T00:00:00`)
        range.lte = new Date(`${query.date}T23:59:59`)
      }
      if (query.dateFrom) range.gte = new Date(`${query.dateFrom}T00:00:00`)
      if (query.dateTo) range.lte = new Date(`${query.dateTo}T23:59:59`)
      where.scheduledAt = range
    }
    const rows = await this.prisma.exam.findMany({
      where: where as never,
      include: { patient: true, device: true },
      orderBy: { scheduledAt: 'asc' },
      take: 200,
    })
    return rows.map((exam: any, index: number) => {
      const dt: Date | null = exam.scheduledAt ?? null
      const stateMap: Record<string, WorklistItemState> = {
        SCHEDULED: 'SCHEDULED',
        ARRIVED: 'ARRIVED',
        IN_PROGRESS: 'IN_PROGRESS',
        PAUSED: 'IN_PROGRESS',
        COMPLETED: 'COMPLETED',
        CANCELLED: 'DISCONTINUED',
      }
      return {
        id: `MWL-DB-${exam.id}`,
        accessionNumber: exam.accessionNumber ?? `EXAM-${index + 1}`,
        patientName: exam.patient?.name ?? '',
        patientId: exam.patientId,
        modality: exam.modality,
        bodyPart: exam.bodyPart,
        studyInstanceUid: `1.2.840.10008.${exam.id}`,
        seriesInstanceUid: `1.2.840.10008.${exam.id}.1`,
        requestedProcedureId: `RP-${exam.accessionNumber ?? exam.id}`,
        requestedProcedureDescription: exam.bodyPart,
        scheduledStationAeTitle: exam.device?.aeTitle ?? '',
        scheduledDate: dt ? this.dateKey(dt) : '',
        scheduledTime: dt ? `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}:00` : '',
        contrast: /增强|contrast/i.test(String(exam.bodyPart ?? '')),
        priority: exam.priority ?? 'ROUTINE',
        state: stateMap[exam.state] ?? 'SCHEDULED',
        examId: exam.id,
        deviceId: exam.deviceId ?? undefined,
        source: 'db' as const,
      }
    })
  }

  async listWorklistItems(query: MwlQueryDto = {}): Promise<{ items: WorklistItemEntry[]; total: number; source: 'db' | 'seed' | 'mixed' }> {
    try {
      const dbItems = await this.queryDatabase(query)
      if (dbItems.length > 0) {
        const items = dbItems.map((i) => this.applyOverride(i))
        return { items, total: items.length, source: 'db' }
      }
    } catch (err) {
      this.logger.warn(`[MwlService] DB query failed, seed fallback: ${(err as Error)?.message}`)
    }
    const seedItems = this.buildSeeds().filter((i) => this.matchesSeed(i, query)).map((i) => this.applyOverride(i))
    return { items: seedItems, total: seedItems.length, source: 'seed' }
  }

  private toDatasetItem(item: WorklistItemEntry): Record<string, unknown> {
    return {
      patientName: item.patientName,
      patientId: item.patientId,
      accessionNumber: item.accessionNumber,
      modality: item.modality,
      bodyPartExamined: item.bodyPart,
      priority: item.priority,
      contrast: item.contrast,
      studyInstanceUid: item.studyInstanceUid,
      seriesInstanceUid: item.seriesInstanceUid,
      scheduledProcedureStepSequence: [
        {
          scheduledProcedureStepId: item.id,
          scheduledStationAeTitle: item.scheduledStationAeTitle,
          scheduledProcedureStepStartDate: item.scheduledDate.replace(/-/g, ''),
          scheduledProcedureStepStartTime: item.scheduledTime.replace(/:/g, ''),
          modality: item.modality,
          scheduledProcedureStepDescription: item.requestedProcedureDescription,
          requestedProcedureId: item.requestedProcedureId,
          requestedProcedureDescription: item.requestedProcedureDescription,
        },
      ],
    }
  }

  async query(query: MwlQueryDto = {}): Promise<MwlQueryResult> {
    const { items, source } = await this.listWorklistItems(query)
    return {
      queryRetrieveLevel: 'WORKLIST',
      sopClassUid: MWL_FIND_SOP_CLASS_UID,
      matches: items.length,
      source,
      items,
      dataset: items.map((i) => this.toDatasetItem(i)),
    }
  }

  getWorklistState(accessionNumber: string): WorklistItemState | undefined {
    return this.stateOverrides.get(accessionNumber)?.status
  }
}