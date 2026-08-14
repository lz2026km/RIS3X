/**
 * G005 RIS v3.0.6.11-79 - ReportsService 分页消费者 spec
 * 断言 admin config default_page_size 决定未传 take 时的默认分页大小
 * [v3.0.6.11-92 Wave1B P0] + 审核分步 transition 链 spec (初核→终核→双签→已审核)
 */
import { ReportsService, REPORT_TRANSITIONS } from './reports.service'

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const prisma: Record<string, unknown> = {
    report: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    reportRevision: { create: jest.fn().mockResolvedValue({}) },
    auditLog: { findFirst: jest.fn().mockResolvedValue(null) },
    // [v3.0.6.11-92 Wave1B P0] transition() 走 $transaction(tx => ...), tx 复用同款 mock
    $transaction: jest.fn((cb: (tx: Record<string, unknown>) => unknown) => cb({ report: prisma.report, reportRevision: prisma.reportRevision })),
    ...overrides,
  }
  return prisma
}

const makeQueue = () => ({ addReportExport: jest.fn().mockResolvedValue({}) }) as never

const makeSystemConfig = (values: Record<string, unknown> = {}) => ({
  getNumber: jest.fn(async (key: string, fallback: number) => {
    const v = values[key] ?? (key === 'default_page_size' ? 20 : undefined)
    return typeof v === 'number' ? v : fallback
  }),
  getString: jest.fn(async (_key: string, fb: string) => fb),
  get: jest.fn(),
  invalidate: jest.fn(),
}) as never

const makeService = (values: Record<string, unknown> = {}) =>
  new ReportsService(makePrisma() as never, makeQueue(), makeSystemConfig(values))

describe('ReportsService.list (default_page_size 消费者)', () => {
  it('uses admin config default_page_size when take is not provided', async () => {
    const findMany = jest.fn().mockResolvedValue([])
    const count = jest.fn().mockResolvedValue(0)
    const prisma = makePrisma({ report: { findMany, count } })
    const service = new ReportsService(prisma as never, makeQueue(), makeSystemConfig({ default_page_size: 50 }))

    await service.list({})

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }))
  })

  it('falls back to 20 when config is not stored', async () => {
    const findMany = jest.fn().mockResolvedValue([])
    const count = jest.fn().mockResolvedValue(0)
    const prisma = makePrisma({ report: { findMany, count } })
    const service = new ReportsService(prisma as never, makeQueue(), makeSystemConfig({}))

    await service.list({})

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }))
  })

  it('keeps explicit take param as-is', async () => {
    const findMany = jest.fn().mockResolvedValue([])
    const count = jest.fn().mockResolvedValue(0)
    const prisma = makePrisma({ report: { findMany, count } })
    const service = new ReportsService(prisma as never, makeQueue(), makeSystemConfig({ default_page_size: 50 }))

    await service.list({ take: 8 })

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 8 }))
  })
})

// [v3.0.6.11-88 P0] exportStatus: 从 EXPORT_COMPLETED 审计记录派生状态/fileUrl
describe('ReportsService.exportStatus', () => {
  it('returns completed + fileUrl when an EXPORT_COMPLETED audit log exists', async () => {
    const auditLog = {
      findFirst: jest.fn().mockResolvedValue({
        createdAt: new Date('2026-08-11T10:00:00Z'),
        detail: { filePath: 'C:/data/exports/reports/report-RPT-1-1723.html' },
      }),
    }
    const prisma = makePrisma({
      report: { findUnique: jest.fn().mockResolvedValue({ id: 'RPT-1' }) },
      auditLog,
    })
    const service = new ReportsService(
      prisma as never,
      makeQueue(),
      makeSystemConfig({}),
    )

    const res = await service.exportStatus('RPT-1')

    expect(res.status).toBe('completed')
    expect(res.exportedAt).toBe('2026-08-11T10:00:00.000Z')
    expect(res.fileUrl).toContain('/reports/export-files/')
    expect(res.fileUrl).toContain('report-RPT-1-1723.html')
    expect(auditLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ action: 'EXPORT_COMPLETED', resourceId: 'RPT-1' }) }),
    )
  })

  it('returns processing when no export record exists', async () => {
    const prisma = makePrisma({
      report: { findUnique: jest.fn().mockResolvedValue({ id: 'RPT-2' }) },
      auditLog: { findFirst: jest.fn().mockResolvedValue(null) },
    })
    const service = new ReportsService(prisma as never, makeQueue(), makeSystemConfig({}))

    const res = await service.exportStatus('RPT-2')

    expect(res).toEqual({ status: 'processing' })
  })

  it('throws NotFoundException for unknown report', async () => {
    const prisma = makePrisma({ auditLog: { findFirst: jest.fn() } })
    const service = new ReportsService(prisma as never, makeQueue(), makeSystemConfig({}))

    await expect(service.exportStatus('nope')).rejects.toThrow('Report nope not found')
  })
})

