/**
 * G005 W3-BackendParity - 临床路径患者推进/退出 spec
 */
import { NotFoundException } from '@nestjs/common'
import { ClinicalPathwayService } from './clinical-pathway.service'

const makeService = () => new ClinicalPathwayService({} as never)

describe('ClinicalPathwayService patient advance/exit', () => {
  it('advancePatient 推进阶段并保持 on-track', async () => {
    const svc = makeService()
    const beforeStep = (await svc.listPatients()).find((p) => p.id === 'PP-005')!.step
    const advanced = await svc.advancePatient('PP-005')
    expect(advanced.step).toBe(beforeStep + 1)
    expect(advanced.id).toBe('PP-005')
  })

  it('advancePatient 到达总步数 → completed', async () => {
    const svc = makeService()
    // PP-002: step 4 / total 5
    const advanced = await svc.advancePatient('PP-002')
    expect(advanced.step).toBe(5)
    expect(advanced.status).toBe('completed')
  })

  it('advancePatient 未知患者 → 404', async () => {
    const svc = makeService()
    await expect(svc.advancePatient('NOPE')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('exitPatient 退出路径 → deleted, 列表减少', async () => {
    const svc = makeService()
    const before = (await svc.listPatients()).length
    const res = await svc.exitPatient('PP-001')
    expect(res.deleted).toBe(true)
    expect((await svc.listPatients()).length).toBe(before - 1)
  })

  it('exitPatient 未知患者 → 404', async () => {
    const svc = makeService()
    await expect(svc.exitPatient('NOPE')).rejects.toBeInstanceOf(NotFoundException)
  })
})
