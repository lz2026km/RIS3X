import { Injectable } from '@nestjs/common'
import { v4 as uuid } from 'uuid'

export interface RdsrParseRequest {
  dicomJson?: Record<string, unknown>
  modality?: string
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

const DRL_DATA: DrlEntry[] = [
  { modality: 'CT', bodyPart: '头部', ctdivolDrl: 60, dlpDrl: 1000, source: '国家DRLs 2023' },
  { modality: 'CT', bodyPart: '胸部', ctdivolDrl: 15, dlpDrl: 500, source: '国家DRLs 2023' },
  { modality: 'CT', bodyPart: '腹部', ctdivolDrl: 25, dlpDrl: 800, source: '国家DRLs 2023' },
  { modality: 'CT', bodyPart: '盆腔', ctdivolDrl: 20, dlpDrl: 600, source: '国家DRLs 2023' },
  { modality: 'CT', bodyPart: '腰椎', ctdivolDrl: 40, dlpDrl: 700, source: '国家DRLs 2023' },
]

@Injectable()
export class RdsrService {
  private parsedStore: Map<string, RdsrResult> = new Map()

  async parse(req: RdsrParseRequest): Promise<RdsrResult> {
    const id = uuid()
    const result: RdsrResult = {
      id,
      studyInstanceUid: `1.2.840.${Date.now()}`,
      modality: req.modality ?? 'CT',
      bodyPart: req.dicomJson?.['BodyPartExamined'] as string ?? '胸部',
      ctdivol: +(10 + Math.random() * 40).toFixed(1),
      dlp: +(200 + Math.random() * 800).toFixed(1),
      ssde: +(12 + Math.random() * 30).toFixed(1),
      totalExposure: +(50 + Math.random() * 200).toFixed(0),
      numberOfEvents: Math.floor(1 + Math.random() * 5),
      examDate: new Date().toISOString().slice(0, 10),
      alertLevel: 'normal',
    }
    const drl = DRL_DATA.find(d => d.modality === result.modality && d.bodyPart === result.bodyPart)
    if (drl) {
      if (result.ctdivol > drl.ctdivolDrl * 1.5 || result.dlp > drl.dlpDrl * 1.5) result.alertLevel = 'critical'
      else if (result.ctdivol > drl.ctdivolDrl || result.dlp > drl.dlpDrl) result.alertLevel = 'warning'
    }
    this.parsedStore.set(id, result)
    return result
  }

  async getDrls(modality?: string, bodyPart?: string): Promise<DrlEntry[]> {
    let data = DRL_DATA
    if (modality) data = data.filter(d => d.modality === modality)
    if (bodyPart) data = data.filter(d => d.bodyPart === bodyPart)
    return data
  }

  async getStats(dateFrom?: string, dateTo?: string, modality?: string): Promise<RdsrStats> {
    let items = Array.from(this.parsedStore.values())
    if (dateFrom) items = items.filter(x => x.examDate >= dateFrom!)
    if (dateTo) items = items.filter(x => x.examDate <= dateTo!)
    if (modality) items = items.filter(x => x.modality === modality)

    const total = items.length
    if (total === 0) {
      return { totalExams: 0, avgCtdivol: 0, avgDlp: 0, maxCtdivol: 0, maxDlp: 0, warningCount: 0, criticalCount: 0, trend: [] }
    }

    const trend: { date: string; avgCtdivol: number; avgDlp: number }[] = []
    const byDate: Record<string, number[]> = {}
    const byDateDlp: Record<string, number[]> = {}
    for (const item of items) {
      if (!byDate[item.examDate]) { byDate[item.examDate] = []; byDateDlp[item.examDate] = [] }
      byDate[item.examDate].push(item.ctdivol)
      byDateDlp[item.examDate].push(item.dlp)
    }
    for (const [date, vals] of Object.entries(byDate)) {
      trend.push({ date, avgCtdivol: vals.reduce((s, x) => s + x, 0) / vals.length, avgDlp: byDateDlp[date].reduce((s, x) => s + x, 0) / byDateDlp[date].length })
    }
    trend.sort((a, b) => a.date.localeCompare(b.date))

    return {
      totalExams: total,
      avgCtdivol: items.reduce((s, x) => s + x.ctdivol, 0) / total,
      avgDlp: items.reduce((s, x) => s + x.dlp, 0) / total,
      maxCtdivol: Math.max(...items.map(x => x.ctdivol)),
      maxDlp: Math.max(...items.map(x => x.dlp)),
      warningCount: items.filter(x => x.alertLevel === 'warning').length,
      criticalCount: items.filter(x => x.alertLevel === 'critical').length,
      trend,
    }
  }
}