// [v3.0.6.11-98 Wave1A P0] 富文本 HTML 持久化: create/update 落库 htmlContent, toReportDto 透出
describe('ReportsService htmlContent 持久化 (Wave1A P0)', () => {
  it('create() persists htmlContent and returns it in DTO', async () => {
    const created = { id: 'RPT-H1', htmlContent: '<h2>所见</h2><p>右肺上叶结节</p>', findings: '右肺上叶结节', conclusion: '', patient: null }
    const create = jest.fn().mockResolvedValue(created)
    const prisma = makePrisma({ report: { create } })
    const service = new ReportsService(prisma as never, makeQueue(), makeSystemConfig({}))

    const res = await service.create({ patientId: 'P1', findings: '右肺上叶结节', conclusion: '', htmlContent: created.htmlContent })

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ htmlContent: created.htmlContent, findings: '右肺上叶结节' }),
    }))
    expect(res.htmlContent).toBe(created.htmlContent)
  })

  it('update() writes htmlContent and leaves findings untouched when omitted', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'RPT-H2', htmlContent: '<table><tr><td>1</td></tr></table>', findings: '旧所见', patient: null })
    const prisma = makePrisma({
      report: {
        findUnique: jest.fn().mockResolvedValue({ id: 'RPT-H2', version: 0 }),
        update,
      },
    })
    const service = new ReportsService(prisma as never, makeQueue(), makeSystemConfig({}))

    const res = await service.update('RPT-H2', { htmlContent: '<table><tr><td>1</td></tr></table>' })

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ htmlContent: '<table><tr><td>1</td></tr></table>' }),
    }))
    expect(res.htmlContent).toBe('<table><tr><td>1</td></tr></table>')
  })

  it('update() skips htmlContent when undefined (保留已有 HTML)', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'RPT-H3', htmlContent: '旧HTML', findings: '新所见', patient: null })
    const prisma = makePrisma({
      report: {
        findUnique: jest.fn().mockResolvedValue({ id: 'RPT-H3', version: 0 }),
        update,
      },
    })
    const service = new ReportsService(prisma as never, makeQueue(), makeSystemConfig({}))

    await service.update('RPT-H3', { findings: '新所见' })

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ htmlContent: expect.anything() }),
    }))
  })

  it('toReportDto defaults htmlContent to empty string for legacy rows', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'RPT-H4', patient: null, findings: 'x', createdAt: new Date(), updatedAt: new Date() }])
    const count = jest.fn().mockResolvedValue(1)
    const prisma = makePrisma({ report: { findMany, count } })
    const service = new ReportsService(prisma as never, makeQueue(), makeSystemConfig({}))

    const res = await service.list({})
    expect((res.items[0] as any).htmlContent).toBe('')
  })
})

