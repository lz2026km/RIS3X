/**
 * [G005 Wave 2A] 委员会会诊 (多医生合议) spec
 * 覆盖: 创建 / 投票 / 决议生成(可选追加报告) / 汇总 / 列表 / 隔离 / 404 / 状态保护
 */
import { NotFoundException } from '@nestjs/common'
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

describe('Wave 2A Committee Consultations', () => {
  it('createCommittee: 创建委员会会诊, 成员规范化 + 默认 voting 状态', async () => {
    const svc = new ConsultationsService(failingPrisma())
    const created = await svc.createCommittee({
      reportId: 'RPT-100',
      title: '疑难病例合议',
      members: ['D001', { memberId: 'D002' }],
      createdBy: '张明远',
    })
    expect(created.id).toMatch(/^CMT-/)
    expect(created.status).toBe('voting')
    expect(created.members).toHaveLength(2)
    expect(created.members[0]!.name).toBe('张明远') // 来自医生池
    expect(created.members[0]!.opinion).toBe('未投票')
    expect(created.members[0]!.votedAt).toBe('')
    expect(created.createdBy).toBe('张明远')
  })

  it('createCommittee: reportId 为空时抛 404', () => {
    const svc = new ConsultationsService(failingPrisma())
    expect(() => svc.createCommittee({ reportId: '  ', title: 'x', members: ['D001'] })).toThrow(
      /reportId 不能为空/,
    )
  })

  it('committee 列表: 含种子数据, 字段齐全', async () => {
    const svc = new ConsultationsService(failingPrisma())
    const list = await svc.listCommittees()
    expect(list.length).toBeGreaterThanOrEqual(2)
    expect(list.every((c) => c.id && c.reportId && c.title && c.members.length > 0)).toBe(true)
    const resolved = list.find((c) => c.status === 'resolved')
    expect(resolved?.resolution?.resolution).toBeTruthy()
  })

  it('voteCommittee: 委员投票后 opinion/agree/suggestion/votedAt 更新', async () => {
    const svc = new ConsultationsService(failingPrisma())
    const committee = await svc.createCommittee({ reportId: 'RPT-200', title: '合议', members: ['D001', 'D003'] })
    const voted = await svc.voteCommittee(committee.id, {
      memberId: 'D001',
      opinion: '考虑主动脉夹层',
      agree: true,
      suggestion: '建议CTA随访',
    })
    const member = voted.members.find((m) => m.memberId === 'D001')!
    expect(member.opinion).toBe('考虑主动脉夹层')
    expect(member.agree).toBe(true)
    expect(member.suggestion).toBe('建议CTA随访')
    expect(member.votedAt).toBeTruthy()
    // 其余成员未投票
    expect(voted.members.find((m) => m.memberId === 'D003')!.votedAt).toBe('')
  })

  it('voteCommittee: 非成员投票 → NotFoundException', () => {
    const svc = new ConsultationsService(failingPrisma())
    const committee = svc.createCommittee({ reportId: 'RPT-300', title: '合议', members: ['D001'] })
    expect(() =>
      svc.voteCommittee(committee.id, { memberId: 'GHOST', opinion: 'x', agree: true }),
    ).toThrow(/不在会诊成员中/)
  })

  it('getCommittee: 返回汇总 (totalMembers/votedCount/agreeRate/pendingMembers)', () => {
    const svc = new ConsultationsService(failingPrisma())
    const detail = svc.getCommittee('CMT-SEED-001')
    expect(detail.summary.totalMembers).toBe(3)
    expect(detail.summary.votedCount).toBe(2)
    expect(detail.summary.agreeCount).toBe(2)
    expect(detail.summary.agreeRate).toBe(100)
    expect(detail.summary.pendingMembers).toContain('王海涛')
  })

  it('generateCommitteeResolution: 生成决议 + 状态转 resolved + 追加报告(DB 失败仍回退标记)', async () => {
    const svc = new ConsultationsService(failingPrisma())
    const committee = svc.createCommittee({ reportId: 'RPT-400', title: '合议', members: ['D001', 'D002'] })
    const done = await svc.generateCommitteeResolution(committee.id, {
      resolution: '委员会一致同意手术指征明确。',
      appendToReport: true,
    })
    expect(done.status).toBe('resolved')
    expect(done.resolution?.resolution).toContain('一致同意')
    expect(done.resolution?.generatedAt).toBeTruthy()
    expect(done.resolution?.appendedToReport).toBe('RPT-400')
    // DB 可用时真实写入 report.conclusion
    const update = jest.fn().mockResolvedValue({ id: 'RPT-400' })
    const prisma: any = { report: { update } }
    const svc2 = new ConsultationsService(prisma)
    const c2 = svc2.createCommittee({ reportId: 'RPT-400', title: '合议2', members: ['D001'] })
    await svc2.generateCommitteeResolution(c2.id, { resolution: '决议', appendToReport: true })
    expect(update).toHaveBeenCalled()
    const arg = update.mock.calls[0][0] as { where: { id: string } }
    expect(arg.where.id).toBe('RPT-400')
  })

  it('generateCommitteeResolution: 决议为空 → 404; 已决议会诊禁止再投票', async () => {
    const svc = new ConsultationsService(failingPrisma())
    const committee = svc.createCommittee({ reportId: 'RPT-500', title: '合议', members: ['D001'] })
    await expect(
      svc.generateCommitteeResolution(committee.id, { resolution: '   ' }),
    ).rejects.toThrow(NotFoundException)
    await svc.generateCommitteeResolution(committee.id, { resolution: '已生成决议' })
    expect(() =>
      svc.voteCommittee(committee.id, { memberId: 'D001', opinion: 'x', agree: true }),
    ).toThrow(/无法继续投票|已生成决议/)
  })

  it('不存在的委员会 → getCommittee/vote 均抛 404', () => {
    const svc = new ConsultationsService(failingPrisma())
    expect(() => svc.getCommittee('ghost')).toThrow(/不存在/)
    expect(() =>
      svc.voteCommittee('ghost', { memberId: 'D001', opinion: 'x', agree: true }),
    ).toThrow(/不存在/)
  })
})
