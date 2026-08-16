/**
 * [v3.0.6.11-100 Wave2C (报告工作站 P3)] 报告→随访自动触发 spec
 * - 规则 seed (10 条) + 关键词匹配
 * - createFollowUpFromReport: 模板存在走 generateFromTemplate, 缺失回退直接创建
 * - 触发模式: hint 默认仅提示 / auto 自动创建
 * - reports.service transition(PUBLISHED) 后置钩子: auto 模式创建计划 + auditLog
 * [v3.0.6.11-103 Wave 13] 触发点强化: SUBMITTED → PUBLISHED (报告发布后按规则自动创建)
 */
import { ReportsService } from '../src/reports/reports.service'
import { FollowUpService } from '../src/modules/followup/followup.service'
import { SEED_FOLLOWUP_TRIGGER_RULES, matchFollowUpTriggerRules, listFollowUpTriggerRules } from '../src/modules/followup/followup-trigger-rules'

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
    auditLog: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
    followUpPlan: { create: jest.fn() },
    $transaction: jest.fn((cb: (tx: Record<string, unknown>) => unknown) => cb({ report: prisma.report, reportRevision: prisma.reportRevision })),
    ...overrides,
  }
  return prisma
}

/** followUpPlan.create mock 返回完整行 (toDto 需要 createdAt/updatedAt) */
const makePlanCreate = (overrides: Partial<Record<string, unknown>> = {}) => jest.fn().mockImplementation(({ data }) =>
  Promise.resolve({
    id: 'fp-new',
    ...data,
    status: 'PENDING',
    remindedAt: null,
    missedAt: null,
    cancelledAt: null,
    reason: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
)

const makeQueue = () => ({ addReportExport: jest.fn().mockResolvedValue({}) }) as never

const makeSystemConfig = (values: Record<string, unknown> = {}) => ({
  getNumber: jest.fn(async (key: string, fallback: number) => {
    const v = values[key] ?? (key === 'default_page_size' ? 20 : undefined)
    return typeof v === 'number' ? v : fallback
  }),
  getString: jest.fn(async (key: string, fb: string) => (typeof values[key] === 'string' ? values[key] : fb)),
  get: jest.fn(),
  invalidate: jest.fn(),
}) as never

describe('FollowUpTriggerRules (报告→随访自动触发)', () => {
  it('seed contains 10 active rules covering 肺结节/乳腺/骨折 keywords', () => {
    expect(listFollowUpTriggerRules()).toHaveLength(10)
    expect(listFollowUpTriggerRules().every((r) => r.active)).toBe(true)
    const kw = listFollowUpTriggerRules().map((r) => r.keyword)
    expect(kw).toEqual(expect.arrayContaining(['肺结节', '乳腺', '骨折']))
  })

  it('matchFollowUpTriggerRules hits keyword in impression/findings text', () => {
    const matches = matchFollowUpTriggerRules('右肺上叶见磨玻璃影,肺结节影,建议随访复查')
    expect(matches.length).toBeGreaterThanOrEqual(2)
    expect(matches.map((m) => m.rule.keyword)).toEqual(expect.arrayContaining(['肺结节', '磨玻璃']))
    expect(matches[0]?.rule.intervals).toEqual(expect.arrayContaining([90, 180, 360]))
  })

  it('matches both 乳腺 and 乳腺癌 when text contains 乳腺癌', () => {
    const matches = matchFollowUpTriggerRules('左乳乳腺癌术后改变')
    const kws = matches.map((m) => m.rule.keyword)
    expect(kws).toEqual(expect.arrayContaining(['乳腺', '乳腺癌']))
  })

  it('returns empty when no keyword matched', () => {
    expect(matchFollowUpTriggerRules('双肺纹理清晰,未见异常')).toEqual([])
    expect(matchFollowUpTriggerRules('')).toEqual([])
    expect(matchFollowUpTriggerRules(null)).toEqual([])
  })

  it('skips inactive rules', () => {
    const deactivated = SEED_FOLLOWUP_TRIGGER_RULES.map((r) => (r.id === 'FTR-001' ? { ...r, active: false } : r))
    const original = SEED_FOLLOWUP_TRIGGER_RULES[0]!
    try {
      ;(SEED_FOLLOWUP_TRIGGER_RULES[0] as any).active = false
      expect(matchFollowUpTriggerRules('右肺结节影')).toEqual([])
    } finally {
      ;(SEED_FOLLOWUP_TRIGGER_RULES[0] as any).active = original.active
    }
  })

  it('createFollowUpFromReport falls back to direct create when template missing (骨折演示规则)', async () => {
    const followUpPlanCreate = makePlanCreate()
    const prisma = makePrisma({ followUpPlan: { create: followUpPlanCreate } })
    const svc = new FollowUpService(prisma as never, makeSystemConfig({}))
    const res = await svc.createFollowUpFromReport({
      reportId: 'R1',
      patientId: 'P1',
      patientName: '张三',
      planDate: '2026-08-15',
      matches: matchFollowUpTriggerRules('右桡骨远端骨折'),
    })
    expect(res.created).toBe(2) // tpl-fracture 模板不存在 → 1/3 月两条
    expect(res.matched).toEqual(['骨折'])
    expect(followUpPlanCreate).toHaveBeenCalledTimes(2)
  })

  it('createFollowUpFromReport uses generateFromTemplate when template exists (磨玻璃→肺结节模板)', async () => {
    const followUpTemplate = {
      findUnique: jest.fn().mockResolvedValue({ id: 'tpl-nodule', name: '肺结节随访', intervals: [90, 180, 360], items: ['薄层CT复查', '结节大小对比'] }),
    }
    const followUpPlanCreate = makePlanCreate()
    const prisma = makePrisma({ followUpTemplate, followUpPlan: { create: followUpPlanCreate } })
    const svc = new FollowUpService(prisma as never, makeSystemConfig({}))
    const res = await svc.createFollowUpFromReport({
      reportId: 'R2',
      patientId: 'P2',
      patientName: '李四',
      examId: 'E2',
      planDate: '2026-08-15',
      matches: matchFollowUpTriggerRules('右肺上叶磨玻璃样小结节影,建议随访'),
    })
    expect(res.created).toBe(3) // tpl-nodule intervals 3 期
    expect(res.matched).toEqual(['磨玻璃'])
    expect(followUpPlanCreate).toHaveBeenCalledTimes(3)
  })

  it('getTriggerMode defaults to hint and reads auto from config', async () => {
    const svcHint = new FollowUpService(makePrisma({}) as never, makeSystemConfig({}))
    expect(await svcHint.getTriggerMode()).toBe('hint')
    const svcAuto = new FollowUpService(makePrisma({}) as never, makeSystemConfig({ followup_auto_trigger_mode: 'auto' }))
    expect(await svcAuto.getTriggerMode()).toBe('auto')
  })

  it('triggerRulesInfo returns rules + mode', async () => {
    const svc = new FollowUpService(makePrisma({}) as never, makeSystemConfig({}))
    const info = await svc.triggerRulesInfo()
    expect(info.items).toHaveLength(10)
    expect(info.mode).toBe('hint')
  })

  it('ReportsService.transition(PUBLISHED) post-hook auto-creates follow-up plans + audit when mode=auto', async () => {
    const followUpPlanCreate = makePlanCreate()
    const auditCreate = jest.fn().mockResolvedValue({})
    const report = {
      id: 'R-100',
      tenantId: 't1',
      patientId: 'P-100',
      patient: { name: '王五' },
      examId: 'E-100',
      state: 'SIGNED',
      impression: '右肺上叶可见磨玻璃样结节影',
      conclusion: '',
      findings: '结节大小约 0.8cm,建议随访复查',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const prisma = makePrisma({
      report: { findUnique: jest.fn().mockResolvedValue(report), update: jest.fn().mockResolvedValue(report) },
      reportRevision: { create: jest.fn().mockResolvedValue({}) },
      auditLog: { findFirst: jest.fn().mockResolvedValue(null), create: auditCreate },
      followUpPlan: { create: followUpPlanCreate },
      followUpTemplate: { findUnique: jest.fn().mockResolvedValue(null) },
    })
    const followUp = new FollowUpService(prisma as never, makeSystemConfig({}))
    const service = new ReportsService(
      prisma as never,
      makeQueue(),
      makeSystemConfig({ followup_auto_trigger_mode: 'auto' }),
      undefined,
      followUp,
    )
    await service.transition('R-100', 'PUBLISHED', 'U-1')
    expect(followUpPlanCreate).toHaveBeenCalled()
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'FOLLOWUP_TRIGGER', resourceId: 'R-100' }) }))
  })

  it('ReportsService.transition(PUBLISHED) does NOT create plans in hint mode (默认仅提示)', async () => {
    const followUpPlanCreate = makePlanCreate()
    const report = {
      id: 'R-101', tenantId: 't1', patientId: 'P-101', patient: { name: '赵六' },
      examId: null, state: 'SIGNED', impression: '右肺上叶磨玻璃影', conclusion: '', findings: '',
      createdAt: new Date(), updatedAt: new Date(),
    }
    const prisma = makePrisma({
      report: { findUnique: jest.fn().mockResolvedValue(report), update: jest.fn().mockResolvedValue(report) },
      reportRevision: { create: jest.fn().mockResolvedValue({}) },
      auditLog: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      followUpPlan: { create: followUpPlanCreate },
    })
    const followUp = new FollowUpService(prisma as never, makeSystemConfig({}))
    const service = new ReportsService(prisma as never, makeQueue(), makeSystemConfig({}), undefined, followUp)
    await service.transition('R-101', 'PUBLISHED', 'U-1')
    expect(followUpPlanCreate).not.toHaveBeenCalled()
  })
})
