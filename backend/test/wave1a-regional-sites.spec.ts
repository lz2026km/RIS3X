/**
 * [G005 Wave1A W9] 多站点/多院区 spec — sites / sync-events / routing-rules (机构表派生)
 */
import { RegionalService } from '../src/regional/regional.service'

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

describe('Wave1A Regional multi-site', () => {
  const svc = new RegionalService(failingPrisma() as never)

  it('listSites: 总院 + 成员机构派生, 带 source 信封', () => {
    const res = svc.listSites()
    expect(res.success).toBe(true)
    const envelope = res.data as any
    expect(envelope.source).toBe('database')
    expect(envelope.generatedAt).toBeTruthy()
    const sites = envelope.data as any[]
    expect(sites.length).toBeGreaterThanOrEqual(5)
    expect(sites.filter((s) => s.primary).length).toBe(1)
    for (const s of sites) {
      expect(s.id).toBeTruthy()
      expect(s.code).toBeTruthy()
      expect(['active', 'offline', 'syncing', 'maintenance']).toContain(s.status)
      expect(typeof s.studies).toBe('number')
    }
  })

  it('listSiteSyncEvents: 事件关联站点且确定性', () => {
    const res = svc.listSiteSyncEvents()
    const envelope = res.data as any
    const events = envelope.data as any[]
    expect(events.length).toBeGreaterThan(10)
    const siteIds = new Set((svc.listSites().data as any).data.map((s: any) => s.id))
    for (const e of events) {
      expect(siteIds.has(e.siteId)).toBe(true)
      expect(['study_pushed', 'study_pulled', 'user_sync', 'config_sync']).toContain(e.type)
      expect(['success', 'failed', 'pending']).toContain(e.status)
      expect(typeof e.count).toBe('number')
    }
    expect(svc.listSiteSyncEvents().data.data).toEqual(envelope.data)
  })

  it('listSiteRoutingRules: 路由规则形状正确', () => {
    const res = svc.listSiteRoutingRules()
    const envelope = res.data as any
    const rules = envelope.data as any[]
    expect(rules.length).toBeGreaterThan(0)
    for (const r of rules) {
      expect(r.sourceSite).toBeTruthy()
      expect(r.destSite).toBeTruthy()
      expect(typeof r.modality).toBe('string')
      expect(typeof r.active).toBe('boolean')
      expect(typeof r.matchedCount).toBe('number')
    }
  })
})
