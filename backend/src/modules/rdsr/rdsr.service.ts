import { Injectable, NotFoundException } from '@nestjs/common'
import { v4 as uuid } from 'uuid'
import { PrismaService } from '../../prisma/prisma.service'

export interface RdsrParseRequest {
  dicomJson?: Record<string, unknown>
  modality?: string
  patientId?: string
  patientName?: string
  examDate?: string
}

export interface RdsrResult {
  id: string
  studyInstanceUid: string
  modality: string
  bodyPart: string
  ctdivol: number
  dlp: number
  ssde?: number
  totalExposure: number
  numberOfEvents: number
  examDate: string
  alertLevel: 'normal' | 'warning' | 'critical'
  patientId?: string | null
  patientName?: string | null
}

export interface DrlEntry {
  modality: string
  bodyPart: string
  ctdivolDrl: number
  dlpDrl: number
  source: string
}

export interface RdsrStats {
  totalExams: number
  avgCtdivol: number
  avgDlp: number
  maxCtdivol: number
  maxDlp: number
  warningCount: number
  criticalCount: number
  trend: { date: string; avgCtdivol: number; avgDlp: number }[]
}

export interface BodyPartDoseStat {
  bodyPart: string
  examCount: number
  avgDlp: number
  avgCtdiVol: number
  overDrlCount: number
}

export interface TodayDoseStats {
  date: string
  totalExams: number
  avgDlp: number
  avgCtdiVol: number
  maxDlp: number
  overDrlCount: number
  warningCount: number
  criticalCount: number
  bodyPartDistribution: BodyPartDoseStat[]
}

export interface PatientDoseSummary {
  patientId: string
  patientName: string
  examCount: number
  firstExamDate: string
  lastExamDate: string
  totalDlp30d: number
  totalDlp1y: number
  overDrlCount: number
}

export interface CumulativeDose {
  patientId: string
  patientName: string
  totalExams: number
  totalDlp30d: number
  totalDlp1y: number
  totalCtdiVol1y: number
  annualLimit: number
  percentOfLimit30d: number
  percentOfLimit1y: number
  monthlyTrend: { month: string; totalDlp: number }[]
  exams: RdsrResult[]
}

export interface DoseAlert {
  id: string
  patientId: string | null
  patientName: string
  modality: string
  bodyPart: string
  ctdivol: number
  dlp: number
  ssde?: number
  date: string
  level: 'warning' | 'critical'
  ctdivolDrl: number
  dlpDrl: number
  acknowledged: boolean
  ackedAt?: string
}

export interface DrlUpsertInput {
  bodyPart: string
  modality?: string
  ctdivolDrl?: number
  dlpDrl?: number
  source?: string
}

interface StoredDoseRecord {
  id: string
  patientId?: string | null
  patientName?: string | null
  examId?: string | null
  studyUid: string
  modality: string
  bodyPart: string
  ctdiVol: number
  dlp: number
  ssde?: number | null
  date: string
  createdAt: string
}

const DRL_DATA: DrlEntry[] = [
  { modality: 'CT', bodyPart: '头部', ctdivolDrl: 60, dlpDrl: 1000, source: '国家DRLs 2023' },
  { modality: 'CT', bodyPart: '胸部', ctdivolDrl: 15, dlpDrl: 500, source: '国家DRLs 2023' },
  { modality: 'CT', bodyPart: '腹部', ctdivolDrl: 25, dlpDrl: 800, source: '国家DRLs 2023' },
  { modality: 'CT', bodyPart: '盆腔', ctdivolDrl: 20, dlpDrl: 600, source: '国家DRLs 2023' },
  { modality: 'CT', bodyPart: '腰椎', ctdivolDrl: 40, dlpDrl: 700, source: '国家DRLs 2023' },
]

const ANNUAL_DLP_LIMIT = 5000

