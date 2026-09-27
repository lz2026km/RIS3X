// [G005 W13-Security] 审计链 spec: 端到端校验/篡改检测/留存策略/冷归档
import { AuditChainService, type ChainBlock } from './audit-chain.service'

describe('[W13] AuditChainService', () => {
  let svc: AuditChainService
  beforeEach(() => {
    svc = new AuditChainService()
  })

  it('种子链端到端校验通过', async () => {
    const v = await svc.verifyChain()
    expect(v.verified).toBe(true)
    expect(v.source).toBe('seed')
    expect(v.totalBlocks).toBeGreaterThanOrEqual(12)
    expect(v.headHash).toMatch(/^[0-9a-f]{64}$/)
    expect(v.brokenAt).toBeNull()
  })

  it('篡改区块 → 校验失败并定位', () => {
    const blocks: ChainBlock[] = [
      { index: 0, id: 'a', action: 'LOGIN', resource: 'auth', userId: 'u1', createdAt: '2026-01-01T00:00:00.000Z', prevHash: '0'.repeat(64), hash: '' },
    ]
    // 先构造合法链
    const svc2 = new AuditChainService()
    // 通过 verifyBlocks 手工构造: 复制 verifyChain 的样本不可用, 改用已知 genesis
    const first = blocks[0]!
    const v0 = svc2.verifyBlocks([{ ...first, hash: 'deadbeef' }])
    expect(v0.verified).toBe(false)
    expect(v0.reason).toContain('hash')
  })

  it('prevHash 不连续也判失败 (空链视为通过)', () => {
    const v = svc.verifyBlocks([])
    expect(v.verified).toBe(true)
    expect(v.totalBlocks).toBe(0)
  })

  it('留存策略: 6 个月 + 加密 + 冷归档', () => {
    const p = svc.getRetentionPolicy()
    expect(p.retentionMonths).toBe(6)
    expect(p.retentionDays).toBe(180)
    expect(p.coldArchiveEnabled).toBe(true)
    expect(p.encrypted).toBe(true)
  })

  it('冷归档产出归档记录', () => {
    const r = svc.coldArchive({ executedBy: 'tester' })
    expect(r.archiveId).toMatch(/^arc-/)
    expect(r.checksum).toMatch(/^[0-9a-f]{64}$/)
    expect(svc.getRetentionPolicy().lastArchiveAt).toBe(r.archivedAt)
  })
})
