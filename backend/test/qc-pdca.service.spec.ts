/**
 * [G005 Wave 3A v3.0.6.11-99] QcPdcaService spec — 内存 CRUD + seed 回退 + 缺陷派生
 * 覆盖: cycles CRUD / advance 流转 / phases CRUD / defects 关联 / complete / stats (12+ 用例)
 */
import { QcPdcaService } from '../src/modules/qc-pdca/qc-pdca.service'

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

function freshService(): QcPdcaService {
  return new QcPdcaService(failingPrisma())
}

describe('Wave3A QcPdcaService (PDCA 质控闭环)', () => {
  it('listCycles: seed 周期列表含全部阶段与 4 种类别', async () => {
    const svc = freshService()
    const res = await svc.listCycles()
    expect(res.source).toBe('demo')
    expect(res.data.length).toBeGreaterThanOrEqual(6)
    const phases = new Set(res.data.map((c) => c.phase))
    expect(phases.has('plan')).toBe(true)
    expect(phases.has('do')).toBe(true)
    expect(phases.has('check')).toBe(true)
    expect(phases.has('act')).toBe(true)
    expect(phases.has('completed')).toBe(true)
    const categories = new Set(res.data.map((c) => c.category))
    for (const cat of ['报告质控', '图像质控', '流程质控', '服务质控']) expect(categories.has(cat as never)).toBe(true)
  })

  it('createCycle: 创建成功, 初始阶段为 plan, 响应含 ownerName', async () => {
    const svc = freshService()
    const created = await svc.createCycle({ title: '胶片质量提升专项', category: '图像质控', description: '减少重拍率', target: '重拍率 ≤ 2%', ownerId: 'u-003' })
    expect(created.id).toMatch(/^pdca-\d+$/)
    expect(created.phase).toBe('plan')
    expect(created.status).toBe('进行中')
    expect(created.ownerName).toBe('王技师')
    expect(created.defectIds).toEqual([])
  })

  it('createCycle: 空标题抛 BadRequestException', async () => {
    const svc = freshService()
    await expect(svc.createCycle({ title: '  ', category: '报告质控' })).rejects.toThrow('标题不能为空')
  })

  it('createCycle: 非法类别抛 BadRequestException', async () => {
    const svc = freshService()
    await expect(svc.createCycle({ title: 'x', category: '其他' as never })).rejects.toThrow('类别必须为')
  })

  it('getCycle: 返回基本信息 + 阶段计划列表', async () => {
    const svc = freshService()
    const detail = await svc.getCycle('pdca-001')
    expect(detail.title).toBe('报告术语规范专项')
    expect(detail.phases.length).toBeGreaterThanOrEqual(6)
    expect(detail.phases.every((p) => ['plan', 'do', 'check', 'act'].includes(p.phase))).toBe(true)
  })

  it('getCycle: 不存在抛 NotFoundException', async () => {
    const svc = freshService()
    await expect(svc.getCycle('pdca-999')).rejects.toThrow('不存在')
  })

  it('updateCycle: 编辑标题/目标/负责人生效', async () => {
    const svc = freshService()
    const updated = await svc.updateCycle('pdca-005', { title: '报告模板统一专项 V2', target: '统一率 100%', ownerId: 'u-001' })
    expect(updated.title).toBe('报告模板统一专项 V2')
    expect(updated.target).toBe('统一率 100%')
    expect(updated.ownerName).toBe('张主任')
  })

  it('deleteCycle: 删除后 listCycles 不含该周期且 get 抛异常', async () => {
    const svc = freshService()
    const before = (await svc.listCycles()).data.length
    await svc.deleteCycle('pdca-005')
    const after = (await svc.listCycles()).data.length
    expect(after).toBe(before - 1)
    await expect(svc.getCycle('pdca-005')).rejects.toThrow('不存在')
  })

  it('advanceCycle: 按 plan→do→check→act→completed 流转', async () => {
    const svc = freshService()
    let c = await svc.advanceCycle('pdca-005')
    expect(c.phase).toBe('do')
    c = await svc.advanceCycle('pdca-005')
    expect(c.phase).toBe('check')
    c = await svc.advanceCycle('pdca-005')
    expect(c.phase).toBe('act')
    c = await svc.advanceCycle('pdca-005')
    expect(c.phase).toBe('completed')
    expect(c.status).toBe('已完成')
    expect(c.completedAt).toBeDefined()
  })

  it('advanceCycle: 已完成周期再次推进抛 BadRequestException', async () => {
    const svc = freshService()
    const done = await svc.completeCycle('pdca-004', {})
    expect(done.phase).toBe('completed')
    await expect(svc.advanceCycle('pdca-004')).rejects.toThrow('不能再推进')
  })

  it('listPhases: 返回阶段条目且按时间排序', async () => {
    const svc = freshService()
    const res = await svc.listPhases('pdca-002')
    expect(res.data.length).toBeGreaterThanOrEqual(4)
    const phases = res.data.map((p) => p.phase)
    expect(phases.includes('plan')).toBe(true)
    expect(phases.includes('act')).toBe(true)
    for (let i = 1; i < res.data.length; i++) {
      expect(res.data[i - 1]!.createdAt.localeCompare(res.data[i]!.createdAt)).toBeLessThanOrEqual(0)
    }
  })

  it('addPhase: 添加阶段条目后 listPhases 可见', async () => {
    const svc = freshService()
    const before = (await svc.listPhases('pdca-004')).data.length
    const entry = await svc.addPhase('pdca-004', { phase: 'check', content: '复测曝光合格率 97%' })
    expect(entry.id).toMatch(/^phase-\d+$/)
    const after = (await svc.listPhases('pdca-004')).data.length
    expect(after).toBe(before + 1)
  })

  it('addPhase: 非法阶段或空内容抛 BadRequestException', async () => {
    const svc = freshService()
    await expect(svc.addPhase('pdca-004', { phase: 'xx' as never, content: 'x' })).rejects.toThrow('阶段必须为')
    await expect(svc.addPhase('pdca-004', { phase: 'plan', content: '' })).rejects.toThrow('内容不能为空')
  })

  it('updatePhase: 修改条目内容与阶段生效', async () => {
    const svc = freshService()
    const entry = await svc.addPhase('pdca-003', { phase: 'do', content: '试点两周' })
    const updated = await svc.updatePhase(entry.id, { content: '试点两周并扩大范围', phase: 'check' })
    expect(updated.content).toBe('试点两周并扩大范围')
    expect(updated.phase).toBe('check')
    expect(updated.updatedAt >= updated.createdAt).toBe(true)
  })

  it('updatePhase: 不存在条目抛 NotFoundException', async () => {
    const svc = freshService()
    await expect(svc.updatePhase('phase-999', { content: 'x' })).rejects.toThrow('不存在')
  })

  it('listCycleDefects: seed 回退关联缺陷, 未链接时返回默认 3 条', async () => {
    const svc = freshService()
    const created = await svc.createCycle({ title: '新建周期', category: '报告质控' })
    const res = await svc.listCycleDefects(created.id)
    expect(res.source).toBe('demo')
    expect(res.data.length).toBe(3)
    expect(res.data.every((d) => d.defectType && d.description)).toBe(true)
  })

  it('linkDefect: 关联缺陷后 listCycleDefects 按关联过滤', async () => {
    const svc = freshService()
    const created = await svc.createCycle({ title: '关联缺陷周期', category: '流程质控' })
    await svc.linkDefect(created.id, { defectId: 'df-002' })
    await svc.linkDefect(created.id, { defectId: 'df-001' })
    const res = await svc.listCycleDefects(created.id)
    expect(res.data.map((d) => d.id).sort()).toEqual(['df-001', 'df-002'])
    const linked = await svc.linkDefect(created.id, { defectId: 'df-002' })
    expect(linked.defectIds.filter((i) => i === 'df-002')).toHaveLength(1)
  })

  it('linkDefect: 空 defectId 抛 BadRequestException', async () => {
    const svc = freshService()
    await expect(svc.linkDefect('pdca-001', { defectId: '' })).rejects.toThrow('defectId')
  })

  it('completeCycle: 记录 summary + completedAt, 状态转已完成', async () => {
    const svc = freshService()
    const done = await svc.completeCycle('pdca-004', { summary: '曝光参数已校准, 复测合格率 96.5%' })
    expect(done.phase).toBe('completed')
    expect(done.status).toBe('已完成')
    expect(done.summary).toContain('96.5')
    expect(done.completedAt).toBeDefined()
    await expect(svc.completeCycle('pdca-004', {})).rejects.toThrow('已完成')
  })

  it('getStats: 阶段数量/完成率/类别/平均时长形状正确', async () => {
    const svc = freshService()
    const res = await svc.getStats()
    const d = res.data
    expect(d.total).toBeGreaterThanOrEqual(6)
    expect(d.byPhase.plan).toBeGreaterThanOrEqual(1)
    expect(d.byPhase.completed).toBeGreaterThanOrEqual(1)
    expect(d.completionRate).toBeGreaterThan(0)
    expect(d.byCategory['报告质控']).toBeGreaterThanOrEqual(1)
    expect(d.avgDurationDays).toBeGreaterThan(0)
    expect(d.inProgress).toBe(d.total - d.byPhase.completed)
  })

  it('listAllDefects: seed 回退缺陷池', async () => {
    const svc = freshService()
    const res = await svc.listAllDefects()
    expect(res.data.length).toBeGreaterThanOrEqual(6)
  })
})