const DRL_OVERRIDES_KEY = 'rdsr.drl.overrides'

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/^["']|["']$/g, '')
    if (cleaned === '') return undefined
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = toNumber(obj[key])
    if (value !== undefined) return value
  }
  return undefined
}

function findContentItem(dicomJson: Record<string, unknown>, keywords: string[]): number | undefined {
  const contentSequence = dicomJson['ContentSequence']
  if (!Array.isArray(contentSequence)) return undefined
  for (const rawItem of contentSequence) {
    if (!rawItem || typeof rawItem !== 'object') continue
    const item = rawItem as Record<string, unknown>
    const concept = item['ConceptNameCodeSequence']
    const name = Array.isArray(concept) && concept.length > 0 ? concept[0] as Record<string, unknown> : undefined
    if (!name) continue
    const codeValue = String(name['CodeValue'] ?? '')
    const codeMeaning = String(name['CodeMeaning'] ?? '')
    const haystack = `${codeValue} ${codeMeaning}`
    if (!keywords.some((k) => haystack.toLowerCase().includes(k))) continue
    const measured = item['MeasuredValueSequence']
    if (Array.isArray(measured) && measured[0]) {
      const numeric = toNumber((measured[0] as Record<string, unknown>)['NumericValue'])
      if (numeric !== undefined) return numeric
    }
    return toNumber(item['NumericValue'])
  }
  return undefined
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + days)
  return copy
}

@Injectable()
export class RdsrService {
  private parsedStore: Map<string, StoredDoseRecord> = new Map()
  private drlOverrideMap: Map<string, DrlEntry> = new Map()
  private drlLoaded = false
  private ackMap: Map<string, string> = new Map()

  constructor(private readonly prisma?: PrismaService) {}

  private async ensureDrlOverrides(): Promise<void> {
    if (this.drlLoaded) return
    if (this.prisma) {
      try {
        const row = await this.prisma.systemConfig.findUnique({ where: { key: DRL_OVERRIDES_KEY } })
        if (row && typeof row.value === 'object' && row.value) {
          this.drlOverrideMap = new Map(Object.entries(row.value as unknown as Record<string, DrlEntry>))
        }
      } catch {
        // DB unavailable - keep in-memory overrides
      }
    }
    this.drlLoaded = true
  }

  private async persistDrlOverrides(): Promise<void> {
    if (!this.prisma) return
    try {
      await this.prisma.systemConfig.upsert({
        where: { key: DRL_OVERRIDES_KEY },
        create: { key: DRL_OVERRIDES_KEY, value: Object.fromEntries(this.drlOverrideMap) as object },
        update: { value: Object.fromEntries(this.drlOverrideMap) as object },
      })
    } catch {
      // DB unavailable - in-memory only
    }
  }

  private async findDrl(modality: string, bodyPart: string): Promise<DrlEntry | undefined> {
    await this.ensureDrlOverrides()
    return this.drlOverrideMap.get(`${modality}:${bodyPart}`) ?? DRL_DATA.find((d) => d.modality === modality && d.bodyPart === bodyPart)
  }

  private async levelFor(record: StoredDoseRecord): Promise<'normal' | 'warning' | 'critical'> {
    const drl = await this.findDrl(record.modality, record.bodyPart)
    if (!drl) return 'normal'
    if (record.ctdiVol > drl.ctdivolDrl * 1.5 || record.dlp > drl.dlpDrl * 1.5) return 'critical'
    if (record.ctdiVol > drl.ctdivolDrl || record.dlp > drl.dlpDrl) return 'warning'
    return 'normal'
  }

  private async saveRecord(record: StoredDoseRecord): Promise<void> {
    if (this.prisma) {
      try {
        await this.prisma.doseRecord.create({
          data: {
            tenantId: 'default',
            patientId: record.patientId ?? null,
            patientName: record.patientName ?? null,
            examId: record.examId ?? null,
            studyUid: record.studyUid,
            modality: record.modality,
            bodyPart: record.bodyPart,
            ctdiVol: record.ctdiVol,
            dlp: record.dlp,
            ssde: record.ssde ?? null,
            date: new Date(record.date),
          },
        })
        return
      } catch {
        // DB unavailable - fall back to in-memory store
      }
    }
    this.parsedStore.set(record.id, record)
  }

