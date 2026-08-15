// [v3.0.6.11-100 Wave 6A (D-4)] 报告→病灶追踪自动建 spec
// POST /lesion-tracking/from-report: 报告文本关键词提取 (肺结节/肝占位/淋巴结等) → 自动建档
// + 关联查询 (listByReport, GET /reports/:id/lesions 由 ReportsService 委托)
import { Test } from '@nestjs/testing'
import { NotFoundException, BadRequestException } from '@nestjs/common'
import {
  LesionTrackingService,
  extractLesionKeywords,
  extractSizeMm,
  extractSite,
} from '../src/modules/lesion-tracking/lesion-tracking.service'
import { PrismaService } from '../src/prisma/prisma.service'

const mockReport = {
  id: 'RPT-REP-001',
  patientId: 'P000009',
  examId: 'EX-001',
  exam: { modality: 'CT' },
  impression: '右肺上叶见直径 6.5mm 肺结节, 左肺下叶磨玻璃影 8mm, 肝右叶见约 42mm 肝占位, 纵隔淋巴结增大。',
  conclusion: '建议定期随访复查。',
  findings: '右肺上叶尖段磨玻璃影, 大小约 6.5mm×5.2mm; 肝右叶 S7 占位性病变。',
}

const mockReportNoKeyword = {
  id: 'RPT-REP-002',
  patientId: 'P000010',
  examId: null,
  exam: null,
  impression: '胸部平扫未见明确异常。',
  conclusion: '未见异常。',
  findings: '双肺纹理清晰。',
}

// 每次 createFromReport 用例使用独立 reportId, 避免进程内存 Map 跨用例状态污染
const cloneReport = (id: string, overrides: Record<string, unknown> = {}): typeof mockReport => ({
  ...mockReport,
  id,
  ...(overrides as Partial<typeof mockReport>),
})

