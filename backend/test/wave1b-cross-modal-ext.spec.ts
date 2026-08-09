/**
 * [G005 Wave1B P1] Cross-modal 3 扩展 spec — index-status / reindex / suggestions
 */
import { CrossModalService } from '../src/modules/cross-modal/cross-modal.service'

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

describe('Wave1B Cross-modal extensions', () => {
  it('index-status: DB 失败时回退 seed (byModality 聚合)', async () => {
    const svc = new CrossModalService(failingPrisma())
    const status = await svc.getIndexStatus()
    expect(status.status).toBe('ready')
    expect(status.totalDocuments).toBeGreaterThan(0)
    expect(Object.keys(status.byModality).length).toBeGreaterThan(0)
  })

  it('index-status: DB 有检查时派生文档数', async () => {
    const prisma: any = {
      exam: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'E1', accessionNumber: 'A1', modality: 'CT', bodyPart: '胸部', scheduledAt: new Date('2026-07-01'), startedAt: null, completedAt: null, patientId: 'P1', patient: { name: '张三' }, reports: [{ findings: '结节' }] },
          { id: 'E2', accessionNumber: 'A2', modality: 'MR', bodyPart: '头颅', scheduledAt: new Date('2026-07-02'), startedAt: null, completedAt: null, patientId: 'P2', patient: { name: '李四' }, reports: [] },
        ]),
      },
    }
    const svc = new CrossModalService(prisma)
    const status = await svc.getIndexStatus()
    expect(status.totalDocuments).toBe(2)
    expect(status.byModality['CT']).toBe(1)
    expect(status.byModality['MR']).toBe(1)
  })

  it('reindex: 确定性结果 (modality 透传)', async () => {
    const svc = new CrossModalService(failingPrisma())
    const all = await svc.reindex()
    expect(all.status).toBe('reindexed')
    expect(all.modality).toBe('all')
    expect(all.durationMs).toBeGreaterThan(0)
    const ct = await svc.reindex('CT')
    expect(ct.modality).toBe('CT')
  })

  it('suggestions: 过滤建议词', () => {
    const svc = new CrossModalService(failingPrisma())
    const all = svc.suggestions('')
    expect(all.length).toBeGreaterThan(0)
    const filtered = svc.suggestions('结节')
    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every((s) => s.includes('结节'))).toBe(true)
  })
})