// [v3.0.6.11-92 Wave1B P0] 审核分步 transition: 不允许跳过中间态 (DRAFT→INITIAL_REVIEW→FINAL_REVIEW→CO_SIGN_REVIEW→REVIEWED)
describe('ReportsService REPORT_TRANSITIONS 审核链 (Wave1B P0)', () => {
  it('allows step-wise review chain SUBMITTED → INITIAL_REVIEW → FINAL_REVIEW → CO_SIGN_REVIEW → REVIEWED', () => {
    expect(REPORT_TRANSITIONS.SUBMITTED).toContain('INITIAL_REVIEW')
    expect(REPORT_TRANSITIONS.INITIAL_REVIEW).toContain('FINAL_REVIEW')
    expect(REPORT_TRANSITIONS.FINAL_REVIEW).toContain('CO_SIGN_REVIEW')
    expect(REPORT_TRANSITIONS.CO_SIGN_REVIEW).toContain('REVIEWED')
    expect(REPORT_TRANSITIONS.REVIEWED).toContain('SIGNED')
    expect(REPORT_TRANSITIONS.SIGNED).toContain('PUBLISHED')
  })

  it('forbids skipping intermediate states (INITIAL_REVIEW → REVIEWED allowed, SUBMITTED → REVIEWED also allowed as shortcut)', () => {
    expect(REPORT_TRANSITIONS.INITIAL_REVIEW).not.toContain('SIGNED')
    expect(REPORT_TRANSITIONS.FINAL_REVIEW).not.toContain('PUBLISHED')
    expect(REPORT_TRANSITIONS.SUBMITTED).toContain('REVIEWED')
  })

  it('transition() rejects invalid state hop with INVALID_TRANSITION', async () => {
    const prisma = makePrisma({
      report: { findUnique: jest.fn().mockResolvedValue({ id: 'R1', state: 'WRITING' }) },
    })
    const service = new ReportsService(prisma as never, makeQueue(), makeSystemConfig({}))
    await expect(service.transition('R1', 'REVIEWED', 'U1')).rejects.toThrow('INVALID_TRANSITION')
  })

  it('transition() steps INITIAL_REVIEW → FINAL_REVIEW and records revision', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'R1', state: 'FINAL_REVIEW' })
    const revisionCreate = jest.fn().mockResolvedValue({})
    const prisma = makePrisma({
      report: {
        findUnique: jest.fn().mockResolvedValue({ id: 'R1', state: 'INITIAL_REVIEW' }),
        update,
      },
      reportRevision: { create: revisionCreate },
    })
    const service = new ReportsService(prisma as never, makeQueue(), makeSystemConfig({}))
    const res = await service.transition('R1', 'FINAL_REVIEW', 'U1')
    expect(res.state).toBe('FINAL_REVIEW')
    expect(revisionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ fromState: 'INITIAL_REVIEW', toState: 'FINAL_REVIEW' }),
    }))
  })

  it('transition() allows ESCALATED from review states (Wave1B P0 升级入口)', async () => {
    expect(REPORT_TRANSITIONS.INITIAL_REVIEW).toContain('ESCALATED')
    expect(REPORT_TRANSITIONS.FINAL_REVIEW).toContain('ESCALATED')
    expect(REPORT_TRANSITIONS.CO_SIGN_REVIEW).toContain('ESCALATED')
    expect(REPORT_TRANSITIONS.REVIEWED).toContain('ESCALATED')
  })
})

// [v3.0.6.11-92 Wave2A P1] 补发自环: PUBLISHED → PUBLISHED 合法且记录补发审计 (reportRevision)
describe('ReportsService 补发自环 (Wave2A P1)', () => {
  it('REPORT_TRANSITIONS.PUBLISHED contains PUBLISHED self-loop', () => {
    expect(REPORT_TRANSITIONS.PUBLISHED).toContain('PUBLISHED')
  })

  it('transition() PUBLISHED → PUBLISHED succeeds and records republish revision', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'R1', state: 'PUBLISHED', publishedAt: new Date() })
    const revisionCreate = jest.fn().mockResolvedValue({})
    const prisma = makePrisma({
      report: { findUnique: jest.fn().mockResolvedValue({ id: 'R1', state: 'PUBLISHED' }), update },
      reportRevision: { create: revisionCreate },
    })
    const service = new ReportsService(prisma as never, makeQueue(), makeSystemConfig({}))
    const res = await service.transition('R1', 'PUBLISHED', 'U1')
    expect(res.state).toBe('PUBLISHED')
    expect(revisionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ fromState: 'PUBLISHED', toState: 'PUBLISHED' }),
    }))
  })
})