describe('LesionTrackingService from-report (D-4)', () => {
  let svc: LesionTrackingService

  const mockPrisma = {
    report: {
      findUnique: jest.fn().mockImplementation((args: { where: { id: string } }) => {
        const id = args?.where?.id
        if (id === mockReport.id) return Promise.resolve(mockReport)
        if (id === mockReportNoKeyword.id) return Promise.resolve(mockReportNoKeyword)
        if (String(id ?? '').startsWith('RPT-REP-')) {
          // 独立用例: 每个 id 一个等价报告副本 (避免内存 Map 状态串扰)
          const extra: Record<string, typeof mockReport> = {
            'RPT-REP-101': cloneReport('RPT-REP-101'),
            'RPT-REP-102': cloneReport('RPT-REP-102'),
            'RPT-REP-103': cloneReport('RPT-REP-103'),
            'RPT-REP-104': cloneReport('RPT-REP-104'),
          }
          return Promise.resolve(extra[id] ?? cloneReport(String(id)))
        }
        return Promise.resolve(null)
      }),
    },
    exam: { findMany: jest.fn().mockResolvedValue([]) },
    followUpPlan: { findUnique: jest.fn().mockResolvedValue({ id: 'FU001', patientId: 'P000001' }) },
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [LesionTrackingService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile()
    svc = module.get(LesionTrackingService)
  })

  beforeEach(() => jest.clearAllMocks())

  // ── 纯函数: 关键词/尺寸/部位提取 ─────────────────────────────────────────
  it('extractLesionKeywords: 提取肺结节/肝占位/淋巴结并派生名称/部位/尺寸', () => {
    const matches = extractLesionKeywords(mockReport.impression)
    const keywords = matches.map((m) => m.keyword)
    expect(keywords).toContain('肺结节')
    expect(keywords).toContain('肝占位')
    expect(keywords).toContain('淋巴结')
    const nodule = matches.find((m) => m.keyword === '肺结节')!
    expect(nodule.name).toBe('肺结节 #1')
    expect(nodule.type).toBe('肺结节')
    expect(nodule.site).toBe('右肺上叶')
    expect(nodule.sizeMm).toBe(6.5)
    const liver = matches.find((m) => m.keyword === '肝占位')!
    expect(liver.site).toBe('肝右叶')
    expect(liver.sizeMm).toBe(42)
  })

  it('extractLesionKeywords: 磨玻璃影归入肺结节类型', () => {
    const matches = extractLesionKeywords('左肺下叶磨玻璃影, 直径 8mm')
    const ggo = matches.find((m) => m.keyword === '磨玻璃')
    expect(ggo).toBeDefined()
    expect(ggo!.type).toBe('肺结节')
    expect(ggo!.sizeMm).toBe(8)
    expect(ggo!.site).toBe('左肺下叶')
  })

  it('extractLesionKeywords: 无关键词返回空数组; 空文本返回空数组', () => {
    expect(extractLesionKeywords('双侧肺野清晰, 未见异常')).toEqual([])
    expect(extractLesionKeywords('')).toEqual([])
    expect(extractLesionKeywords('   ')).toEqual([])
  })

  it('extractLesionKeywords: 同一关键词重复出现只保留一条 (去重)', () => {
    const matches = extractLesionKeywords('右肺上叶肺结节, 左肺下叶肺结节, 纵隔见肺结节影')
    expect(matches.filter((m) => m.keyword === '肺结节')).toHaveLength(1)
  })

  it('extractSizeMm: 直径/约/乘积多种写法均能提取; 无尺寸返回 undefined', () => {
    expect(extractSizeMm('直径 6.5mm')).toBe(6.5)
    expect(extractSizeMm('大小约 12×8mm')).toBe(12)
    expect(extractSizeMm('约 3cm 结节')).toBeUndefined() // 仅 mm 支持, cm 不误匹配
    expect(extractSizeMm('未见明确异常')).toBeUndefined()
  })

  it('extractSite: 命中解剖学短语; 未命中返回 undefined', () => {
    expect(extractSite('右肺上叶尖段结节')).toBe('右肺上叶')
    expect(extractSite('肝右叶 S7 占位')).toBe('肝右叶')
    expect(extractSite('无明确部位描述')).toBeUndefined()
  })

  // ── createFromReport ──────────────────────────────────────────────────────
  it('createFromReport: 从报告 impression 提取关键词并自动建档 (source=from-report, reportId 关联)', async () => {
    const res = await svc.createFromReport({ reportId: mockReport.id })
    expect(res.reportId).toBe(mockReport.id)
    expect(res.patientId).toBe(mockReport.patientId)
    expect(res.created.length).toBeGreaterThanOrEqual(3)
    expect(res.skipped).toBe(0)
    for (const l of res.created) {
      expect(l.source).toBe('from-report')
      expect(l.reportId).toBe(mockReport.id)
      expect(l.measurements).toHaveLength(1)
    }
    const nodule = res.created.find((l) => l.type === '肺结节')
    expect(nodule).toBeDefined()
    expect(nodule!.site).toBe('右肺上叶')
    expect(nodule!.measurements[0]!.sizeMm).toBe(6.5)
    expect(nodule!.currentStatus).toBe('新发')
  })

  it('createFromReport: 指定 keyword 仅创建匹配病灶', async () => {
    const res = await svc.createFromReport({ reportId: 'RPT-REP-101', keyword: '淋巴结' })
    expect(res.created).toHaveLength(1)
    expect(res.created[0]!.type).toBe('淋巴结')
    expect(res.created[0]!.site).toBe('纵隔')
  })

  it('createFromReport: 幂等 — 重复调用同报告同名称跳过建档 (skipped)', async () => {
    const first = await svc.createFromReport({ reportId: 'RPT-REP-102' })
    expect(first.created.length).toBeGreaterThanOrEqual(3)
    const second = await svc.createFromReport({ reportId: 'RPT-REP-102' })
    expect(second.created).toHaveLength(0)
    expect(second.skipped).toBe(first.created.length)
    // 首次创建的病灶仍可关联查询
    const byReport = await svc.listByReport('RPT-REP-102')
    expect(byReport.items.length).toBeGreaterThanOrEqual(first.created.length)
    expect(byReport.items.every((l) => l.reportId === 'RPT-REP-102')).toBe(true)
  })

  it('createFromReport: 报告无病灶关键词 → created 为空数组', async () => {
    const res = await svc.createFromReport({ reportId: mockReportNoKeyword.id })
    expect(res.created).toEqual([])
    expect(res.matched).toEqual([])
    expect(res.skipped).toBe(0)
  })

  it('createFromReport: 报告不存在 → NotFoundException; 缺 reportId → BadRequestException', async () => {
    await expect(svc.createFromReport({ reportId: 'RPT-NOT-EXIST' })).rejects.toBeInstanceOf(NotFoundException)
    await expect(svc.createFromReport({ reportId: '' })).rejects.toBeInstanceOf(BadRequestException)
  })

  // ── listByReport (GET /reports/:id/lesions 数据源) ────────────────────────
  it('listByReport: 仅返回该报告关联的 from-report 病灶', async () => {
    const res = await svc.createFromReport({ reportId: 'RPT-REP-103' })
    const byReport = await svc.listByReport('RPT-REP-103')
    expect(byReport.reportId).toBe('RPT-REP-103')
    const ids = new Set(byReport.items.map((l) => l.id))
    expect(res.created.every((l) => ids.has(l.id))).toBe(true)
    expect(byReport.items.every((l) => l.source === 'from-report')).toBe(true)
  })

  it('listByReport: 未关联报告 → 空 items', async () => {
    const byReport = await svc.listByReport('RPT-NO-LESIONS')
    expect(byReport.items).toEqual([])
  })

  it('create(): 手动建档默认 source=manual, 支持 ai/from-report 显式标注', async () => {
    const manual = await svc.create({ patientId: 'P000009', name: '手动病灶', site: '左肾', type: '其他', initialSizeMm: 10 })
    expect(manual.source).toBe('manual')
    const ai = await svc.create({ patientId: 'P000009', name: 'AI 检出', site: '右肺', type: '肺结节', source: 'ai' })
    expect(ai.source).toBe('ai')
    const fromReport = await svc.create({
      patientId: 'P000009', name: '报告病灶', site: '肝脏', type: '肝占位', source: 'from-report', reportId: 'RPT-X',
    })
    expect(fromReport.source).toBe('from-report')
    expect(fromReport.reportId).toBe('RPT-X')
    const list = await svc.list('P000009')
    expect(list.items.some((l) => l.reportId === 'RPT-X')).toBe(true)
  })
})
