/**
 * [G005 v3.0.6.13] IHE XDS.b / XCA / XDR spec
 * 覆盖: ITI-41 provide / ITI-43 retrieve / ITI-18 query / ITI-38 cross query / ITI-39 cross retrieve / XDR direct
 */
import { BadRequestException } from '@nestjs/common'
import { XdsService, XDS_HOME_COMMUNITY, XDS_REMOTE_COMMUNITY } from './xds.service'

const b64 = (s: string) => Buffer.from(s).toString('base64')

describe('XdsService (XDS.b ITI-41/43/18)', () => {
  let svc: XdsService

  beforeEach(() => {
    svc = new XdsService()
  })

  it('seed 覆盖本社区 + 远端社区文档', () => {
    const stats = svc.getStats()
    expect(stats.total).toBeGreaterThanOrEqual(4)
    const communities = stats.byCommunity.map((c) => c.homeCommunityId)
    expect(communities).toContain(XDS_HOME_COMMUNITY)
    expect(communities).toContain(XDS_REMOTE_COMMUNITY)
  })

  it('ITI-41 provide 存储元数据 + 字节, ITI-43 retrieve 回取内容', () => {
    const provided = svc.provideAndRegister({
      patientId: 'P-ITI41',
      documents: [
        { title: '测试报告', classCode: 'RAD', formatCode: 'urn:ihe:rad:1', mimeType: 'application/pdf', content: b64('hello-xds') },
      ],
    })
    expect(provided.success).toBe(true)
    expect(provided.transaction).toBe('ITI-41')
    expect(provided.documentIds).toHaveLength(1)
    const doc = provided.documents[0]!
    expect(doc.patientId).toBe('P-ITI41')
    expect(doc.size).toBe(Buffer.from('hello-xds').length)

    const retrieved = svc.retrieveDocumentSet({
      documents: [{ repositoryUniqueId: doc.repositoryUniqueId, documentUniqueId: doc.uniqueId }],
    })
    expect(retrieved.successCount).toBe(1)
    expect(Buffer.from(retrieved.results[0]!.content!, 'base64').toString()).toBe('hello-xds')
  })

  it('ITI-43 未找到文档 → FAILURE DocumentNotFound', () => {
    const res = svc.retrieveDocumentSet({
      documents: [{ repositoryUniqueId: XDS_REMOTE_COMMUNITY, documentUniqueId: 'not-exist' }],
    })
    expect(res.failureCount).toBe(1)
    expect(res.results[0]!.error).toBe('DocumentNotFound')
  })

  it('ITI-41 缺少文档 → BadRequest', () => {
    expect(() => svc.provideAndRegister({ patientId: 'P1', documents: [] })).toThrow(BadRequestException)
  })

  it('ITI-18 RegistryStoredQuery 按 patientId 过滤', () => {
    const res = svc.registryStoredQuery({ patientId: 'P000023' })
    expect(res.transaction).toBe('ITI-18')
    expect(res.total).toBeGreaterThanOrEqual(3)
    expect(res.documents.every((d) => d.patientId === 'P000023')).toBe(true)
  })

  it('ITI-18 按 classCode/formatCode 过滤', () => {
    const reports = svc.registryStoredQuery({ patientId: 'P000023', formatCode: 'urn:ihe:rad:1' })
    expect(reports.documents.every((d) => d.formatCode === 'urn:ihe:rad:1')).toBe(true)
  })
})

describe('XdsService (XCA ITI-38/39 + XDR ITI-41 direct)', () => {
  let svc: XdsService

  beforeEach(() => {
    svc = new XdsService()
  })

  it('ITI-38 CrossGatewayQuery 返回多社区分组', () => {
    const res = svc.crossGatewayQuery({ homeCommunityId: 'ALL', patientId: 'P000023' })
    expect(res.transaction).toBe('ITI-38')
    expect(res.communities.length).toBeGreaterThanOrEqual(2)
    const total = res.communities.reduce((a, c) => a + c.count, 0)
    expect(total).toBe(res.total)
  })

  it('ITI-38 指定社区查询仅返回该社区', () => {
    const res = svc.crossGatewayQuery({ homeCommunityId: XDS_REMOTE_COMMUNITY, patientId: 'P000023' })
    expect(res.documents.every((d) => d.homeCommunityId === XDS_REMOTE_COMMUNITY)).toBe(true)
  })

  it('ITI-39 CrossGatewayRetrieve 跨社区回取, 社区不匹配 → FAILURE', () => {
    const target = svc.registryStoredQuery({ homeCommunityId: XDS_REMOTE_COMMUNITY, patientId: 'P000023' }).documents[0]!
    const ok = svc.crossGatewayRetrieve({
      homeCommunityId: XDS_REMOTE_COMMUNITY,
      documents: [{ repositoryUniqueId: target.repositoryUniqueId, documentUniqueId: target.uniqueId }],
    })
    expect(ok.transaction).toBe('ITI-39')
    expect(ok.successCount).toBe(1)

    const mismatch = svc.crossGatewayRetrieve({
      homeCommunityId: XDS_HOME_COMMUNITY,
      documents: [{ repositoryUniqueId: target.repositoryUniqueId, documentUniqueId: target.uniqueId }],
    })
    expect(mismatch.results[0]!.error).toBe('HomeCommunityMismatch')
  })

  it('XDR ITI-41 direct point-to-point', () => {
    const res = svc.provideAndRegisterDirect({
      patientId: 'P-XDR',
      homeCommunityId: XDS_HOME_COMMUNITY,
      documents: [{ title: 'XDR 直传', content: b64('xdr') }],
    })
    expect(res.mode).toBe('direct')
    expect(res.repositoryUniqueId).toContain('xdr-')
    expect(res.documentIds).toHaveLength(1)
  })
})
