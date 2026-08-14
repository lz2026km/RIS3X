// [v3.0.6.11-99 Wave 4A] 病灶追踪服务单元测试
import { Test } from '@nestjs/testing'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { LesionTrackingService, deriveLesionStatus, recistResponse } from '../src/modules/lesion-tracking/lesion-tracking.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('LesionTrackingService', () => {
  let svc: LesionTrackingService

  const mockPrisma = {
    exam: { findMany: jest.fn().mockResolvedValue([]) },
    followUpPlan: {
      findUnique: jest.fn().mockResolvedValue({ id: 'FU001', patientId: 'P000001' }),
    },
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [LesionTrackingService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile()
    svc = module.get(LesionTrackingService)
  })

  beforeEach(() => jest.clearAllMocks())

  // ── 派生逻辑 (确定性) ────────────────────────────────────────────────────
  it('recistResponse: -40% → PR, +25% → PD, -5% → SD, 0mm → CR', () => {
    expect(recistResponse(-40)).toBe('PR')
    expect(recistResponse(25)).toBe('PD')
    expect(recistResponse(-5)).toBe('SD')
    expect(recistResponse(-100)).toBe('CR')
  })

  it('deriveLesionStatus: 单次测量 → 新发', () => {
    expect(deriveLesionStatus([{ id: 'm1', studyId: 's1', date: '2026-08-01', sizeMm: 6 }])).toBe('新发')
  })

  it('deriveLesionStatus: ≥20% 增大 → 增大; ≥20% 缩小 → 缩小; 其余 → 稳定', () => {
    const base = { id: 'm1', studyId: 's1', date: '2026-01-01' }
    expect(deriveLesionStatus([
      { ...base, sizeMm: 10 },
      { id: 'm2', studyId: 's2', date: '2026-08-01', sizeMm: 12.5 },
    ])).toBe('增大')
    expect(deriveLesionStatus([
      { ...base, sizeMm: 10 },
      { id: 'm2', studyId: 's2', date: '2026-08-01', sizeMm: 7 },
    ])).toBe('缩小')
    expect(deriveLesionStatus([
      { ...base, sizeMm: 10 },
      { id: 'm2', studyId: 's2', date: '2026-08-01', sizeMm: 10.5 },
    ])).toBe('稳定')
  })

  it('deriveLesionStatus: 显式响应优先 (CR→消失, PR→缩小, PD→增大)', () => {
    const prev = { id: 'm1', studyId: 's1', date: '2026-01-01', sizeMm: 10 }
    expect(deriveLesionStatus([prev, { id: 'm2', studyId: 's2', date: '2026-08-01', sizeMm: 8, response: 'CR' as const }])).toBe('消失')
    expect(deriveLesionStatus([prev, { id: 'm3', studyId: 's3', date: '2026-08-01', sizeMm: 8, response: 'PR' as const }])).toBe('缩小')
    expect(deriveLesionStatus([prev, { id: 'm4', studyId: 's4', date: '2026-08-01', sizeMm: 8, response: 'PD' as const }])).toBe('增大')
  })

  // ── 列表 (seed + 派生) ───────────────────────────────────────────────────
  it('list: 返回患者病灶 (seed 数据)', async () => {
    const { source, items } = await svc.list('P000001')
    expect(items.length).toBeGreaterThanOrEqual(3)
    expect(items.every((l) => l.patientId === 'P000001')).toBe(true)
    expect(source).toBe('demo')
  })

  it('list: Exam 表有数据时 source=database', async () => {
    mockPrisma.exam.findMany.mockResolvedValueOnce([{ modality: 'CT', bodyPart: '胸部' }])
    const { source } = await svc.list('P000001')
    expect(source).toBe('database')
  })

  // ── CRUD ─────────────────────────────────────────────────────────────────
  it('create: 创建病灶并生成初始测量 (当前状态=新发)', async () => {
    const created = await svc.create({
      patientId: 'P000009', name: '左肾囊肿', site: '左肾上极', type: '其他', initialSizeMm: 12,
    })
    expect(created.id).toBeTruthy()
    expect(created.currentStatus).toBe('新发')
    expect(created.measurements).toHaveLength(1)
    expect(created.measurements[0]!.sizeMm).toBe(12)
  })

  it('get: 不存在抛 NotFoundException', async () => {
    await expect(svc.get('LT-NOT-EXIST')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('update: 编辑名称/部位/类型', async () => {
    const created = await svc.create({ patientId: 'P000009', name: 'A', site: 'B', type: '肺结节', initialSizeMm: 5 })
    const updated = await svc.update(created.id, { name: 'A 改名', site: '右肺上叶', type: '淋巴结' })
    expect(updated.name).toBe('A 改名')
    expect(updated.site).toBe('右肺上叶')
    expect(updated.type).toBe('淋巴结')
  })

  it('remove: 删除存在病灶返回 deleted=true; 再删抛 404', async () => {
    const created = await svc.create({ patientId: 'P000009', name: 'A', site: 'B', type: '其他', initialSizeMm: 3 })
    await expect(svc.remove(created.id)).resolves.toEqual({ id: created.id, deleted: true })
    await expect(svc.remove(created.id)).rejects.toBeInstanceOf(NotFoundException)
  })

  // ── 测量 ─────────────────────────────────────────────────────────────────
  it('addMeasurement: 追加测量并按尺寸变化重算状态 (缩小)', async () => {
    const created = await svc.create({ patientId: 'P000009', name: 'N', site: 'S', type: '肺结节', initialSizeMm: 20 })
    const after = await svc.addMeasurement(created.id, { studyId: 'STU-X', sizeMm: 12, date: '2026-09-01', response: 'PR' })
    expect(after.measurements).toHaveLength(2)
    expect(after.currentStatus).toBe('缩小')
  })

  it('listMeasurements: 按日期升序返回', async () => {
    const created = await svc.create({ patientId: 'P000009', name: 'N', site: 'S', type: '肺结节', initialSizeMm: 5 })
    await svc.addMeasurement(created.id, { studyId: 'STU-2', sizeMm: 6, date: '2026-10-01' })
    const list = await svc.listMeasurements(created.id)
    expect(list.map((m) => m.date).every((d, i, a) => i === 0 || a[i - 1]! <= d)).toBe(true)
  })

  // ── 趋势 ─────────────────────────────────────────────────────────────────
  it('trend: 输出时间线 + 基线对比 + 整体响应', async () => {
    const created = await svc.create({ patientId: 'P000009', name: 'N', site: 'S', type: '肺结节', initialSizeMm: 10 })
    await svc.addMeasurement(created.id, { studyId: 'STU-2', sizeMm: 14, date: '2026-09-01' })
    const t = await svc.trend(created.id)
    expect(t.timeline).toHaveLength(2)
    expect(t.baselineSize).toBe(10)
    expect(t.latestSize).toBe(14)
    expect(t.changePercent).toBe(40)
    expect(t.overallResponse).toBe('PD')
  })

  // ── 跨期对比 (RECIST-like) ──────────────────────────────────────────────
  it('compare: 两次测量 → 变化% + 响应分类 (确定性)', async () => {
    const created = await svc.create({ patientId: 'P000009', name: 'N', site: 'S', type: '肝占位', initialSizeMm: 40, studyId: 'STU-A' })
    await svc.addMeasurement(created.id, { studyId: 'STU-B', sizeMm: 26, date: '2026-09-01' })
    const result = await svc.compare(created.id, { studyIdA: 'STU-A', studyIdB: 'STU-B' })
    expect(result.changeMm).toBe(-14)
    expect(result.changePercent).toBe(-35)
    expect(result.response).toBe('PR')
    expect(result.direction).toBe('缩小')
    expect(result.deterministic).toBe(true)
  })

  it('compare: 测量不存在抛 BadRequestException', async () => {
    const created = await svc.create({ patientId: 'P000009', name: 'N', site: 'S', type: '肺结节', initialSizeMm: 5 })
    await expect(svc.compare(created.id, { studyIdA: 'X1', studyIdB: 'X2' })).rejects.toBeInstanceOf(BadRequestException)
  })

  // ── 统计 ─────────────────────────────────────────────────────────────────
  it('stats: 总数/新发/进展/稳定/消失统计 (P000001 seed)', async () => {
    const s = await svc.stats('P000001')
    expect(s.total).toBeGreaterThanOrEqual(3)
    expect(s.total).toBe(s.new + s.progressed + s.stable + s.disappeared + s.shrunk)
    expect(s.progressed).toBeGreaterThanOrEqual(1) // LT003 纵隔淋巴结 PD
    expect(s.shrunk).toBeGreaterThanOrEqual(1)     // LT002 肝占位 PR
  })

  // ── 随访联动 (Wave 3B) ──────────────────────────────────────────────────
  it('linkFollowup: 校验随访计划并挂接 followupId', async () => {
    const created = await svc.create({ patientId: 'P000001', name: 'N', site: 'S', type: '肺结节', initialSizeMm: 5 })
    const linked = await svc.linkFollowup(created.id, { followupId: 'FU001' })
    expect(linked.followupId).toBe('FU001')
    expect(mockPrisma.followUpPlan.findUnique).toHaveBeenCalledWith({ where: { id: 'FU001' } })
  })

  it('linkFollowup: 随访计划不存在 → BadRequestException', async () => {
    mockPrisma.followUpPlan.findUnique.mockResolvedValueOnce(null)
    const created = await svc.create({ patientId: 'P000001', name: 'N', site: 'S', type: '肺结节', initialSizeMm: 5 })
    await expect(svc.linkFollowup(created.id, { followupId: 'FU-XXX' })).rejects.toBeInstanceOf(BadRequestException)
  })
})