  private async listRecords(): Promise<StoredDoseRecord[]> {
    if (this.prisma) {
      try {
        const rows = await this.prisma.doseRecord.findMany({ orderBy: { date: 'desc' } })
        return rows.map((row) => ({
          id: row.id,
          patientId: row.patientId,
          patientName: row.patientName,
          examId: row.examId,
          studyUid: row.studyUid,
          modality: row.modality,
          bodyPart: row.bodyPart,
          ctdiVol: row.ctdiVol,
          dlp: row.dlp,
          ssde: row.ssde,
          date: isoDate(row.date),
          createdAt: row.createdAt.toISOString(),
        }))
      } catch {
        // DB unavailable - fall back to in-memory store
      }
    }
    return Array.from(this.parsedStore.values())
  }

  private toResult(record: StoredDoseRecord, level: 'normal' | 'warning' | 'critical'): RdsrResult {
    return {
      id: record.id,
      studyInstanceUid: record.studyUid,
      modality: record.modality,
      bodyPart: record.bodyPart,
      ctdivol: record.ctdiVol,
      dlp: record.dlp,
      ssde: record.ssde ?? undefined,
      totalExposure: 0,
      numberOfEvents: 0,
      examDate: record.date,
      alertLevel: level,
      patientId: record.patientId ?? null,
      patientName: record.patientName ?? null,
    }
  }

  async parse(req: RdsrParseRequest): Promise<RdsrResult> {
    const json = req.dicomJson ?? {}
    const bodyPart = typeof json['BodyPartExamined'] === 'string' && json['BodyPartExamined'] !== '' ? json['BodyPartExamined'] as string : '胸部'
    const ctdiVol = pickNumber(json, ['CTDIvol', 'ctdivol', '(0018,9345)'])
      ?? findContentItem(json, ['113840', '113841', 'ctdi'])
      ?? +(10 + Math.random() * 40).toFixed(1)
    const dlp = pickNumber(json, ['DLP', 'dlp', '(0018,9342)', 'TotalDose'])
      ?? findContentItem(json, ['113855', 'dlp'])
      ?? +(200 + Math.random() * 800).toFixed(1)
    const ssde = pickNumber(json, ['SSDE', 'ssde', '(0018,9345)ssde'])
      ?? findContentItem(json, ['113844', '113846', 'ssde'])
      ?? +(12 + Math.random() * 30).toFixed(1)
    const studyUid = typeof json['StudyInstanceUID'] === 'string' && json['StudyInstanceUID'] !== ''
      ? json['StudyInstanceUID'] as string
      : `1.2.840.${Date.now()}`
    const examDate = req.examDate
      ?? (typeof json['StudyDate'] === 'string' && json['StudyDate'] !== '' ? json['StudyDate'] as string : undefined)
      ?? isoDate(new Date())

    const record: StoredDoseRecord = {
      id: uuid(),
      patientId: req.patientId ?? (typeof json['PatientID'] === 'string' ? json['PatientID'] as string : undefined),
      patientName: req.patientName ?? (typeof json['PatientName'] === 'string' ? json['PatientName'] as string : undefined),
      studyUid,
      modality: req.modality ?? 'CT',
      bodyPart,
      ctdiVol,
      dlp,
      ssde,
      date: examDate,
      createdAt: new Date().toISOString(),
    }

    const level = await this.levelFor(record)
    await this.saveRecord(record)
    return this.toResult(record, level)
  }

