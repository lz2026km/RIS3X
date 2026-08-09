/**
 * [G005 Wave1B P1] Fusion 3 端点扩展 spec — list / registration/:id / DELETE
 */
import { FusionService } from '../src/modules/fusion/fusion.service'

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

describe('Wave1B Fusion extensions', () => {
  it('list: 内存注册记录 + seed 派生融合记录', async () => {
    const svc = new FusionService(failingPrisma())
    const studies = await svc.list()
    expect(studies.length).toBeGreaterThan(0)
    expect(studies.every((s) => s.id && s.studyUid && s.patientName && s.status)).toBe(true)
  })

  it('register → list/getRegistration: 内存记录可见', async () => {
    const svc = new FusionService(failingPrisma())
    const reg = await svc.register({ fixedSeriesUid: 'SER-A', movingSeriesUid: 'SER-B', transformType: 'rigid' })
    const list = await svc.list()
    expect(list.some((s) => s.registrationId === reg.registrationId)).toBe(true)
    const detail = await svc.getRegistration(reg.registrationId)
    expect(detail.metrics.dice).toBeGreaterThan(0)
    expect(detail.matrix.length).toBe(4)
  })

  it('getRegistration: seed 记录可查, 未知 id 抛 NotFound', async () => {
    const svc = new FusionService(failingPrisma())
    const seed = await svc.getRegistration('reg-seed-001')
    expect(seed.status).toBe('completed')
    await expect(svc.getRegistration('not-exist')).rejects.toThrow()
  })

  it('delete: 内存记录删除 + seed 可删 + 未知抛 NotFound', async () => {
    const svc = new FusionService(failingPrisma())
    const reg = await svc.register({ fixedSeriesUid: 'A', movingSeriesUid: 'B', transformType: 'affine' })
    expect((await svc.delete(reg.registrationId)).ok).toBe(true)
    expect(svc.getRegistration(reg.registrationId)).rejects.toThrow()
    expect((await svc.delete('reg-seed-002')).ok).toBe(true)
    await expect(svc.delete('not-exist')).rejects.toThrow()
  })
})
