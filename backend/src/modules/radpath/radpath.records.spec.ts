/**
 * G005 W3-BackendParity - RadPath records 服务 spec (DB 不可用回退 seed)
 */
import { RadPathService } from './radpath.service'

describe('RadPathService.listRecords', () => {
  it('DB 不可用 → 回退种子 (含 report.patient/exam)', async () => {
    const prisma = { radPathRecord: { findMany: jest.fn().mockRejectedValue(new Error('no db')) } } as never
    const svc = new RadPathService(prisma)
    const rows = await svc.listRecords()
    expect(rows.length).toBeGreaterThan(0)
    expect((rows[0] as { report?: unknown }).report).toBeTruthy()
  })

  it('DB 返回空 → 回退种子', async () => {
    const prisma = { radPathRecord: { findMany: jest.fn().mockResolvedValue([]) } } as never
    const svc = new RadPathService(prisma)
    const rows = await svc.listRecords()
    expect(rows.length).toBeGreaterThan(0)
  })

  it('DB 有数据 → 返回数据库结果', async () => {
    const dbRows = [{ id: 'RP-DB-1', report: { patient: {}, exam: {} } }]
    const prisma = { radPathRecord: { findMany: jest.fn().mockResolvedValue(dbRows) } } as never
    const svc = new RadPathService(prisma)
    const rows = await svc.listRecords()
    expect(rows).toEqual(dbRows)
  })
})