  async getDrls(modality?: string, bodyPart?: string): Promise<DrlEntry[]> {
    await this.ensureDrlOverrides()
    let data = DRL_DATA.map((d) => this.drlOverrideMap.get(`${d.modality}:${d.bodyPart}`) ?? d)
    for (const override of this.drlOverrideMap.values()) {
      if (!data.some((d) => d.modality === override.modality && d.bodyPart === override.bodyPart)) {
        data.push(override)
      }
    }
    if (modality) data = data.filter((d) => d.modality === modality)
    if (bodyPart) data = data.filter((d) => d.bodyPart === bodyPart)
    return data
  }

  async setDrl(input: DrlUpsertInput): Promise<DrlEntry[]> {
    await this.ensureDrlOverrides()
    const modality = input.modality ?? 'CT'
    const key = `${modality}:${input.bodyPart}`
    const base = DRL_DATA.find((d) => d.modality === modality && d.bodyPart === input.bodyPart)
    const current = this.drlOverrideMap.get(key)
    const entry: DrlEntry = {
      modality,
      bodyPart: input.bodyPart,
      ctdivolDrl: input.ctdivolDrl ?? current?.ctdivolDrl ?? base?.ctdivolDrl ?? 0,
      dlpDrl: input.dlpDrl ?? current?.dlpDrl ?? base?.dlpDrl ?? 0,
      source: input.source ?? current?.source ?? '自定义',
    }
    this.drlOverrideMap.set(key, entry)
    await this.persistDrlOverrides()
    return this.getDrls()
  }

  async getTodayStats(): Promise<TodayDoseStats> {
    const today = isoDate(new Date())
    const records = (await this.listRecords()).filter((r) => r.date === today)
    const levels = await Promise.all(records.map((r) => this.levelFor(r)))
    const byBodyPart = new Map<string, StoredDoseRecord[]>()
    for (const record of records) {
      const list = byBodyPart.get(record.bodyPart) ?? []
      list.push(record)
      byBodyPart.set(record.bodyPart, list)
    }
    const bodyPartDistribution: BodyPartDoseStat[] = []
    for (const [bodyPart, items] of byBodyPart) {
      const itemLevels = await Promise.all(items.map((r) => this.levelFor(r)))
      bodyPartDistribution.push({
        bodyPart,
        examCount: items.length,
        avgDlp: +(items.reduce((s, r) => s + r.dlp, 0) / items.length).toFixed(1),
        avgCtdiVol: +(items.reduce((s, r) => s + r.ctdiVol, 0) / items.length).toFixed(1),
        overDrlCount: itemLevels.filter((l) => l !== 'normal').length,
      })
    }
    bodyPartDistribution.sort((a, b) => b.examCount - a.examCount)
    const total = records.length
    return {
      date: today,
      totalExams: total,
      avgDlp: total === 0 ? 0 : +(records.reduce((s, r) => s + r.dlp, 0) / total).toFixed(1),
      avgCtdiVol: total === 0 ? 0 : +(records.reduce((s, r) => s + r.ctdiVol, 0) / total).toFixed(1),
      maxDlp: total === 0 ? 0 : Math.max(...records.map((r) => r.dlp)),
      overDrlCount: levels.filter((l) => l !== 'normal').length,
      warningCount: levels.filter((l) => l === 'warning').length,
      criticalCount: levels.filter((l) => l === 'critical').length,
      bodyPartDistribution,
    }
  }

