import { Test } from '@nestjs/testing'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { CustomReportService } from '../src/modules/custom-report/custom-report.service'
import { OlapService } from '../src/modules/olap/olap.service'
import { StatsService } from '../src/modules/stats/stats.service'
import { BiService } from '../src/modules/bi/bi.service'
import { NotificationsService } from '../src/notifications/notifications.service'

// [G005 v3.0.6.11-99 Wave 5A] 自定义报表模块 — 15 用例
describe('CustomReportService', () => {
  let svc: CustomReportService
  let olap: { executeQuery: jest.Mock }
  let stats: Record<string, jest.Mock>
  let bi: Record<string, jest.Mock>
  let notifications: { reportGenerated: jest.Mock }

  beforeAll(async () => {
    olap = { executeQuery: jest.fn() }
    stats = {
      getDaily: jest.fn(),
      getWeekly: jest.fn(),
      getWorkload: jest.fn(),
      getQuality: jest.fn(),
      getUtilization: jest.fn(),
      getAccuracy: jest.fn(),
      getTopDevices: jest.fn(),
    }
    bi = {
      getKpi: jest.fn(),
      getPhysicianRvu: jest.fn(),
      getReportTimeliness: jest.fn(),
      getCriticalSla: jest.fn(),
      getPhysicianPerformance: jest.fn(),
      getDeviceOee: jest.fn(),
    }
    notifications = { reportGenerated: jest.fn() }
    const module = await Test.createTestingModule({
      providers: [
        CustomReportService,
        { provide: OlapService, useValue: olap },
        { provide: StatsService, useValue: stats },
        { provide: BiService, useValue: bi },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile()
    svc = module.get(CustomReportService)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    // 默认 mock 派生源
    stats.getDaily.mockResolvedValue({ source: 'database', data: { examCount: 10, reportCount: 8, criticalCount: 2 } })
    stats.getWeekly.mockResolvedValue({ source: 'database', data: { totalExams: 70 } })
    stats.getWorkload.mockResolvedValue({ source: 'database', data: [{ examCount: 5 }, { examCount: 6 }] })
    stats.getQuality.mockResolvedValue({ source: 'database', data: { averageScore: 90, defectRate: 4.5 } })
    stats.getUtilization.mockResolvedValue({ current: 72.5 })
    stats.getAccuracy.mockResolvedValue({ value: 96.2 })
    stats.getTopDevices.mockResolvedValue([{ deviceId: 'CT-1', deviceName: 'GE', modality: 'CT', count: 88 }])
    bi.getKpi.mockResolvedValue({ source: 'database', data: { examCount: 300, completionRate: 92.5, avgReportMinutes: 35, criticalSlaRate: 95.5 } })
    bi.getPhysicianRvu.mockResolvedValue({ source: 'database', data: { totalRvu: 1260.5 } })
    bi.getReportTimeliness.mockResolvedValue({ source: 'database', data: { medianMinutes: 28.5 } })
    bi.getCriticalSla.mockResolvedValue({ source: 'database', data: { complianceRate: 96 } })
    bi.getPhysicianPerformance.mockResolvedValue({ source: 'database', data: { totalBonus: 15120.75 } })
    bi.getDeviceOee.mockResolvedValue({ source: 'database', data: { devices: [{ avgOee: 84.3 }] } })
    notifications.reportGenerated.mockResolvedValue({ count: 1, items: [{ id: 'n1' }] })
  })

  // ── CRUD ────────────────────────────────────────────────────────────────
  it('list 返回 seed 定义 (≥3), 含约定字段形状', () => {
    const list = svc.list()
    expect(list.length).toBeGreaterThanOrEqual(3)
    expect(list[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      name: expect.any(String),
      category: expect.any(String),
      fields: expect.any(Array),
      period: expect.any(String),
      dataSource: expect.any(String),
      status: expect.any(String),
    }))
    expect(list.some((d) => d.schedule != null)).toBe(true)
  })

  it('get 返回详情, 缺失 id 抛 NotFoundException', () => {
    const def = svc.get('cr-weekly-exam')
    expect(def.name).toBe('科室检查周报')
    expect(() => svc.get('cr-not-exist')).toThrow(NotFoundException)
  })

  it('create 校验 name/fields, 创建后 status=idle 且排在最前', () => {
    const def = svc.create({ name: '测试报表', fields: ['exam_count', 'bi_exam_count'], period: 'monthly', dataSource: 'mixed' })
    expect(def.id).toContain('cr-')
    expect(def.status).toBe('idle')
    expect(def.fields).toEqual(['exam_count', 'bi_exam_count'])
    expect(svc.list()[0]!.id).toBe(def.id)
    expect(() => svc.create({ name: '', fields: ['exam_count'] })).toThrow(BadRequestException)
    expect(() => svc.create({ name: 'x', fields: [] })).toThrow(BadRequestException)
  })

  it('create 拒绝未知字段 (字段目录白名单校验)', () => {
    expect(() => svc.create({ name: '坏报表', fields: ['not_a_field'] })).toThrow(BadRequestException)
  })

  it('update 仅覆盖传入字段, 缺失 id 抛 NotFoundException', () => {
    const def = svc.update('cr-monthly-quality', { name: '月度质控加强版', period: 'weekly' })
    expect(def.name).toBe('月度质控加强版')
    expect(def.period).toBe('weekly')
    expect(def.fields).toEqual(['quality_score_avg', 'quality_excellent_rate', 'quality_pass_rate', 'report_timely_rate'])
    expect(() => svc.update('cr-not-exist', { name: 'x' })).toThrow(NotFoundException)
    expect(() => svc.update('cr-monthly-quality', { fields: [] })).toThrow(BadRequestException)
  })

  it('remove 删除定义并返回 deleted: true, 重复删除返回 false', () => {
    const def = svc.create({ name: '待删除', fields: ['exam_count'] })
    expect(svc.remove(def.id)).toEqual({ id: def.id, deleted: true })
    expect(svc.remove(def.id)).toEqual({ id: def.id, deleted: false })
    expect(() => svc.get(def.id)).toThrow(NotFoundException)
  })

  // ── 字段目录 ─────────────────────────────────────────────────────────────
  it('fields-catalog 按 source 分组: olap 含 measures+dimensions, 还有 stats/bi 快照字段', () => {
    const catalog = svc.getFieldsCatalog()
    const olapMeasure = catalog.filter((f) => f.source === 'olap' && f.kind === 'measure')
    const olapDim = catalog.filter((f) => f.source === 'olap' && f.kind === 'dimension')
    const stats = catalog.filter((f) => f.source === 'stats')
    const biFields = catalog.filter((f) => f.source === 'bi')
    expect(olapMeasure.length).toBeGreaterThanOrEqual(30)
    expect(olapDim.length).toBeGreaterThanOrEqual(10)
    expect(stats.length).toBeGreaterThanOrEqual(8)
    expect(biFields.length).toBeGreaterThanOrEqual(8)
    expect(catalog).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'exam_count' }),
      expect.objectContaining({ id: 'modality' }),
      expect.objectContaining({ id: 'stats_utilization' }),
      expect.objectContaining({ id: 'bi_bonus_total' }),
    ]))
    const ids = new Set(catalog.map((f) => f.id))
    expect(ids.size).toBe(catalog.length)
  })

  // ── 执行 / 结果 / 历史 ───────────────────────────────────────────────────
  it('run 对 olap 数据源: 调 OlapService.executeQuery, 返回 columns/rows/summary 并更新 lastRunAt/status', async () => {
    olap.executeQuery.mockResolvedValue({
      columns: [], rows: [
        { date: '2026-08-01', exam_count: 12, report_count: 9 },
        { date: '2026-08-08', exam_count: 15, report_count: 11 },
      ],
      total: 2, generatedAt: new Date().toISOString(), source: 'kpiHistory',
    })
    const result = await svc.run('cr-weekly-exam')
    expect(olap.executeQuery).toHaveBeenCalledWith(expect.objectContaining({
      dimensions: ['date'],
      measures: ['exam_count', 'report_count', 'exam_revenue', 'positive_rate'],
      granularity: 'weekly',
      limit: 200,
    }))
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toHaveProperty('检查量', 12)
    expect(result.rows[0]).toHaveProperty('周期', '2026-08-01')
    expect(result.columns[0]).toEqual({ key: '周期', name: '周期' })
    expect(result.source).toContain('olap')
    const def = svc.get('cr-weekly-exam')
    expect(def.status).toBe('ready')
    expect(def.lastRunAt).not.toBeNull()
  })

  it('run 对纯快照数据源 (bi): 不调 OLAP, 生成单行快照', async () => {
    const result = await svc.run('cr-performance-month')
    expect(olap.executeQuery).not.toHaveBeenCalled()
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ 'BI检查量': 300, '报告完成率': 92.5 })
    expect(result.source).toContain('snapshot')
  })

  it('run mixed: olap 行合并 stats/bi 快照字段, 每行含快照列', async () => {
    olap.executeQuery.mockResolvedValue({ columns: [], rows: [{ date: '2026-08-01', device_usage_rate: 78 }], total: 1 })
    const result = await svc.run('cr-device-daily')
    expect(olap.executeQuery).toHaveBeenCalled()
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ '设备使用率': 78, '设备利用率': 72.5, '设备OEE均值': 84.3 })
    expect(result.source).toContain('+快照')
  })

  it('getResult 返回最近快照; 未执行过抛 NotFoundException', () => {
    expect(() => svc.getResult('cr-not-exist')).toThrow(NotFoundException)
    expect(() => svc.getResult('cr-monthly-quality')).toThrow(NotFoundException)
  })

  it('getResult 执行后返回缓存的运行结果', async () => {
    const def = svc.create({ name: '缓存验证', fields: ['quality_score_avg', 'exam_count'], period: 'monthly', dataSource: 'olap' })
    olap.executeQuery.mockResolvedValue({ columns: [], rows: [{ date: '2026-08-01', quality_score_avg: 90, exam_count: 12 }], total: 1 })
    const result = await svc.run(def.id)
    const cached = svc.getResult(def.id)
    expect(cached.id).toBe(result.id)
    expect(cached.summary).toEqual(expect.objectContaining({ rowCount: 1, period: 'monthly' }))
  })

  it('history 按时间倒序记录每次执行, 支持按 reportId 过滤', async () => {
    const def = svc.create({ name: '历史验证', fields: ['exam_count'], period: 'daily', dataSource: 'olap' })
    olap.executeQuery.mockResolvedValue({ columns: [], rows: [{ date: '2026-08-01', exam_count: 1 }], total: 1 })
    await svc.run(def.id)
    await svc.run(def.id)
    const all = svc.getHistory()
    const filtered = svc.getHistory(def.id)
    expect(all.length).toBeGreaterThanOrEqual(2)
    expect(filtered.length).toBe(2)
    expect(filtered[0]!.ranAt >= filtered[1]!.ranAt).toBe(true)
    expect(filtered[0]).toEqual(expect.objectContaining({ status: 'success', rowCount: 1 }))
  })

  it('run 失败时 status=failed 且历史记录失败条目', async () => {
    olap.executeQuery.mockRejectedValue(new Error('db down'))
    await expect(svc.run('cr-monthly-quality')).rejects.toThrow('db down')
    const def = svc.get('cr-monthly-quality')
    expect(def.status).toBe('failed')
    const history = svc.getHistory('cr-monthly-quality')
    expect(history[0]!.status).toBe('failed')
  })

  // ── 定时 + 推送联动 ─────────────────────────────────────────────────────
  it('setSchedule 保存定时+订阅人, 并联动 notifications/report-generated 推送', async () => {
    const def = svc.create({ name: '推送验证报表', fields: ['exam_count'], period: 'daily', dataSource: 'olap' })
    const out = await svc.setSchedule(def.id, { schedule: 'monthly: 每月1日 09:00', recipients: ['current', 'D002'] })
    expect(out.def.schedule).toBe('monthly: 每月1日 09:00')
    expect(out.def.recipients).toEqual(['current', 'D002'])
    expect(out.notified.count).toBe(1)
    expect(notifications.reportGenerated).toHaveBeenCalledWith(expect.objectContaining({
      reportId: def.id,
      reportName: '推送验证报表',
      recipients: ['current', 'D002'],
      link: '/data-report-center',
    }))
    await expect(svc.setSchedule('cr-not-exist', { schedule: 'x', recipients: ['current'] })).rejects.toThrow(NotFoundException)
  })

  it('setSchedule 校验 schedule/recipients 必填', async () => {
    await expect(svc.setSchedule('cr-monthly-quality', { schedule: '', recipients: ['current'] })).rejects.toThrow(BadRequestException)
    await expect(svc.setSchedule('cr-monthly-quality', { schedule: 'daily', recipients: [] })).rejects.toThrow(BadRequestException)
  })

  it('已设置定时+订阅人的报表 run 完成后自动推送通知 (5A/5B 联动)', async () => {
    olap.executeQuery.mockResolvedValue({ columns: [], rows: [{ date: '2026-08-01', exam_count: 12 }], total: 1 })
    await svc.run('cr-weekly-exam')
    expect(notifications.reportGenerated).toHaveBeenCalledWith(expect.objectContaining({
      reportId: 'cr-weekly-exam',
      recipients: ['current'],
    }))
    // 未设置定时的报表不推送
    const plain = svc.create({ name: '无定时报表', fields: ['exam_count'], period: 'daily', dataSource: 'olap' })
    notifications.reportGenerated.mockClear()
    await svc.run(plain.id)
    expect(notifications.reportGenerated).not.toHaveBeenCalled()
  })

  // ── 导出 ─────────────────────────────────────────────────────────────────
  it('exportCsv 返回 BOM + 表头 + 数据行', async () => {
    olap.executeQuery.mockResolvedValue({ columns: [], rows: [{ date: '2026-08-01', exam_count: 12, report_count: 9 }], total: 1 })
    await svc.run('cr-weekly-exam')
    const csv = svc.exportCsv('cr-weekly-exam')
    expect(csv.startsWith('\uFEFF')).toBe(true)
    const lines = csv.replace('\uFEFF', '').split('\r\n')
    expect(lines[0]).toContain('周期')
    expect(lines[0]).toContain('检查量')
    expect(lines[1]).toContain('2026-08-01')
    expect(() => svc.exportCsv('cr-not-exist')).toThrow(NotFoundException)
  })
})
