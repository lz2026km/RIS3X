import { RegionalService } from './regional.service'

/**
 * [G005 Wave 4B] 区域医联体协同 — RegionalCollaborationPage 依赖端点单测
 * 覆盖: 机构成员 / 跨院调阅 (cross-query + access-records POST) /
 *       远程会诊 (consultations POST + accept) / 共享统计 / 站点同步状态
 */

const makeService = () => {
  const prisma = {
    exam: { findMany: async () => [], findUnique: async () => null },
    report: { findMany: async () => [], findUnique: async () => null },
    appointment: {
      findMany: async () => [],
      update: async ({ where, data }: any) => ({ id: where.id, ...data }),
    },
    user: { findMany: async () => [] },
    systemConfig: { findMany: async () => [] },
  }
  return new RegionalService(prisma as any)
}

describe('RegionalService [G005 Wave 4B] 区域医联体协同', () => {
  it('listInstitutions: 返回成员机构 (名称/AE Title/在线状态)', async () => {
    const svc = makeService()
    const res = await svc.listInstitutions()
    expect(res.success).toBe(true)
    expect(res.data.length).toBeGreaterThanOrEqual(4)
    const first = res.data[0]
    expect(first.name).toBeTruthy()
    expect(first.aeTitle).toBeTruthy()
    expect(['online', 'offline', 'busy']).toContain(first.status)
  })

  it('crossInstitutionQuery: 按患者名检索命中, 按机构过滤生效', async () => {
    const svc = makeService()
    const byName = await svc.crossInstitutionQuery({ queryType: 'name', queryValue: '张伟' })
    expect(byName.success).toBe(true)
    expect(byName.data.length).toBeGreaterThan(0)
    expect(byName.data.every((s: any) => s.patientName.includes('张伟'))).toBe(true)
    const byInst = await svc.crossInstitutionQuery({ institutionId: 'INST-002', queryType: 'name', queryValue: '' })
    expect(byInst.data.every((s: any) => s.institution === '西城区人民医院')).toBe(true)
  })

  it('createAccessRecord: 记录跨院调阅并插入列表头', async () => {
    const svc = makeService()
    const res = await svc.createAccessRecord({
      patientName: '测试患者', patientId: 'P000999', studyType: 'CT 胸部平扫', hospital: '东华区第一医院', purpose: '跨院调阅基线对比',
    })
    expect(res.success).toBe(true)
    expect(res.data.patientName).toBe('测试患者')
    expect(res.data.id).toMatch(/^ARC-/)
    expect(res.data.accessTime).toBeTruthy()
    const list = await svc.listAccessRecords()
    expect(list.data[0].patientId).toBe('P000999')
  })

  it('createConsultationRequest + acceptConsultationRequest: 发起并参与会诊', async () => {
    const svc = makeService()
    const created = await svc.createConsultationRequest({
      patientName: '会诊患者', hospital: '西城区人民医院', diagnosis: '颅内占位性质待定', priority: 'urgent',
    })
    expect(created.success).toBe(true)
    expect(created.data.status).toBe('open')
    const accepted = await svc.acceptConsultationRequest(created.data.id) as any
    expect(accepted.success).toBe(true)
    expect(accepted.data.status).toBe('in-progress')
    expect(accepted.data.expert).toBeTruthy()
  })

  it('acceptConsultationRequest: 不存在返回 null 且不抛异常', async () => {
    const svc = makeService()
    const res = await svc.acceptConsultationRequest('NOT-EXIST')
    expect(res.success).toBe(true)
    expect(res.data).toBeNull()
  })

  it('共享统计派生: access-records + document-registry 可聚合', async () => {
    const svc = makeService()
    const [records, registry] = await Promise.all([svc.listAccessRecords(), svc.listDocumentRegistry()])
    const byHospital = new Map<string, number>()
    for (const r of records.data) byHospital.set(r.hospital, (byHospital.get(r.hospital) ?? 0) + 1)
    expect(byHospital.size).toBeGreaterThan(0)
    expect(registry.data.length).toBeGreaterThan(0)
    const total = [...byHospital.values()].reduce((s, c) => s + c, 0)
    expect(total).toBe(records.data.length)
  })

  it('listSites/listSiteSyncEvents/listSiteRoutingRules: 同步状态信封形状', async () => {
    const svc = makeService()
    const sites = svc.listSites()
    expect(sites.success).toBe(true)
    expect(sites.data.source).toBe('database')
    expect(sites.data.data.length).toBeGreaterThan(0)
    const events = svc.listSiteSyncEvents()
    expect(events.data.data.length).toBeGreaterThan(0)
    expect(events.data.data[0].siteId).toBeTruthy()
    const rules = svc.listSiteRoutingRules()
    expect(rules.data.data.length).toBeGreaterThan(0)
    expect(typeof rules.data.data[0].active).toBe('boolean')
  })
})