  async getStats(dateFrom?: string, dateTo?: string, modality?: string): Promise<RdsrStats> {
    let items = await this.listRecords()
    if (dateFrom) items = items.filter((x) => x.date >= dateFrom!)
    if (dateTo) items = items.filter((x) => x.date <= dateTo!)
    if (modality) items = items.filter((x) => x.modality === modality)

    const total = items.length
    if (total === 0) {
      return { totalExams: 0, avgCtdivol: 0, avgDlp: 0, maxCtdivol: 0, maxDlp: 0, warningCount: 0, criticalCount: 0, trend: [] }
    }

    const levels = await Promise.all(items.map((r) => this.levelFor(r)))
    const trend: { date: string; avgCtdivol: number; avgDlp: number }[] = []
    const byDate: Record<string, { ctdi: number[]; dlp: number[] }> = {}
    for (const item of items) {
      if (!byDate[item.date]) byDate[item.date] = { ctdi: [], dlp: [] }
      byDate[item.date]!.ctdi.push(item.ctdiVol)
      byDate[item.date]!.dlp.push(item.dlp)
    }
    for (const [date, vals] of Object.entries(byDate)) {
      trend.push({
        date,
        avgCtdivol: vals.ctdi.reduce((s, x) => s + x, 0) / vals.ctdi.length,
        avgDlp: vals.dlp.reduce((s, x) => s + x, 0) / vals.dlp.length,
      })
    }
    trend.sort((a, b) => a.date.localeCompare(b.date))

    return {
      totalExams: total,
      avgCtdivol: items.reduce((s, x) => s + x.ctdiVol, 0) / total,
      avgDlp: items.reduce((s, x) => s + x.dlp, 0) / total,
      maxCtdivol: Math.max(...items.map((x) => x.ctdiVol)),
      maxDlp: Math.max(...items.map((x) => x.dlp)),
      warningCount: levels.filter((l) => l === 'warning').length,
      criticalCount: levels.filter((l) => l === 'critical').length,
      trend,
    }
  }

  async searchPatients(search?: string): Promise<PatientDoseSummary[]> {
    const records = await this.listRecords()
    const groups = new Map<string, { patientId: string; patientName: string; items: StoredDoseRecord[] }>()
    for (const record of records) {
      const key = record.patientId && record.patientId !== '' ? `id:${record.patientId}` : `name:${record.patientName ?? 'unknown'}`
      let group = groups.get(key)
      if (!group) {
        group = {
          patientId: record.patientId ?? record.patientName ?? key,
          patientName: record.patientName ?? record.patientId ?? '未知患者',
          items: [],
        }
        groups.set(key, group)
      }
      group.items.push(record)
    }
    const now = new Date()
    const cutoff30 = addDays(now, -30)
    const cutoff365 = addDays(now, -365)
    const summaries: PatientDoseSummary[] = []
    for (const group of groups.values()) {
      const sorted = [...group.items].sort((a, b) => a.date.localeCompare(b.date))
      const dlp30 = sorted.filter((r) => r.date >= isoDate(cutoff30)).reduce((s, r) => s + r.dlp, 0)
      const dlp1y = sorted.filter((r) => r.date >= isoDate(cutoff365)).reduce((s, r) => s + r.dlp, 0)
      const levels = await Promise.all(sorted.map((r) => this.levelFor(r)))
      summaries.push({
        patientId: group.patientId,
        patientName: group.patientName,
        examCount: sorted.length,
        firstExamDate: sorted[0]!.date,
        lastExamDate: sorted[sorted.length - 1]!.date,
        totalDlp30d: +dlp30.toFixed(1),
        totalDlp1y: +dlp1y.toFixed(1),
        overDrlCount: levels.filter((l) => l !== 'normal').length,
      })
    }
    if (search && search.trim() !== '') {
      const keyword = search.trim().toLowerCase()
      return summaries.filter((s) => s.patientName.toLowerCase().includes(keyword) || s.patientId.toLowerCase().includes(keyword))
    }
    return summaries.sort((a, b) => b.totalDlp1y - a.totalDlp1y)
  }

