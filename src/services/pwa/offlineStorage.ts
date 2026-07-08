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
