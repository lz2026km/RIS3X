/**
 * [G005 Wave1A] Consultations 模块 spec — Report 派生 + 内存态生命周期
 */
import { ConsultationsService } from '../src/modules/consultations/consultations.service'

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

describe('Wave1A Consultations', () => {
  it('list: DB 失败时回退确定性 seed (含中文状态)', async () => {
    const svc = new ConsultationsService(failingPrisma())
    const list = await svc.list({})
    expect(list.length).toBeGreaterThan(0)
    expect(list.every((c) => ['待回复', '已回复', '已完成', '已拒绝'].includes(c.status))).toBe(true)
    expect(list.every((c) => c.patientName && c.examId)).toBe(true)
  })

  it('list: Report 状态派生 (待回复/已完成)', async () => {
    const prisma: any = {
      report: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'R1', state: 'SUBMITTED', createdAt: new Date('2026-08-01T08:00:00Z'),
            radiologist: { fullName: '张医生', department: '放射科' },
            exam: { id: 'E1', modality: 'CT', bodyPart: '胸部', patient: { id: 'P1', name: '张三' } },
          },
          {
            id: 'R2', state: 'PUBLISHED', createdAt: new Date('2026-08-02T08:00:00Z'),
            radiologist: null,
            exam: { id: 'E2', modality: 'MR', bodyPart: '头颅', patient: { id: 'P2', name: '李四' } },
          },
        ]),
      },
    }
    const svc = new ConsultationsService(prisma)
    const list = await svc.list({})
    expect(list).toHaveLength(2)
    expect(list[0]!.status).toBe('已回复')
    expect(list[1]!.status).toBe('已完成')
    expect(list[0]!.patientName).toBe('张三')
    expect(list[0]!.consultedDoctorName).toBe('张医生')
  })

  it('生命周期: create → invite → start → complete → cancel + comments/replies', async () => {
    const svc = new ConsultationsService(failingPrisma())
    const created = svc.create({ patientName: '测试患者', examId: 'E-TEST', requestedBy: '张主任' })
    expect(created.status).toBe('待回复')

    const invited = svc.invite(created.id, ['D1', 'D2'])
    expect(invited.consultants).toContain('D1')

    const started = svc.start(created.id)
    expect(started.status).toBe('已回复')

    const c1 = svc.addComment(created.id, '张主任', '请提供既往影像')
    const r1 = svc.replyComment(created.id, c1.id, '李医生', '已上传')
    expect(r1.parentId).toBe(c1.id)
    expect(svc.listComments(created.id)).toHaveLength(2)

    const done = svc.complete(created.id, '会诊意见: 未见异常')
    expect(done.status).toBe('已完成')
    expect(done.notes).toContain('未见异常')

    const stats = await svc.getStats()
    expect(stats.total).toBeGreaterThan(0)
    expect(stats.completedCount).toBeGreaterThan(0)

    const cancelled = svc.cancel(created.id)
    expect(cancelled.status).toBe('已拒绝')
  })

  it('getPending / by-patient / by-doctor 过滤正确', async () => {
    const svc = new ConsultationsService(failingPrisma())
    const pending = await svc.getPending()
    expect(pending.length).toBeGreaterThan(0)
    expect(pending.every((c) => c.status !== '已完成' && c.status !== '已拒绝')).toBe(true)

    const all = await svc.list({})
    const patient = await svc.getByPatient(all[0]!.patientId!)
    expect(patient.length).toBeGreaterThan(0)
    expect(patient.every((c) => c.patientId === all[0]!.patientId)).toBe(true)

    const byDoctor = await svc.getByDoctor('王主任')
    expect(Array.isArray(byDoctor)).toBe(true)
  })

  it('getById 不存在时抛 404', async () => {
    const svc = new ConsultationsService(failingPrisma())
    await expect(svc.getById('ghost')).rejects.toThrow(/不存在/)
  })
})
