/**
 * [G005 Wave1A] Insurance Audits 模块 spec — 表派生 + seed 回退 + approve/reject 写操作
 */
import { InsuranceAuditsService } from '../src/modules/insurance-audits/insurance-audits.service'

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

describe('Wave1A Insurance Audits', () => {
  it('list: DB 失败时回退确定性 seed (含 pending/approved/rejected)', async () => {
    const svc = new InsuranceAuditsService(failingPrisma())
    const all = await svc.list()
    expect(all.length).toBeGreaterThan(0)
    const statuses = new Set(all.map((a) => a.status))
    expect(statuses.has('pending')).toBe(true)
    expect(statuses.has('approved')).toBe(true)
    expect(statuses.has('rejected')).toBe(true)
    expect(all.every((a) => a.examId && a.patientName)).toBe(true)
  })

  it('list: DB 派生 (InsuranceAudit 表) + 状态筛选', async () => {
    const prisma: any = {
      insuranceAudit: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'I1', patientId: 'P1', invoiceId: 'EX-1', finding: '张三·胸部CT增强', amount: 680, status: 'PENDING', auditor: null, auditedAt: null, resolution: null },
          { id: 'I2', patientId: 'P2', invoiceId: 'EX-2', finding: '李四·冠脉CTA', amount: 1260, status: 'APPROVED', auditor: '医保办', auditedAt: new Date(), resolution: null },
        ]),
      },
    }
    const svc = new InsuranceAuditsService(prisma as never)
    const all = await svc.list()
    expect(all).toHaveLength(2)
    expect(all[0]!.status).toBe('pending')
    expect(all[1]!.status).toBe('approved')
    const pending = await svc.list('pending')
    expect(pending).toHaveLength(1)
  })

  it('create → approve / reject 状态流转 (内存 + DB persist 尽力而为)', async () => {
    const prisma: any = {
      insuranceAudit: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'IA-NEW' }),
        update: jest.fn().mockResolvedValue({}),
      },
    }
    const svc = new InsuranceAuditsService(prisma)
    const created = await svc.create({ examId: 'EX-9', patientName: '测试患者', examItem: '腹部CT增强', contrastAgent: '碘海醇', amount: 720 })
    expect(created.status).toBe('pending')

    const approved = await svc.approve(created.id, '医保办·王主任')
    expect(approved.status).toBe('approved')
    expect(approved.auditedBy).toBe('医保办·王主任')
    expect(approved.auditedAt).toBeTruthy()
    expect(prisma.insuranceAudit.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED' }) }))

    const rejected = await svc.reject(created.id, '缺适应症记录', '医保办')
    expect(rejected.status).toBe('rejected')
    expect(rejected.reason).toBe('缺适应症记录')
    expect(prisma.insuranceAudit.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED' }) }))
  })

  it('DB persist 失败时仅内存生效 (不抛错)', async () => {
    const svc = new InsuranceAuditsService(failingPrisma())
    const created = await svc.create({ examId: 'EX-10', patientName: '王五', examItem: '头颅MRI' })
    expect(created.status).toBe('pending')
    const approved = await svc.approve(created.id)
    expect(approved.status).toBe('approved')
    const found = await svc.getById(created.id)
    expect(found.status).toBe('approved')
  })

  it('getById 不存在时抛 404', async () => {
    const svc = new InsuranceAuditsService(failingPrisma())
    await expect(svc.getById('ghost')).rejects.toThrow(/不存在/)
  })
})
