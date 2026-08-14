import Dexie, { type EntityTable } from 'dexie'

export interface OfflineWorklistItem {
  id: string
  patientName: string
  patientId: string
  modality: string
  bodyPart?: string
  studyDate: string
  state: string
  priority: string
  synced: boolean
  updatedAt: number
}

export interface OfflineReport {
  id: string
  reportText: string
  findings: string
  conclusion: string
  patientId: string
  synced: boolean
  updatedAt: number
  // [v3.0.6.11-99 Wave7B] 离线报告包: 保存报告 HTML 快照 + 患者/检查信息 (列表与离线浏览用)
  htmlContent?: string
  patientName?: string
  modality?: string
  bodyPart?: string
  accessionNumber?: string
  reportNo?: string
  state?: string
  savedAt?: number
}

class OfflineDatabase extends Dexie {
  worklist!: EntityTable<OfflineWorklistItem, 'id'>
  reports!: EntityTable<OfflineReport, 'id'>

  constructor() {
    super('G005OfflineDB')
    this.version(1).stores({
      worklist: 'id, patientName, modality, state, synced, updatedAt',
      reports: 'id, patientId, synced, updatedAt',
    })
  }
}

const db = new OfflineDatabase()

export const offlineStorage = {
  async saveWorklist(items: OfflineWorklistItem[]): Promise<void> {
    const now = Date.now()
    await db.worklist.bulkPut(items.map((item) => ({ ...item, updatedAt: now })))
  },

  async getWorklist(): Promise<OfflineWorklistItem[]> {
    return db.worklist.orderBy('updatedAt').reverse().toArray()
  },

  async saveReport(report: OfflineReport): Promise<void> {
    await db.reports.put({ ...report, updatedAt: Date.now() })
  },

  // [v3.0.6.11-99 Wave7B] 离线报告包: 列表 (最新在前) / 删除 / 是否存在
  async listReports(): Promise<OfflineReport[]> {
    return db.reports.orderBy('updatedAt').reverse().toArray()
  },

  async removeReport(id: string): Promise<void> {
    await db.reports.delete(id)
  },

  async hasReport(id: string): Promise<boolean> {
    return (await db.reports.get(id)) !== undefined
  },

  async getReport(id: string): Promise<OfflineReport | undefined> {
    return db.reports.get(id)
  },

  async getUnsyncedReports(): Promise<OfflineReport[]> {
    return db.reports.filter((r) => !r.synced).toArray()
  },

  async markSynced(id: string): Promise<void> {
    await db.reports.update(id, { synced: true, updatedAt: Date.now() })
  },

  async clearAll(): Promise<void> {
    await db.worklist.clear()
    await db.reports.clear()
  },
}
