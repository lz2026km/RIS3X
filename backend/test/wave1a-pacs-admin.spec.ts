/**
 * [G005 Wave1A] PACS Admin 模块 spec — seed 回退 + 内存态 + DB 派生
 */
import { PacsAdminService } from '../src/modules/pacs-admin/pacs-admin.service'

function failingPrisma(): any {
  return new Proxy(
    {},
    {
      get: () => () => {
        throw new Error('no db (verification stub)')
      },
    },
  )
}

describe('Wave1A PACS Admin', () => {
  it('nodes: DB 失败时回退确定性 seed (6 节点, 含 online/offline/error)', async () => {
    const svc = new PacsAdminService(failingPrisma())
    const nodes = await svc.listNodes()
    expect(nodes.length).toBe(6)
    const statuses = new Set(nodes.map((n) => n.status))
    expect(statuses.has('online')).toBe(true)
    expect(statuses.has('offline')).toBe(true)
    expect(nodes.every((n) => n.aeTitle && n.hostname && n.port > 0)).toBe(true)
  })

  it('nodes: DB 有设备时派生 DICOM 节点', async () => {
    const prisma: any = {
      device: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'D1', code: 'CT1', name: 'CT 设备', modality: 'CT', location: '1室', state: 'IDLE', todayExams: 12, updatedAt: new Date() },
          { id: 'D2', code: 'MR1', name: 'MR 设备', modality: 'MR', location: '2室', state: 'BROKEN', todayExams: 0, updatedAt: new Date() },
        ]),
      },
    }
    const svc = new PacsAdminService(prisma)
    const nodes = await svc.listNodes()
    expect(nodes).toHaveLength(2)
    expect(nodes[0]!.status).toBe('online')
    expect(nodes[0]!.studyCount).toBe(12)
    expect(nodes[1]!.status).toBe('error')
  })

  it('storage: seed 存储组 + Exam 真实 study 数', async () => {
    const prisma: any = {
      exam: {
        count: jest.fn().mockResolvedValue(1000),
        findMany: jest.fn().mockResolvedValue([{ id: 'E1' }]),
      },
    }
    const svc = new PacsAdminService(prisma)
    const storage = await svc.listStorage()
    expect(storage.length).toBe(3)
    expect(storage[0]!.studyCount).toBeGreaterThan(128400)
  })

  it('worklist-entries / archives / logs: 均回退 seed 且形状正确', async () => {
    const svc = new PacsAdminService(failingPrisma())
    const wl = await svc.listWorklistEntries()
    expect(wl.length).toBeGreaterThan(0)
    expect(wl.every((w) => w.accessionNumber && w.patientName)).toBe(true)
    const archives = await svc.listArchives()
    expect(archives.length).toBeGreaterThan(0)
    expect(archives.every((a) => a.studyId && a.patientName)).toBe(true)
    const logs = await svc.listLogs(20)
    expect(logs.length).toBeGreaterThan(0)
    expect(logs.every((l) => l.level && l.message)).toBe(true)
  })

  it('configs: 内存覆盖 seed; routes: 节点派生 + seed; test/sync/cleanup 确定性', async () => {
    const svc = new PacsAdminService(failingPrisma())
    const before = svc.listConfigs()
    const updated = svc.updateConfig('port', '11112', '测试更新')
    expect(updated.value).toBe('11112')
    const after = svc.listConfigs()
    expect(after.length).toBe(before.length)
    expect(after.find((c) => c.key === 'port')!.value).toBe('11112')

    const routes = await svc.listRoutes()
    expect(routes.length).toBeGreaterThanOrEqual(SEED_ROUTE_COUNT)
    expect(routes.some((r) => r.protocol === 'DICOM')).toBe(true)

    const test = await svc.testNode('NODE-01')
    expect(test.success).toBe(true)
    expect(test.latencyMs).toBeGreaterThan(0)

    const cleanup = svc.cleanupStorage()
    expect(cleanup.ok).toBe(true)
    expect(cleanup.freedBytes).toBeGreaterThan(0)

    const sync = await svc.syncNode('NODE-01')
    expect(sync.ok).toBe(true)
    expect(sync.syncedStudies).toBeGreaterThan(0)
  })
})

const SEED_ROUTE_COUNT = 3
