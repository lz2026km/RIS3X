/**
 * [G005 Wave1B P1] PACS Admin 4 组扩展 spec — servers / storage-groups / associations / stats
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

describe('Wave1B PACS Admin extensions', () => {
  it('servers: DB 失败时由 seed 节点派生 (含 aeTitle/port)', async () => {
    const svc = new PacsAdminService(failingPrisma())
    const servers = await svc.listServers()
    expect(servers.length).toBeGreaterThan(0)
    expect(servers.every((s) => s.id && s.aeTitle && s.port > 0 && s.studyCount >= 0)).toBe(true)
  })

  it('servers: status 过滤 + CRUD (内存)', async () => {
    const svc = new PacsAdminService(failingPrisma())
    const online = await svc.listServers({ status: 'online' })
    expect(online.every((s) => s.status === 'online')).toBe(true)

    const created = svc.createServer({ name: '测试服务器', hostname: 'test.local', port: 104 })
    expect((await svc.listServers()).some((s) => s.id === created.id)).toBe(true)
    const updated = svc.updateServer(created.id, { port: 11112 })
    expect(updated.port).toBe(11112)
    expect(svc.getServer(created.id)).resolves.toBeDefined()
    const test = await svc.testServer(created.id)
    expect(test.success).toBe(true)
    svc.deleteServer(created.id)
    expect((await svc.listServers()).some((s) => s.id === created.id)).toBe(false)
  })

  it('storage-groups: 内存 + seed 合并; 创建/删除', async () => {
    const svc = new PacsAdminService(failingPrisma())
    const groups = await svc.listStorageGroups()
    expect(groups.length).toBeGreaterThan(0)
    const created = svc.createStorageGroup({ name: '新存储', path: '/mnt/x', totalBytes: 1024 ** 4 })
    expect((await svc.listStorageGroups()).some((g) => g.id === created.id)).toBe(true)
    svc.deleteStorageGroup(created.id)
    expect(() => svc.deleteStorageGroup('not-exist')).toThrow()
  })

  it('associations: 确定性 seed + status 过滤', () => {
    const svc = new PacsAdminService(failingPrisma())
    const all = svc.listAssociations()
    expect(all.length).toBeGreaterThan(0)
    expect(all.some((a) => a.status === 'connected')).toBe(true)
    const connected = svc.listAssociations({ status: 'connected' })
    expect(connected.every((a) => a.status === 'connected')).toBe(true)
  })

  it('stats: 服务器/存储/关联汇总', async () => {
    const svc = new PacsAdminService(failingPrisma())
    const stats = await svc.getStats()
    expect(stats.totalServers).toBeGreaterThan(0)
    expect(stats.onlineServers).toBeGreaterThan(0)
    expect(stats.totalStorageBytes).toBeGreaterThan(0)
    expect(stats.totalAssociations).toBeGreaterThan(0)
    expect(stats.activeAssociations).toBeGreaterThan(0)
    expect(stats.dailyTransferBytes).toBeGreaterThan(0)
  })
})