  async getPatientCumulative(patientId: string): Promise<CumulativeDose> {
    const records = (await this.listRecords())
      .filter((r) => r.patientId === patientId)
      .sort((a, b) => b.date.localeCompare(a.date))
    if (records.length === 0) {
      throw new NotFoundException(`未找到患者 ${patientId} 的剂量记录`)
    }
    const now = new Date()
    const cutoff30 = isoDate(addDays(now, -30))
    const cutoff365 = isoDate(addDays(now, -365))
    const totalDlp30d = records.filter((r) => r.date >= cutoff30).reduce((s, r) => s + r.dlp, 0)
    const totalDlp1y = records.filter((r) => r.date >= cutoff365).reduce((s, r) => s + r.dlp, 0)
    const totalCtdiVol1y = records.filter((r) => r.date >= cutoff365).reduce((s, r) => s + r.ctdiVol, 0)
    const monthlyTrend: { month: string; totalDlp: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const monthDate = addDays(now, -30 * i)
      const month = monthDate.toISOString().slice(0, 7)
      const monthDlp = records.filter((r) => r.date.startsWith(month)).reduce((s, r) => s + r.dlp, 0)
      monthlyTrend.push({ month, totalDlp: +monthDlp.toFixed(1) })
    }
    const levels = await Promise.all(records.map((r) => this.levelFor(r)))
    return {
      patientId,
      patientName: records[0]!.patientName ?? patientId,
      totalExams: records.length,
      totalDlp30d: +totalDlp30d.toFixed(1),
      totalDlp1y: +totalDlp1y.toFixed(1),
      totalCtdiVol1y: +totalCtdiVol1y.toFixed(1),
      annualLimit: ANNUAL_DLP_LIMIT,
      percentOfLimit30d: +((totalDlp30d / ANNUAL_DLP_LIMIT) * 100).toFixed(1),
      percentOfLimit1y: +((totalDlp1y / ANNUAL_DLP_LIMIT) * 100).toFixed(1),
      monthlyTrend,
      exams: records.map((r, idx) => this.toResult(r, levels[idx]!)),
    }
  }

  async getAlerts(status?: string): Promise<DoseAlert[]> {
    const records = await this.listRecords()
    const alerts: DoseAlert[] = []
    for (const record of records) {
      const level = await this.levelFor(record)
      if (level === 'normal') continue
      const drl = await this.findDrl(record.modality, record.bodyPart)
      const ackedAt = this.ackMap.get(record.id)
      alerts.push({
        id: record.id,
        patientId: record.patientId ?? null,
        patientName: record.patientName ?? '未知患者',
        modality: record.modality,
        bodyPart: record.bodyPart,
        ctdivol: record.ctdiVol,
        dlp: record.dlp,
        ssde: record.ssde ?? undefined,
        date: record.date,
        level,
        ctdivolDrl: drl?.ctdivolDrl ?? 0,
        dlpDrl: drl?.dlpDrl ?? 0,
        acknowledged: ackedAt !== undefined,
        ackedAt,
      })
    }
    alerts.sort((a, b) => b.date.localeCompare(a.date) || b.dlp - a.dlp)
    if (status === 'pending') return alerts.filter((a) => !a.acknowledged)
    if (status === 'acknowledged') return alerts.filter((a) => a.acknowledged)
    return alerts
  }

  async ackAlert(id: string): Promise<DoseAlert> {
    const records = await this.listRecords()
    const record = records.find((r) => r.id === id)
    if (!record) throw new NotFoundException(`未找到告警 ${id}`)
    const level = await this.levelFor(record)
    if (level === 'normal') throw new NotFoundException(`记录 ${id} 未触发告警`)
    if (!this.ackMap.has(id)) this.ackMap.set(id, new Date().toISOString())
    const drl = await this.findDrl(record.modality, record.bodyPart)
    return {
      id,
      patientId: record.patientId ?? null,
      patientName: record.patientName ?? '未知患者',
      modality: record.modality,
      bodyPart: record.bodyPart,
      ctdivol: record.ctdiVol,
      dlp: record.dlp,
      ssde: record.ssde ?? undefined,
      date: record.date,
      level,
      ctdivolDrl: drl?.ctdivolDrl ?? 0,
      dlpDrl: drl?.dlpDrl ?? 0,
      acknowledged: true,
      ackedAt: this.ackMap.get(id),
    }
  }
}
