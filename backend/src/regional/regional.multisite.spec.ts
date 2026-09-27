import { RegionalService } from './regional.service'

/**
 * [G005 W11-MultiSite] 多院区真实模型 (内存持久化) + 联邦配置 + 跨院区聚合统计
 */
const makeService = () => new RegionalService({} as never)

describe('RegionalService [W11-MultiSite]', () => {
  it('listSites 返回信封且可重复调用一致 (内存缓存)', () => {
    const svc = makeService()
    const a = svc.listSites().data.data
    const b = svc.listSites().data.data
    expect(a.length).toBeGreaterThan(0)
    expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id))
  })

  it('createSite 内存持久化, 后续 listSites 可见', () => {
    const svc = makeService()
    const before = svc.listSites().data.data.length
    const created = svc.createSite({ name: '滨州分院', city: '滨州', region: '华东', studies: 1234 })
    expect(created.success).toBe(true)
    expect(created.data?.id).toMatch(/^SITE-NEW-/)
    const after = svc.listSites().data.data
    expect(after.length).toBe(before + 1)
    expect(after.some((s) => s.name === '滨州分院')).toBe(true)
  })

  it('createSite 缺名称返回失败', () => {
    const svc = makeService()
    const res = svc.createSite({ name: '' })
    expect(res.success).toBe(false)
  })

  it('updateSite 更新字段并持久化', () => {
    const svc = makeService()
    const id = svc.listSites().data.data[1]!.id
    const res = svc.updateSite(id, { status: 'maintenance', latencyMs: 88 })
    expect(res.success).toBe(true)
    const fetched = svc.getSite(id).data
    expect(fetched?.status).toBe('maintenance')
    expect(fetched?.latencyMs).toBe(88)
  })

  it('listCampuses 为每站点派生主/分院区', () => {
    const svc = makeService()
    const campuses = svc.listCampuses().data.data
    const sites = svc.listSites().data.data
    expect(campuses.length).toBe(sites.length * 2)
    expect(campuses.every((c) => c.siteId && c.name)).toBe(true)
    expect(campuses.filter((c) => c.isMain).length).toBe(sites.length)
  })

  it('federation config 默认集中式, 可切换联邦式', () => {
    const svc = makeService()
    const cfg = svc.getFederationConfig().data
    expect(cfg.mode).toBe('centralized')
    expect(cfg.members.length).toBeGreaterThan(0)
    const updated = svc.updateFederationConfig({ mode: 'federated', syncIntervalSec: 30, autoFailover: false })
    expect(updated.data.mode).toBe('federated')
    expect(updated.data.syncIntervalSec).toBe(30)
    expect(svc.getFederationConfig().data.mode).toBe('federated')
  })

  it('cross-site stats 聚合各站点数据', () => {
    const svc = makeService()
    const stats = svc.getCrossSiteStats().data
    const sites = svc.listSites().data.data
    expect(stats.totalSites).toBe(sites.length)
    expect(stats.totalStudies).toBe(sites.reduce((a, s) => a + s.studies, 0))
    expect(stats.totalPatients).toBe(sites.reduce((a, s) => a + s.patients, 0))
    expect(stats.byRegion.length).toBeGreaterThan(0)
    expect(stats.avgUptimePct).toBeGreaterThan(90)
  })
})
